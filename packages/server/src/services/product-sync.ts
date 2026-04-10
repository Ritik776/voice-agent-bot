/**
 * Product Sync Service
 * Fetches products from any platform adapter and upserts into local Prisma DB.
 * Works the same whether it's CommerceEngine, Shopify, or WooCommerce.
 */

import { prisma } from '../db';
import { PlatformAdapter, PlatformProduct, PlatformConfig } from '../adapters/base';
import { getAdapter } from '../adapters/registry';

interface SyncResult {
  merchantId: string;
  platform: string;
  productsFound: number;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

export async function syncProducts(merchantId: string): Promise<SyncResult> {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { id: merchantId },
  });

  const platformConfig: PlatformConfig = JSON.parse(merchant.platformConfig || '{}');

  if (!platformConfig.platform || platformConfig.platform === 'generic') {
    return {
      merchantId,
      platform: 'generic',
      productsFound: 0,
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: ['Generic platform uses seed data — no sync needed'],
    };
  }

  const adapter = getAdapter(merchantId, platformConfig);
  const result: SyncResult = {
    merchantId,
    platform: platformConfig.platform,
    productsFound: 0,
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: [],
  };

  let platformProducts: PlatformProduct[] = [];

  try {
    console.log(`[Sync] Fetching products from ${platformConfig.platform} for merchant ${merchant.name}...`);
    platformProducts = await adapter.fetchAllProducts();
    result.productsFound = platformProducts.length;
    console.log(`[Sync] Found ${platformProducts.length} products`);
  } catch (err: any) {
    result.errors.push(`Failed to fetch products: ${err.message}`);
    console.error(`[Sync] Fetch failed:`, err.message);
    return result;
  }

  // Track which external IDs we see — to deactivate removed products
  const seenExternalIds = new Set<string>();

  for (const pp of platformProducts) {
    seenExternalIds.add(pp.externalId);

    try {
      const existing = await prisma.product.findFirst({
        where: { merchantId, externalId: pp.externalId },
      });

      const productData = {
        name: pp.name,
        description: pp.description,
        price: pp.price,
        currency: pp.currency,
        url: pp.url,
        imageUrl: pp.imageUrl,
        category: pp.category,
        tags: JSON.stringify(pp.tags),
        useCases: JSON.stringify([]), // Will be enriched by AI later
        sellingPoints: JSON.stringify([]), // Will be enriched by AI later
        isActive: pp.inStock,
        externalId: pp.externalId,
      };

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: productData,
        });
        result.updated++;
      } else {
        await prisma.product.create({
          data: {
            ...productData,
            merchantId,
          },
        });
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`Product "${pp.name}": ${err.message}`);
    }
  }

  // Deactivate products that no longer exist on the platform
  if (seenExternalIds.size > 0) {
    const deactivated = await prisma.product.updateMany({
      where: {
        merchantId,
        externalId: { not: null },
        NOT: { externalId: { in: Array.from(seenExternalIds) } },
        isActive: true,
      },
      data: { isActive: false },
    });
    result.deactivated = deactivated.count;
  }

  // Update last sync timestamp
  await prisma.merchant.update({
    where: { id: merchantId },
    data: { lastSyncAt: new Date() },
  });

  console.log(`[Sync] Done: ${result.created} created, ${result.updated} updated, ${result.deactivated} deactivated`);
  return result;
}

/**
 * Get the platform adapter for a merchant (for cart/coupon operations during conversation)
 */
export function getMerchantAdapter(merchantId: string, platformConfig: string): PlatformAdapter | null {
  try {
    const config: PlatformConfig = JSON.parse(platformConfig || '{}');
    if (!config.platform || config.platform === 'generic') return null;
    return getAdapter(merchantId, config);
  } catch {
    return null;
  }
}
