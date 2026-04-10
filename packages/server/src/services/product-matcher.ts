import { prisma } from '../db';

interface MatchedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  url: string;
  imageUrl: string | null;
  sellingPoints: string[];
  relevanceScore: number;
  matchReason: string;
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export async function matchProducts(
  userMessage: string,
  merchantId: string
): Promise<MatchedProduct[]> {
  try {
    const searchResults = await callVectorSearch(userMessage, merchantId);
    if (searchResults.length > 0) {
      return searchResults;
    }
  } catch {
    console.warn('[ProductMatcher] AI service unavailable, using keyword fallback');
  }

  return keywordMatch(userMessage, merchantId);
}

async function callVectorSearch(
  query: string,
  merchantId: string
): Promise<MatchedProduct[]> {
  const res = await fetch(`${AI_SERVICE_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, merchant_id: merchantId, top_k: 3 }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`AI service returned ${res.status}`);

  const data = await res.json() as {
    results: Array<{ product_id: string; score: number; match_reason: string }>;
  };

  const products: MatchedProduct[] = [];
  for (const result of data.results) {
    const product = await prisma.product.findUnique({
      where: { id: result.product_id },
    });
    if (product && product.isActive) {
      products.push({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        url: product.url,
        imageUrl: product.imageUrl,
        sellingPoints: safeParseJson(product.sellingPoints),
        relevanceScore: result.score,
        matchReason: result.match_reason,
      });
    }
  }

  return products;
}

// Symptom/need → product keyword mapping (Hindi + English)
const SYMPTOM_MAP: Record<string, string[]> = {
  // Hair
  hairfall: ['biotin', 'hair'],
  'hair loss': ['biotin', 'hair'],
  'baal jhad': ['biotin', 'hair'],
  'baal tut': ['biotin', 'hair'],
  'baal gir': ['biotin', 'hair'],
  // Skin / Glow
  skin: ['vitamin c', 'biotin', 'glow', 'collagen'],
  glow: ['vitamin c', 'biotin', 'glow'],
  chamak: ['vitamin c', 'glow'],
  wrinkle: ['collagen'],
  aging: ['collagen'],
  // Pain
  pain: ['pain', 'gel', 'spray', 'tablet', 'instant ease'],
  dard: ['pain', 'gel', 'spray', 'tablet', 'instant ease'],
  'kamar dard': ['pain', 'gel', 'back'],
  'back pain': ['pain', 'gel', 'back'],
  'sir dard': ['pain', 'tablet', 'headache'],
  headache: ['pain', 'tablet'],
  'ghutne ka dard': ['pain', 'gel', 'joint'],
  'joint pain': ['pain', 'gel', 'joint'],
  'muscle pain': ['pain', 'gel', 'spray', 'sports'],
  'sports injury': ['spray', 'gel', 'sports'],
  // Gut / Digestion
  gut: ['detox', 'acv', 'gut', 'digestion'],
  digestion: ['detox', 'acv', 'gut'],
  bloating: ['detox', 'acv', 'gut'],
  'pet saaf': ['detox', 'gut'],
  constipation: ['detox', 'gut'],
  detox: ['detox', 'candy', 'liver'],
  motapa: ['acv', 'weight'],
  weight: ['acv', 'weight'],
  // Energy / Immunity
  energy: ['multivitamin', 'energy'],
  tired: ['multivitamin', 'energy'],
  thakan: ['multivitamin', 'energy'],
  kamzori: ['multivitamin', 'energy'],
  immunity: ['multivitamin', 'vitamin c', 'immunity'],
  // Sleep / Stress
  sleep: ['sleep', 'ashwagandha', 'melatonin'],
  neend: ['sleep', 'ashwagandha', 'melatonin'],
  insomnia: ['sleep', 'melatonin'],
  stress: ['ashwagandha', 'sleep'],
  anxiety: ['ashwagandha', 'sleep'],
  tension: ['ashwagandha', 'sleep'],
  // Yoga / Wellness
  yoga: ['stretch', 'yoga', 'oil'],
  stretch: ['stretch', 'oil', 'yoga'],
};

async function keywordMatch(
  userMessage: string,
  merchantId: string
): Promise<MatchedProduct[]> {
  const lower = userMessage.toLowerCase();

  const allProducts = await prisma.product.findMany({
    where: { merchantId, isActive: true },
  });

  const scored = allProducts
    .map((product) => {
      const tags: string[] = safeParseJson(product.tags);
      const useCases: string[] = safeParseJson(product.useCases);
      const nameLower = product.name.toLowerCase();
      const descLower = product.description.toLowerCase();
      const categoryLower = (product.category || '').toLowerCase();

      const searchTerms = [...tags, ...useCases, nameLower, categoryLower];

      let score = 0;
      let matchReason = '';

      // Direct term match in product data
      for (const term of searchTerms) {
        if (term && lower.includes(term.toLowerCase())) {
          score += 0.4;
          matchReason = `Matched: ${term}`;
        }
      }

      // Check if user message words appear in product name/description
      const words = lower.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) {
        if (nameLower.includes(word)) {
          score += 0.5;
          if (!matchReason) matchReason = `Name match: ${word}`;
        }
        if (descLower.includes(word)) {
          score += 0.2;
          if (!matchReason) matchReason = `Description match: ${word}`;
        }
        if (categoryLower.includes(word)) {
          score += 0.3;
          if (!matchReason) matchReason = `Category: ${product.category}`;
        }
      }

      // Symptom-to-product mapping (Hindi + English)
      for (const [symptom, keywords] of Object.entries(SYMPTOM_MAP)) {
        if (lower.includes(symptom)) {
          for (const kw of keywords) {
            if (searchTerms.some((t) => t.toLowerCase().includes(kw)) ||
                nameLower.includes(kw) || descLower.includes(kw)) {
              score += 0.3;
              if (!matchReason) matchReason = `Recommended for: ${symptom}`;
            }
          }
        }
      }

      // Exclude consultations and non-product items from recommendations
      const excludeTerms = ['consultation', 'tshirt', 't-shirt', 'zensip', 'apparel'];
      if (excludeTerms.some((t) => nameLower.includes(t) || categoryLower.includes(t))) {
        score = 0;
      }

      return { product, score, matchReason: matchReason || 'General recommendation' };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map(({ product, score, matchReason }) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    currency: product.currency,
    url: product.url,
    imageUrl: product.imageUrl,
    sellingPoints: safeParseJson(product.sellingPoints),
    relevanceScore: score,
    matchReason,
  }));
}

function safeParseJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
