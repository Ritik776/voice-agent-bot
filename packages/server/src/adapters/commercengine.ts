/**
 * CommerceEngine Platform Adapter
 * Connects VoiceSell to CommerceEngine-powered stores (like reset.in)
 * Docs: https://www.commercengine.io/docs
 */

import { PlatformAdapter, PlatformProduct, CartResult } from './base';

interface CEProduct {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  tags: string[] | null;
  category_ids: string[];
  categories: Array<{ id: string; name: string; slug: string }>;
  pricing: {
    currency: string;
    listing_price: number;
    selling_price: number;
  };
  images: Array<{
    url_thumbnail: string;
    url_standard: string;
  }>;
  attributes: Array<{
    name: string;
    key: string;
    value: any;
  }>;
  has_variant: boolean;
  variants: Array<{
    id: string;
    name: string;
    sku: string | null;
    slug: string;
    pricing: {
      selling_price: number;
      listing_price: number;
    };
    stock_available: boolean;
  }>;
  reviews_rating_sum: number;
  reviews_count: number;
  stock_available: boolean;
  on_promotion: boolean;
  promotion?: {
    details: {
      promotion_type: string;
    };
  } | null;
}

interface CEConfig {
  storeId: string;
  apiKey: string;
  environment: 'staging' | 'production';
  siteUrl: string;
}

export class CommerceEngineAdapter implements PlatformAdapter {
  readonly platform = 'commercengine' as const;
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private config: CEConfig) {
    const env = config.environment === 'production' ? 'prod' : 'staging';
    this.baseUrl = `https://${env}.api.commercengine.io/api/v1/${config.storeId}/storefront`;
  }

  // --- Auth ---

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const res = await fetch(`${this.baseUrl}/auth/anonymous`, {
      method: 'POST',
      headers: {
        'X-Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`CE auth failed: ${res.status}`);
    }

    const data = await res.json();
    this.accessToken = data.content?.access_token || data.access_token;
    this.tokenExpiry = Date.now() + 50 * 60 * 1000;
    return this.accessToken!;
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.ensureToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`CE API ${path}: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  // --- PlatformAdapter implementation ---

  async fetchAllProducts(): Promise<PlatformProduct[]> {
    const allProducts: CEProduct[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetch(`/catalog/products?page=${page}&limit=100`);
      const products: CEProduct[] = data.content?.products || [];
      if (products.length === 0) break;
      allProducts.push(...products);
      page++;
      if (page > 50) break;
    }

    return allProducts.map((p) => this.toPlatformProduct(p));
  }

  async searchProducts(query: string, limit = 5): Promise<PlatformProduct[]> {
    try {
      const data = await this.fetch('/catalog/products/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit }),
      });
      const skus: CEProduct[] = data.content?.skus || [];
      return skus.map((p) => this.toPlatformProduct(p));
    } catch {
      // Search may not be available — return empty
      return [];
    }
  }

  async getProduct(externalId: string): Promise<PlatformProduct | null> {
    try {
      const data = await this.fetch(`/catalog/products/${externalId}`);
      const product: CEProduct | null = data.content?.product || null;
      return product ? this.toPlatformProduct(product) : null;
    } catch {
      return null;
    }
  }

  getProductUrl(slug: string): string {
    return `${this.config.siteUrl}/products/${slug}`;
  }

  async createCart(): Promise<string> {
    const data = await this.fetch('/carts', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return data.content?.cart?.id;
  }

  async addToCart(cartId: string, productId: string, variantId: string | null, quantity = 1): Promise<CartResult | null> {
    const data = await this.fetch(`/carts/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        variant_id: variantId,
        quantity,
      }),
    });
    return this.toCartResult(data.content?.cart, cartId);
  }

  async applyCoupon(cartId: string, couponCode: string): Promise<CartResult | null> {
    const data = await this.fetch(`/carts/${cartId}/coupon`, {
      method: 'POST',
      body: JSON.stringify({ coupon_code: couponCode }),
    });
    return this.toCartResult(data.content?.cart, cartId);
  }

  getCartUrl(_cartId?: string): string {
    return `${this.config.siteUrl}/cart`;
  }

  // --- Converters ---

  private toPlatformProduct(ce: CEProduct): PlatformProduct {
    return {
      externalId: ce.id,
      name: ce.name,
      description: ce.short_description || '',
      price: ce.pricing.selling_price,
      compareAtPrice: ce.pricing.listing_price > ce.pricing.selling_price
        ? ce.pricing.listing_price
        : undefined,
      currency: ce.pricing.currency || 'INR',
      url: this.getProductUrl(ce.slug),
      imageUrl: ce.images?.[0]?.url_standard || ce.images?.[0]?.url_thumbnail || null,
      category: ce.categories?.[0]?.name || null,
      tags: ce.tags || [],
      variants: ce.variants?.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.pricing.selling_price,
        inStock: v.stock_available,
      })) || [],
      inStock: ce.stock_available,
      rating: ce.reviews_count > 0
        ? ce.reviews_rating_sum / ce.reviews_count
        : null,
      reviewCount: ce.reviews_count,
      onPromotion: ce.on_promotion,
    };
  }

  private toCartResult(cart: any, cartId: string): CartResult | null {
    if (!cart) return null;
    return {
      cartId,
      cartUrl: this.getCartUrl(cartId),
      items: (cart.items || []).map((item: any) => ({
        productId: item.product_id,
        variantId: item.variant_id,
        name: item.name || '',
        quantity: item.quantity || 1,
        price: item.selling_price || item.price || 0,
      })),
      total: cart.total || cart.grand_total || 0,
      currency: cart.currency || 'INR',
    };
  }
}

// --- Factory ---

export function createCommerceEngineAdapter(config: {
  storeId: string;
  apiKey: string;
  environment?: 'staging' | 'production';
  siteUrl: string;
}): CommerceEngineAdapter {
  return new CommerceEngineAdapter({
    storeId: config.storeId,
    apiKey: config.apiKey,
    environment: config.environment || 'production',
    siteUrl: config.siteUrl,
  });
}
