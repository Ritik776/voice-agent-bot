/**
 * Universal Platform Adapter Interface
 * All e-commerce platform adapters (CommerceEngine, Shopify, WooCommerce, etc.) implement this.
 */

export interface PlatformProduct {
  externalId: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  url: string;
  imageUrl: string | null;
  category: string | null;
  tags: string[];
  variants: Array<{
    id: string;
    name: string;
    price: number;
    inStock: boolean;
  }>;
  inStock: boolean;
  rating: number | null;
  reviewCount: number;
  onPromotion: boolean;
}

export interface CartResult {
  cartId: string;
  cartUrl: string;
  items: Array<{
    productId: string;
    variantId?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  currency: string;
}

export interface PlatformAdapter {
  /** Platform identifier — 'commercengine' | 'shopify' | 'woocommerce' | 'generic' */
  readonly platform: string;

  /** Fetch all products from the platform */
  fetchAllProducts(): Promise<PlatformProduct[]>;

  /** Search products on the platform (if supported) */
  searchProducts(query: string, limit?: number): Promise<PlatformProduct[]>;

  /** Get a single product by external ID */
  getProduct(externalId: string): Promise<PlatformProduct | null>;

  /** Get product page URL */
  getProductUrl(slug: string): string;

  /** Create a new cart and return cart ID */
  createCart(): Promise<string>;

  /** Add item to cart */
  addToCart(cartId: string, productId: string, variantId: string | null, quantity?: number): Promise<CartResult | null>;

  /** Apply coupon/discount code to cart */
  applyCoupon(cartId: string, couponCode: string): Promise<CartResult | null>;

  /** Get cart URL for checkout redirect */
  getCartUrl(cartId?: string): string;
}

/**
 * Platform config stored per merchant.
 * Each platform has its own required fields.
 */
export interface PlatformConfig {
  platform: string;

  // CommerceEngine
  ceStoreId?: string;
  ceApiKey?: string;
  ceEnvironment?: 'staging' | 'production';
  ceSiteUrl?: string;

  // Shopify (future)
  shopifyDomain?: string;
  shopifyAccessToken?: string;

  // WooCommerce (future)
  wooUrl?: string;
  wooConsumerKey?: string;
  wooConsumerSecret?: string;
}
