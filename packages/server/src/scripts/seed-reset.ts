import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Reset Wellness data...');

  // Create merchant — uses CommerceEngine if CE env vars are set, otherwise generic with seed data
  const ceStoreId = process.env.CE_STORE_ID;
  const ceApiKey = process.env.CE_API_KEY;
  const hasCE = ceStoreId && ceApiKey;

  const merchant = await prisma.merchant.upsert({
    where: { domain: 'reset.in' },
    update: {
      platform: hasCE ? 'commercengine' : 'generic',
      platformConfig: hasCE
        ? JSON.stringify({
            platform: 'commercengine',
            ceStoreId,
            ceApiKey,
            ceEnvironment: process.env.CE_ENVIRONMENT || 'production',
            ceSiteUrl: process.env.CE_SITE_URL || 'https://reset.in',
          })
        : '{}',
    },
    create: {
      id: 'demo',
      name: 'Reset Wellness',
      domain: 'reset.in',
      platform: hasCE ? 'commercengine' : 'generic',
      apiKey: 'vs_demo_key_reset_wellness',
      config: JSON.stringify({
        name: 'Reset Wellness',
        greeting: 'Hi! I\'m your Reset Wellness assistant. How can I help you today? I can help you find the right product for your health needs.',
        tone: 'friendly',
        primaryColor: '#22c55e',
        position: 'bottom-right',
        triggers: [
          { type: 'time', delay: 3000 },
          { type: 'scroll', scrollPercent: 40 },
        ],
        enableCoupons: true,
        enableVoice: true,
      }),
      platformConfig: hasCE
        ? JSON.stringify({
            platform: 'commercengine',
            ceStoreId,
            ceApiKey,
            ceEnvironment: process.env.CE_ENVIRONMENT || 'production',
            ceSiteUrl: process.env.CE_SITE_URL || 'https://reset.in',
          })
        : '{}',
      couponRules: JSON.stringify({
        maxDiscountPercent: 15,
        minOrderValue: 500,
        validForHours: 24,
        maxUsage: 1,
        prefix: 'RESET',
      }),
    },
  });

  console.log(`Merchant created: ${merchant.name} (${merchant.id})`);

  if (hasCE) {
    console.log(`CommerceEngine configured (store: ${ceStoreId})`);
    // Delete old seed products (no externalId) — real CE data replaces them
    const deleted = await prisma.product.deleteMany({
      where: { merchantId: merchant.id, externalId: null },
    });
    if (deleted.count > 0) {
      console.log(`Cleaned up ${deleted.count} old seed products`);
    }
    // Auto-sync from CE
    const { syncProducts } = await import('../services/product-sync');
    const result = await syncProducts(merchant.id);
    console.log(`Synced ${result.productsFound} products from CE (${result.created} new, ${result.updated} updated)`);
  } else {
    // No CE — seed fallback products for demo
    console.log('No CE credentials — seeding demo products...');
    const products = [
      {
        name: 'Biotin Gummies',
        description: 'Boost your beauty from within with Biotin Gummies for glowing hair, skin & nails.',
        price: 199, url: 'https://reset.in/products/biotin-gummies', category: 'Glow',
        tags: ['biotin', 'hair', 'hairfall', 'nails', 'gummies', 'skin', 'glow'],
        useCases: ['hairfall', 'nail strength', 'hair growth', 'baal jharna', 'skin glow'],
        sellingPoints: ['Pharma-backed by Venus Remedies', 'Tasty gummy format', 'Visible results in 8 weeks'],
      },
      {
        name: 'Vitamin C Gummies',
        description: 'Tasty boost of Vitamin C for immune support, skin glow, and overall well-being.',
        price: 199, url: 'https://reset.in/products/vitamin-c-gummies', category: 'Glow',
        tags: ['vitamin c', 'immunity', 'skin', 'glow', 'antioxidant'],
        useCases: ['immunity', 'skin glow', 'cold prevention', 'vitamin deficiency'],
        sellingPoints: ['Powerful antioxidant', 'Supports immune system', 'Promotes skin health'],
      },
      {
        name: 'Instant Ease Tablets',
        description: 'Fast-acting pain relief tablets for body pain, headaches, and inflammation.',
        price: 369, url: 'https://reset.in/products/instant-ease-tablets', category: 'Pain Relief',
        tags: ['pain', 'headache', 'body pain', 'inflammation', 'tablets'],
        useCases: ['body pain', 'headache', 'sir dard', 'inflammation', 'dard', 'kamar dard'],
        sellingPoints: ['Anti-painkiller — works naturally', 'Fast-acting within 30 min', 'Backed by Venus Remedies'],
      },
      {
        name: 'Ultra Potent Pain Relief Gel',
        description: '2X more powerful formula for enhanced pain relief. Deep penetrating gel.',
        price: 599, url: 'https://reset.in/products/ultra-potent-gel', category: 'Pain Relief',
        tags: ['pain', 'gel', 'muscle', 'joint', 'topical', 'back pain'],
        useCases: ['muscle pain', 'joint pain', 'back pain', 'ghutne ka dard', 'kamar dard'],
        sellingPoints: ['2X more powerful', 'Deep penetrating formula', 'No sticky residue'],
      },
      {
        name: 'Detox Candy',
        description: 'Tasty guilt-free candy infused with five powerful herbs for natural cleansing.',
        price: 399, url: 'https://reset.in/products/detox-candyy', category: 'Liver Balance',
        tags: ['detox', 'gut', 'candy', 'digestive', 'liver', 'herbs'],
        useCases: ['gut health', 'detox', 'digestion', 'bloating', 'pet saaf', 'liver health'],
        sellingPoints: ['5 powerful herbs', 'Tasty candy format', 'Supports natural cleansing'],
      },
      {
        name: 'Multivitamin Gummies',
        description: 'Essential vitamins and minerals for energy, immune support, and overall health.',
        price: 419, url: 'https://reset.in/products/multivitamin-gummies', category: 'Immunity',
        tags: ['multivitamin', 'energy', 'immunity', 'gummies', 'vitamins', 'wellness'],
        useCases: ['daily wellness', 'energy boost', 'immunity', 'tiredness', 'thakan', 'kamzori'],
        sellingPoints: ['Complete daily nutrition', 'Tasty gummy format', 'Energy + immunity support'],
      },
      {
        name: 'Sleep Better Gummies',
        description: 'Ashwagandha + Melatonin gummies for relaxation and better sleep quality.',
        price: 479, url: 'https://reset.in/products/ashwagandha-melatonin-gummies', category: 'Sleep',
        tags: ['sleep', 'ashwagandha', 'melatonin', 'stress', 'relaxation'],
        useCases: ['insomnia', 'neend nahi aati', 'stress', 'anxiety', 'relaxation'],
        sellingPoints: ['Ashwagandha + Melatonin combo', 'Better sleep quality', 'Reduces stress naturally'],
      },
      {
        name: 'Healthy Gut Gummies',
        description: 'Apple cider vinegar gummies for digestion and weight support without the harsh taste.',
        price: 499, url: 'https://reset.in/products/apple-cider-vinegar-gummies', category: 'Weight Management',
        tags: ['acv', 'gut', 'digestion', 'weight', 'apple cider vinegar'],
        useCases: ['digestion', 'weight management', 'bloating', 'gut health', 'motapa'],
        sellingPoints: ['ACV without harsh taste', 'Supports digestion', 'Weight management support'],
      },
    ];

    for (const p of products) {
      await prisma.product.upsert({
        where: {
          id: `${merchant.id}_${p.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
        },
        update: {
          name: p.name, description: p.description, price: p.price, url: p.url,
          category: p.category, tags: JSON.stringify(p.tags),
          useCases: JSON.stringify(p.useCases), sellingPoints: JSON.stringify(p.sellingPoints),
        },
        create: {
          id: `${merchant.id}_${p.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
          merchantId: merchant.id, name: p.name, description: p.description, price: p.price,
          url: p.url, category: p.category, tags: JSON.stringify(p.tags),
          useCases: JSON.stringify(p.useCases), sellingPoints: JSON.stringify(p.sellingPoints),
        },
      });
      console.log(`  Product seeded: ${p.name} (₹${p.price})`);
    }
    console.log(`\nDone! ${products.length} products seeded.`);
  }
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
