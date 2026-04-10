import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { syncProducts, getMerchantAdapter } from '../services/product-sync';

export const merchantRouter = Router();

// GET /api/v1/merchant/:id/config
merchantRouter.get('/:id/config', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
    });

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const config = JSON.parse(merchant.config || '{}');

    res.json({
      merchantId: merchant.id,
      name: merchant.name,
      domain: merchant.domain,
      platform: merchant.platform,
      config: {
        greeting: config.greeting || `Hi! I'm your assistant at ${merchant.name}. Can I help you?`,
        tone: config.tone || 'friendly',
        primaryColor: config.primaryColor || '#2563eb',
        position: config.position || 'bottom-right',
        triggers: config.triggers || [
          { type: 'time', delay: 5000 },
          { type: 'scroll', scrollPercent: 40 },
          { type: 'exit_intent' },
        ],
        enableCoupons: config.enableCoupons ?? false,
        enableVoice: config.enableVoice ?? false,
      },
    });
  } catch (error) {
    console.error('[Route] /merchant/:id/config error:', error);
    res.status(500).json({ error: 'Failed to fetch merchant config' });
  }
});

// POST /api/v1/merchant/:id/sync — Trigger product sync from platform
merchantRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
    });

    if (!merchant) {
      res.status(404).json({ error: 'Merchant not found' });
      return;
    }

    const result = await syncProducts(merchant.id);
    res.json(result);
  } catch (error: any) {
    console.error('[Route] /merchant/:id/sync error:', error);
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

// GET /api/v1/merchant/:id/products — List synced products
merchantRouter.get('/:id/products', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { merchantId: req.params.id, isActive: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        url: p.url,
        imageUrl: p.imageUrl,
        category: p.category,
      })),
    });
  } catch (error) {
    console.error('[Route] /merchant/:id/products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/v1/merchant/:id/cart — Create cart + add item
merchantRouter.post('/:id/cart', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    const adapter = getMerchantAdapter(merchant.id, merchant.platformConfig);
    if (!adapter) {
      res.status(400).json({ error: 'No platform adapter configured for this merchant' });
      return;
    }

    const { productId, variantId, quantity } = req.body;
    const cartId = await adapter.createCart();
    const cart = await adapter.addToCart(cartId, productId, variantId || null, quantity || 1);

    res.json({ cartId, cart, cartUrl: adapter.getCartUrl(cartId) });
  } catch (error: any) {
    console.error('[Route] /merchant/:id/cart error:', error);
    res.status(500).json({ error: error.message || 'Cart operation failed' });
  }
});

// POST /api/v1/merchant/:id/cart/:cartId/coupon — Apply coupon
merchantRouter.post('/:id/cart/:cartId/coupon', async (req: Request, res: Response) => {
  try {
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { id: req.params.id },
    });

    const adapter = getMerchantAdapter(merchant.id, merchant.platformConfig);
    if (!adapter) {
      res.status(400).json({ error: 'No platform adapter configured' });
      return;
    }

    const { couponCode } = req.body;
    const cart = await adapter.applyCoupon(req.params.cartId, couponCode);

    res.json({ cart });
  } catch (error: any) {
    console.error('[Route] coupon error:', error);
    res.status(500).json({ error: error.message || 'Coupon failed' });
  }
});
