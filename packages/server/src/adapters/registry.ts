/**
 * Adapter Registry
 * Creates the right platform adapter based on merchant config.
 * Add new platforms here as they're built.
 */

import { PlatformAdapter, PlatformConfig } from './base';
import { CommerceEngineAdapter } from './commercengine';

// Cache adapters per merchant to reuse auth tokens
const adapterCache = new Map<string, PlatformAdapter>();

export function getAdapter(merchantId: string, platformConfig: PlatformConfig): PlatformAdapter {
  // Return cached adapter if exists
  const cached = adapterCache.get(merchantId);
  if (cached) return cached;

  const adapter = createAdapter(platformConfig);
  adapterCache.set(merchantId, adapter);
  return adapter;
}

export function clearAdapterCache(merchantId?: string): void {
  if (merchantId) {
    adapterCache.delete(merchantId);
  } else {
    adapterCache.clear();
  }
}

function createAdapter(config: PlatformConfig): PlatformAdapter {
  switch (config.platform) {
    case 'commercengine':
      if (!config.ceStoreId || !config.ceApiKey || !config.ceSiteUrl) {
        throw new Error('CommerceEngine adapter requires ceStoreId, ceApiKey, and ceSiteUrl');
      }
      return new CommerceEngineAdapter({
        storeId: config.ceStoreId,
        apiKey: config.ceApiKey,
        environment: config.ceEnvironment || 'production',
        siteUrl: config.ceSiteUrl,
      });

    // Future platforms:
    // case 'shopify':
    //   return new ShopifyAdapter({ ... });
    // case 'woocommerce':
    //   return new WooCommerceAdapter({ ... });

    case 'generic':
      throw new Error('Generic platform uses seed data only — no adapter needed');

    default:
      throw new Error(`Unknown platform: ${config.platform}`);
  }
}
