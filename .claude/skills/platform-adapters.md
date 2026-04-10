# Platform Adapters — Shopify / WooCommerce / Generic

## Adapter interface

Every platform implements this exact interface. Adding a new platform means creating one new file — zero changes to conversation engine, widget, or dashboard.

```typescript
// server/src/adapters/base.ts

export interface ProductData {
  externalId: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;  // original price (for showing discounts)
  currency: string;
  url: string;
  imageUrl?: string;
  images?: string[];
  category?: string;
  tags?: string[];
  variants?: ProductVariant[];
  inStock: boolean;
  inventory?: number;
}

export interface ProductVariant {
  id: string;
  name: string;        // e.g., "60 Gummies", "30 Tablets"
  price: number;
  inStock: boolean;
}

export interface CartAction {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface CouponData {
  code: string;
  discountPercent: number;
  minOrderValue?: number;
  expiresAt: Date;
  maxUsage: number;
  applicableProducts?: string[];  // empty = all products
}

export interface PlatformAdapter {
  // Identity
  readonly platform: 'shopify' | 'woocommerce' | 'generic';
  
  // Product operations
  fetchProducts(): Promise<ProductData[]>;
  fetchProduct(externalId: string): Promise<ProductData | null>;
  syncProducts(): Promise<{ added: number; updated: number; removed: number }>;
  
  // Cart operations (not all platforms support this)
  addToCart?(action: CartAction): Promise<{ cartUrl: string }>;
  getCartUrl?(items: CartAction[]): string;  // Fallback: generate URL
  
  // Coupon operations
  createCoupon(data: Omit<CouponData, 'code'>): Promise<CouponData>;
  
  // Webhook verification
  verifyWebhook?(payload: Buffer, signature: string): boolean;
}
```

## Shopify adapter

```typescript
// server/src/adapters/shopify.ts

export class ShopifyAdapter implements PlatformAdapter {
  readonly platform = 'shopify';
  
  constructor(
    private shopDomain: string,      // "merchant-store.myshopify.com"
    private accessToken: string,     // Shopify Admin API token
  ) {}
  
  // --- Product sync ---
  
  async fetchProducts(): Promise<ProductData[]> {
    // Use Shopify Admin REST API (simpler than GraphQL for our needs)
    // GET /admin/api/2024-01/products.json
    // Pagination: handle Link headers for stores with 250+ products
    
    const products: ProductData[] = [];
    let pageUrl = `https://${this.shopDomain}/admin/api/2024-01/products.json?limit=250&status=active`;
    
    while (pageUrl) {
      const res = await fetch(pageUrl, {
        headers: { 'X-Shopify-Access-Token': this.accessToken },
      });
      const data = await res.json();
      
      for (const p of data.products) {
        products.push({
          externalId: String(p.id),
          name: p.title,
          description: p.body_html?.replace(/<[^>]+>/g, '') || '',
          price: parseFloat(p.variants[0]?.price || '0'),
          compareAtPrice: p.variants[0]?.compare_at_price 
            ? parseFloat(p.variants[0].compare_at_price) : undefined,
          currency: 'INR', // from shop settings
          url: `https://${this.shopDomain}/products/${p.handle}`,
          imageUrl: p.image?.src,
          images: p.images?.map((i: any) => i.src),
          category: p.product_type || undefined,
          tags: p.tags?.split(',').map((t: string) => t.trim()),
          variants: p.variants?.map((v: any) => ({
            id: String(v.id),
            name: v.title,
            price: parseFloat(v.price),
            inStock: v.inventory_quantity > 0,
          })),
          inStock: p.variants?.some((v: any) => v.inventory_quantity > 0) ?? true,
        });
      }
      
      // Handle pagination via Link header
      const linkHeader = res.headers.get('link');
      pageUrl = this.extractNextPage(linkHeader);
    }
    
    return products;
  }
  
  // --- Cart ---
  
  getCartUrl(items: CartAction[]): string {
    // Shopify cart permalink format:
    // https://store.com/cart/VARIANT_ID:QTY,VARIANT_ID:QTY
    const pairs = items.map(i => `${i.variantId}:${i.quantity}`);
    return `https://${this.shopDomain}/cart/${pairs.join(',')}`;
  }
  
  // --- Coupons ---
  
  async createCoupon(data: Omit<CouponData, 'code'>): Promise<CouponData> {
    // Shopify Admin API: POST /admin/api/2024-01/price_rules.json
    // Then POST /admin/api/2024-01/price_rules/{id}/discount_codes.json
    
    const code = `VOICE-${this.generateCode(6)}`;
    
    // Step 1: Create price rule
    const priceRule = await this.shopifyFetch('/admin/api/2024-01/price_rules.json', {
      method: 'POST',
      body: {
        price_rule: {
          title: code,
          target_type: 'line_item',
          target_selection: data.applicableProducts?.length ? 'entitled' : 'all',
          allocation_method: 'across',
          value_type: 'percentage',
          value: `-${data.discountPercent}`,
          usage_limit: data.maxUsage,
          starts_at: new Date().toISOString(),
          ends_at: data.expiresAt.toISOString(),
          prerequisite_subtotal_range: data.minOrderValue 
            ? { greater_than_or_equal_to: String(data.minOrderValue) } : undefined,
        },
      },
    });
    
    // Step 2: Create discount code for this price rule
    await this.shopifyFetch(
      `/admin/api/2024-01/price_rules/${priceRule.price_rule.id}/discount_codes.json`,
      { method: 'POST', body: { discount_code: { code } } }
    );
    
    return { code, ...data };
  }
}
```

## WooCommerce adapter

```typescript
// server/src/adapters/woocommerce.ts

