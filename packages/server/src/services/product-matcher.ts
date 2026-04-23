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

// Common words to ignore during keyword matching
const STOPWORDS = new Set([
  'hai', 'hori', 'hora', 'hona', 'kya', 'mujhe', 'krna', 'chayie', 'yeh',
  'aur', 'bhi', 'toh', 'kar', 'tha', 'thi', 'the', 'main', 'mera', 'mere',
  'aap', 'tum', 'hum', 'koi', 'kuch', 'abhi', 'nahi', 'nhi', 'use', 'ise',
  'and', 'for', 'are', 'but', 'not', 'you', 'can', 'has', 'how', 'its',
  'new', 'see', 'any', 'hey', 'din', 'dino', 'product', 'products', 'lena',
  'chahiye', 'chayie', 'batao', 'suggest', 'recommend', 'chahta', 'chahti',
]);

// Symptom → product keyword mapping (Hindi + English)
const SYMPTOM_MAP: Record<string, string[]> = {
  // Hair
  'hairfall': ['biotin', 'hair'],
  'hair loss': ['biotin', 'hair'],
  'baal jhad': ['biotin', 'hair'],
  'baal tut': ['biotin', 'hair'],
  'baal gir': ['biotin', 'hair'],
  'baal': ['biotin', 'hair'],
  // Skin / Glow
  'skin': ['vitamin c', 'biotin', 'glow', 'collagen'],
  'glow': ['vitamin c', 'biotin', 'glow'],
  'chamak': ['vitamin c', 'glow'],
  'wrinkle': ['collagen'],
  'aging': ['collagen'],
  // Collagen — direct product intent
  'collagen': ['collagen', 'marine'],
  'marine collagen': ['collagen', 'marine'],
  'marine': ['collagen', 'marine'],
  'peptide': ['collagen', 'marine'],
  // Pain — highest priority
  'pain': ['pain', 'gel', 'tablet', 'instant ease', 'relief'],
  'dard': ['pain', 'gel', 'tablet', 'instant ease', 'relief'],
  'back pain': ['pain', 'gel', 'back', 'relief'],
  'kamar dard': ['pain', 'gel', 'back', 'relief'],
  'kamar': ['pain', 'gel', 'back'],
  'sir dard': ['pain', 'tablet', 'headache'],
  'headache': ['pain', 'tablet'],
  'ghutne': ['pain', 'gel', 'joint'],
  'ghutne ka dard': ['pain', 'gel', 'joint'],
  'joint pain': ['pain', 'gel', 'joint'],
  'muscle pain': ['pain', 'gel', 'spray', 'muscle'],
  'body pain': ['pain', 'tablet', 'gel'],
  'sardar': ['pain', 'tablet'],
  // Gut / Digestion
  'gut': ['detox', 'acv', 'digestion'],
  'digestion': ['detox', 'acv', 'gut'],
  'bloating': ['detox', 'acv', 'gut'],
  'pet': ['detox', 'gut'],
  'constipation': ['detox', 'gut'],
  'detox': ['detox', 'candy', 'liver'],
  'motapa': ['acv', 'weight'],
  'weight': ['acv', 'weight'],
  // Energy / Immunity
  'energy': ['multivitamin', 'energy'],
  'tired': ['multivitamin', 'energy'],
  'thakan': ['multivitamin', 'energy'],
  'kamzori': ['multivitamin', 'energy'],
  'immunity': ['multivitamin', 'vitamin c', 'immunity'],
  // Sleep / Stress
  'sleep': ['sleep', 'ashwagandha', 'melatonin'],
  'neend': ['sleep', 'ashwagandha', 'melatonin'],
  'insomnia': ['sleep', 'melatonin'],
  'stress': ['ashwagandha', 'sleep'],
  'anxiety': ['ashwagandha', 'sleep'],
  'tension': ['ashwagandha', 'sleep'],
};

export async function matchProducts(
  userMessage: string,
  merchantId: string
): Promise<MatchedProduct[]> {
  try {
    const searchResults = await callVectorSearch(userMessage, merchantId);
    if (searchResults.length > 0) return searchResults;
  } catch {
    console.warn('[ProductMatcher] AI service unavailable, using keyword fallback');
  }
  return keywordMatch(userMessage, merchantId);
}

async function callVectorSearch(query: string, merchantId: string): Promise<MatchedProduct[]> {
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
    const product = await prisma.product.findUnique({ where: { id: result.product_id } });
    if (product?.isActive) {
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

async function keywordMatch(userMessage: string, merchantId: string): Promise<MatchedProduct[]> {
  const lower = userMessage.toLowerCase();
  const allProducts = await prisma.product.findMany({ where: { merchantId, isActive: true } });

  // Step 1: find which product IDs match via symptom map (high precision)
  const symptomMatchIds = new Set<string>();
  const symptomReasons: Record<string, string> = {};

  for (const [symptom, keywords] of Object.entries(SYMPTOM_MAP)) {
    if (!lower.includes(symptom)) continue;
    for (const product of allProducts) {
      const tags = safeParseJson(product.tags);
      const useCases = safeParseJson(product.useCases);
      const name = product.name.toLowerCase();
      const desc = product.description.toLowerCase();
      const cat = (product.category || '').toLowerCase();
      const allTerms = [...tags, ...useCases, name, cat, desc].join(' ').toLowerCase();

      if (keywords.some((kw) => allTerms.includes(kw))) {
        symptomMatchIds.add(product.id);
        if (!symptomReasons[product.id]) {
          symptomReasons[product.id] = `Recommended for: ${symptom}`;
        }
      }
    }
  }

  // Step 2: score all products
  const userWords = lower.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const scored = allProducts
    .map((product) => {
      const tags = safeParseJson(product.tags);
      const useCases = safeParseJson(product.useCases);
      const name = product.name.toLowerCase();
      const cat = (product.category || '').toLowerCase();

      let score = 0;
      let matchReason = '';

      // Symptom map match — highest priority
      if (symptomMatchIds.has(product.id)) {
        score += 3.0;
        matchReason = symptomReasons[product.id];
      }

      // Direct product name word match — user literally said the product name
      for (const word of userWords) {
        if (word.length > 3 && name.includes(word)) {
          score += 2.0;
          if (!matchReason) matchReason = `Matches product: ${product.name}`;
        }
      }

      // Direct tag / useCase match (filtered, length > 3, not a stopword)
      for (const term of [...tags, ...useCases]) {
        const t = term.toLowerCase();
        if (t.length > 3 && !STOPWORDS.has(t) && lower.includes(t)) {
          score += 0.5;
          if (!matchReason) matchReason = `Matched: ${term}`;
        }
      }

      // Exclude non-product items
      const excludeTerms = ['consultation', 'tshirt', 't-shirt', 'apparel'];
      if (excludeTerms.some((t) => name.includes(t) || cat.includes(t))) score = 0;

      return { product, score, matchReason: matchReason || 'General recommendation' };
    })
    .filter((p) => p.score >= 0.5)   // lower threshold — name matches always qualify
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