export class WooCommerceAdapter implements PlatformAdapter {
  readonly platform = 'woocommerce';
  
  constructor(
    private siteUrl: string,          // "https://merchant-store.com"
    private consumerKey: string,       // WooCommerce REST API key
    private consumerSecret: string,
  ) {}
  
  async fetchProducts(): Promise<ProductData[]> {
    // WooCommerce REST API: GET /wp-json/wc/v3/products
    // Uses Basic Auth with consumer key/secret
    // Paginate with ?per_page=100&page=N
    
    const products: ProductData[] = [];
    let page = 1;
    
    while (true) {
      const res = await fetch(
        `${this.siteUrl}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
        {
          headers: {
            'Authorization': 'Basic ' + btoa(`${this.consumerKey}:${this.consumerSecret}`),
          },
        }
      );
      const data = await res.json();
      if (!data.length) break;
      
      for (const p of data) {
        products.push({
          externalId: String(p.id),
          name: p.name,
          description: p.short_description?.replace(/<[^>]+>/g, '') || 
                       p.description?.replace(/<[^>]+>/g, '') || '',
          price: parseFloat(p.price || '0'),
          compareAtPrice: p.regular_price ? parseFloat(p.regular_price) : undefined,
          currency: 'INR',
          url: p.permalink,
          imageUrl: p.images?.[0]?.src,
          images: p.images?.map((i: any) => i.src),
          category: p.categories?.[0]?.name,
          tags: p.tags?.map((t: any) => t.name),
          inStock: p.in_stock ?? true,
          inventory: p.stock_quantity,
        });
      }
      
      page++;
    }
    
    return products;
  }
  
  getCartUrl(items: CartAction[]): string {
    // WooCommerce: ?add-to-cart=PRODUCT_ID&quantity=QTY
    // For multiple items, use the first product as primary
    const main = items[0];
    return `${this.siteUrl}/?add-to-cart=${main.productId}&quantity=${main.quantity}`;
  }
  
  async createCoupon(data: Omit<CouponData, 'code'>): Promise<CouponData> {
    // WooCommerce REST API: POST /wp-json/wc/v3/coupons
    const code = `VOICE-${this.generateCode(6)}`;
    
    await fetch(`${this.siteUrl}/wp-json/wc/v3/coupons`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${this.consumerKey}:${this.consumerSecret}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        discount_type: 'percent',
        amount: String(data.discountPercent),
        usage_limit: data.maxUsage,
        date_expires: data.expiresAt.toISOString(),
        minimum_amount: data.minOrderValue ? String(data.minOrderValue) : undefined,
        product_ids: data.applicableProducts?.map(Number) || [],
      }),
    });
    
    return { code, ...data };
  }
}
```

## Generic adapter (custom websites like reset.in)

```typescript
// server/src/adapters/generic.ts

export class GenericAdapter implements PlatformAdapter {
  readonly platform = 'generic';
  
  constructor(
    private siteUrl: string,
    private merchantId: string,
  ) {}
  
  async fetchProducts(): Promise<ProductData[]> {
    // Three strategies, tried in order:
    
    // 1. Check if merchant uploaded a CSV/JSON product feed
    const manualProducts = await db.product.findMany({
      where: { merchantId: this.merchantId },
    });
    if (manualProducts.length > 0) return manualProducts;
    
    // 2. Crawl site for Schema.org Product structured data
    const schemaProducts = await this.crawlSchemaOrg();
    if (schemaProducts.length > 0) return schemaProducts;
    
    // 3. Crawl site with AI extraction (last resort)
    return await this.crawlWithAI();
  }
  
  private async crawlSchemaOrg(): Promise<ProductData[]> {
    // Fetch sitemap.xml → find product pages → extract JSON-LD
    // Look for @type: "Product" in <script type="application/ld+json">
    // This works with most modern e-commerce sites
  }
  
  private async crawlWithAI(): Promise<ProductData[]> {
    // Use AI service /crawl endpoint
    // BeautifulSoup extracts product-like content
    // Gemini structures it into ProductData format
    // Manual review required — store as "draft" products
  }
  
  // Generic sites can't do server-side cart manipulation
  // Instead, generate a deeplink to the product page
  getCartUrl(items: CartAction[]): string {
    // Find product URL from database and return it
    // User adds to cart manually on the merchant's site
    return `${this.siteUrl}/products/${items[0].productId}`;
  }
  
  // Generic sites: coupon via webhook to merchant's system
  async createCoupon(data: Omit<CouponData, 'code'>): Promise<CouponData> {
    const code = `VOICE-${this.generateCode(6)}`;
    
    // Try merchant's coupon webhook if configured
    const merchant = await db.merchant.findUnique({
      where: { id: this.merchantId },
    });
    
    const webhookUrl = merchant?.config?.couponWebhook;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, ...data }),
      });
    }
    
    // Store coupon in our DB regardless
    // Bot will tell user the code, they enter it manually at checkout
    return { code, ...data };
  }
}
```

## Adapter factory

```typescript
// server/src/adapters/factory.ts

export function createAdapter(merchant: Merchant): PlatformAdapter {
  switch (merchant.platform) {
    case 'shopify':
      return new ShopifyAdapter(
        merchant.config.shopDomain,
        merchant.config.shopifyAccessToken,
      );
    case 'woocommerce':
      return new WooCommerceAdapter(
        merchant.domain,
        merchant.config.wooConsumerKey,
        merchant.config.wooConsumerSecret,
      );
    case 'generic':
    default:
      return new GenericAdapter(
        `https://${merchant.domain}`,
        merchant.id,
      );
  }
}
```

## Product sync strategy

Products are synced on a schedule and via webhooks:

1. **Initial sync:** When merchant connects, fetch all products immediately
2. **Webhook sync:** Shopify/WooCommerce send webhooks on product create/update/delete
3. **Scheduled sync:** Every 6 hours, do a full re-sync as safety net
4. **On-demand sync:** Merchant can trigger from dashboard
5. **After sync:** Re-embed all products in ChromaDB vector store

For generic sites without webhooks, rely on scheduled sync only (every 6 hours).
