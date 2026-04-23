import { prisma } from '../db';
import { llmService } from './llm';
import { matchProducts } from './product-matcher';

// --- State Machine ---

enum ConversationState {
  IDLE = "IDLE",
  GREETING = "GREETING",
  CONSENT = "CONSENT",
  DISCOVERY = "DISCOVERY",
  RECOMMENDATION = "RECOMMENDATION",
  EDUCATION = "EDUCATION",
  OBJECTION_HANDLING = "OBJECTION_HANDLING",
  CLOSING = "CLOSING",
  SUCCESS = "SUCCESS",
  SOFT_EXIT = "SOFT_EXIT",
}

const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.IDLE]: [ConversationState.GREETING],
  [ConversationState.GREETING]: [ConversationState.CONSENT, ConversationState.DISCOVERY, ConversationState.RECOMMENDATION],
  [ConversationState.CONSENT]: [ConversationState.DISCOVERY, ConversationState.SOFT_EXIT],
  [ConversationState.DISCOVERY]: [ConversationState.RECOMMENDATION, ConversationState.DISCOVERY],
  [ConversationState.RECOMMENDATION]: [
    ConversationState.EDUCATION,
    ConversationState.OBJECTION_HANDLING,
    ConversationState.CLOSING,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.EDUCATION]: [
    ConversationState.CLOSING,
    ConversationState.OBJECTION_HANDLING,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.OBJECTION_HANDLING]: [
    ConversationState.CLOSING,
    ConversationState.EDUCATION,
    ConversationState.SOFT_EXIT,
  ],
  [ConversationState.CLOSING]: [
    ConversationState.SUCCESS,
    ConversationState.SOFT_EXIT,
    ConversationState.DISCOVERY,
  ],
  [ConversationState.SUCCESS]: [ConversationState.DISCOVERY],
  [ConversationState.SOFT_EXIT]: [ConversationState.DISCOVERY],
};

// --- Sales Persona Prompt Builder ---

function buildSystemPrompt(
  merchantName: string,
  currentState: ConversationState,
  detectedLanguage: string | null,
  productsShown: string[],
  identifiedNeeds: string[],
  objections: string[]
): string {
  const allowedTransitions = TRANSITIONS[currentState] || [];

  return `You are Priya — a warm, knowledgeable female wellness consultant for ${merchantName}.

## Your identity (IMPORTANT)
- You are FEMALE. Always use female Hindi grammar without exception.
- Say "kar rahi hoon", "bata rahi hoon", "samajh rahi hoon" — NEVER "kar raha hoon"
- Say "main Priya hoon" — not "main Priya hun" or "hoon main"
- Use "mujhe lagta hai", "main soch rahi hoon" etc. — always female forms
- Your name is Priya

## Your personality
- Warm and empathetic — you genuinely care about the customer's health
- Knowledgeable but not preachy — share advice like a trusted friend
- Patient — never rush the customer
- Honest — never make claims the products don't support
- Multilingual — match the customer's language naturally

## Language rules
- If the customer speaks Hindi, respond in Hindi
- If they mix Hindi + English (Hinglish), respond in Hinglish
- If they speak English, respond in English
- Keep responses conversational, not formal
- Be concise — max 3-4 sentences per response

## PRODUCT CARD SYSTEM — READ THIS CAREFULLY
When you output [STATE:RECOMMENDATION], the UI automatically displays product cards showing:
- Product image, name, price, key selling points, and a "View Product" button

You do NOT need to list products, describe them, or share URLs in your text.
Just write a short 1-sentence intro ("Yeh rahi kuch options jo aapke liye sahi ho sakti hain:") and output [STATE:RECOMMENDATION].
NEVER describe products in bullet points. NEVER make up product details. Cards handle everything.

## Conversation flow — follow this strictly
- GREETING: Greet warmly. Ask what brought them here. DO NOT mention any product names yet.
- CONSENT: Ask if they'd like your help. DO NOT name or hint at any product.
- DISCOVERY: Ask at most ONE follow-up question. If user already named a product or said what they want, skip straight to RECOMMENDATION.
- RECOMMENDATION: Write ONE short sentence, then output [STATE:RECOMMENDATION]. The UI shows the cards.
- EDUCATION: Explain ONE benefit from the product's selling points when asked. Keep it to 2 sentences max.
- OBJECTION_HANDLING: Address concerns with empathy — price (value per day), trust (pharma backing, awards), urgency (limited offer).
- CLOSING: Gently ask "Aap chahein toh main link share karun?"

## Fast-track to RECOMMENDATION (IMPORTANT)
Skip DISCOVERY entirely and output [STATE:RECOMMENDATION] immediately if the user:
- Mentions a specific product by name (e.g., "marine collagen", "instant ease", "soothing gel")
- Uses show-intent words: "dikha", "dikhao", "show", "product chahiye", "lena hai", "kharidna"
- Has already described their problem in a previous message and now says "yes", "haan", "theek hai", "okay"
Do NOT ask more questions. Show products immediately.

## Things you NEVER do
- NEVER describe a product not in the PRODUCT CATALOG below — no "herbal supplement", no "ayurvedic medicine", nothing generic
- NEVER invent ingredients, benefits, or usage instructions — only use what's in the product's description and selling points
- Never claim a product cures diseases
- Never push after the customer says no
- Never share other customers' information
- Never badmouth competitor products by name
- Never give medical advice — suggest consulting a doctor for serious issues

## Current conversation context
- State: ${currentState}
- Language: ${detectedLanguage || 'auto-detect'}
- Products discussed: ${productsShown.length > 0 ? productsShown.join(', ') : 'none yet'}
- Customer's needs: ${identifiedNeeds.length > 0 ? identifiedNeeds.join(', ') : 'not identified yet'}
- Objections raised: ${objections.length > 0 ? objections.join(', ') : 'none'}

## State transition instructions
You are currently in the ${currentState} state.
Allowed next states: ${allowedTransitions.join(', ')}

At the END of your response, on a new line, output EXACTLY one of these state tags to indicate the next state:
${allowedTransitions.map((s) => `[STATE:${s}]`).join(' or ')}

If you want to stay in the current state, output [STATE:${currentState}] (only if ${currentState} is in the allowed list).

Rules for state transitions:
- GREETING → CONSENT: after initial greeting, ask for consent
- GREETING → DISCOVERY: if user jumps straight to a question
- CONSENT → DISCOVERY: user agrees to chat
- CONSENT → SOFT_EXIT: user declines
- DISCOVERY → RECOMMENDATION: needs identified, products matched
- DISCOVERY → DISCOVERY: need more info from user
- RECOMMENDATION → EDUCATION: user is interested, wants to know more
- RECOMMENDATION → OBJECTION_HANDLING: user objects (price, trust, need)
- RECOMMENDATION → CLOSING: user wants to buy
- RECOMMENDATION → DISCOVERY: user asks about something else
- EDUCATION → CLOSING: user is convinced
- EDUCATION → OBJECTION_HANDLING: user raises concern
- OBJECTION_HANDLING → CLOSING: objection resolved
- OBJECTION_HANDLING → SOFT_EXIT: user firmly declines
- CLOSING → SUCCESS: user agrees to purchase
- CLOSING → SOFT_EXIT: user declines to purchase
- CLOSING → DISCOVERY: user wants to explore other products`;
}

// --- Parse state from LLM response ---

function parseStateFromResponse(
  response: string,
  currentState: ConversationState
): { message: string; nextState: ConversationState } {
  const stateRegex = /\[STATE:\s*(\w+)\]\s*$/;
  const match = response.match(stateRegex);

  let nextState = currentState;
  let message = response;

  if (match) {
    const parsed = match[1] as ConversationState;
    message = response.replace(/\[STATE:\s*\w+\]/gi, '').trim();

    // Validate transition
    const allowed = TRANSITIONS[currentState];
    if (allowed && allowed.includes(parsed)) {
      nextState = parsed;
    } else {
      console.warn(
        `[Conversation] Invalid transition ${currentState} → ${parsed}, staying in ${currentState}`
      );
    }
  }

  return { message, nextState };
}

// --- Extract context from conversation history ---

function extractContext(messages: Array<{ role: string; content: string }>) {
  const productsShown: string[] = [];
  const identifiedNeeds: string[] = [];
  const objections: string[] = [];

  const needKeywords = [
    'hairfall', 'hair', 'baal', 'skin', 'glow', 'pain', 'dard',
    'gut', 'detox', 'energy', 'tired', 'thakan', 'collagen',
  ];
  const objectionKeywords = [
    'mehnga', 'expensive', 'costly', 'kaam karega', 'will it work',
    'sochna', 'think', 'nahi chahiye', 'not now', 'competitor',
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      const lower = msg.content.toLowerCase();
      for (const kw of needKeywords) {
        if (lower.includes(kw) && !identifiedNeeds.includes(kw)) {
          identifiedNeeds.push(kw);
        }
      }
      for (const kw of objectionKeywords) {
        if (lower.includes(kw) && !objections.includes(kw)) {
          objections.push(kw);
        }
      }
    }
  }

  return { productsShown, identifiedNeeds, objections };
}

// --- Public API ---

interface ProcessMessageResult {
  message: string;
  products?: Array<{
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
  }>;
  state: string;
  language: string | null;
}

export async function processMessage(
  conversationId: string,
  message: string,
  language?: string
): Promise<ProcessMessageResult> {
  // Load conversation with messages
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      merchant: true,
    },
  });

  const currentState = conversation.state as ConversationState;
  const detectedLanguage = language || conversation.language;

  // Save user message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: message,
    },
  });

  // Load previously matched products from conversation metadata
  const convMeta = JSON.parse(conversation.metadata || '{}');
  let persistedProducts: ProcessMessageResult['products'] = convMeta.matchedProducts || undefined;

  // Always attempt product matching — state doesn't matter, user can ask at any point
  let matchedProducts: ProcessMessageResult['products'] = persistedProducts;
  const notYetRecommended = currentState !== ConversationState.SUCCESS;
  if (notYetRecommended) {
    const products = await matchProducts(message, conversation.merchantId);
    if (products.length > 0) {
      matchedProducts = products;
      persistedProducts = products;
    }
  }

  // Build conversation history for LLM
  const history = conversation.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Extract context
  const context = extractContext([...history, { role: 'user', content: message }]);

  // Build merchant name from config or DB
  const merchantConfig = JSON.parse(conversation.merchant.config || '{}');
  const merchantName = merchantConfig.name || conversation.merchant.name;

  // Build system prompt
  const systemPrompt = buildSystemPrompt(
    merchantName,
    currentState,
    detectedLanguage,
    context.productsShown,
    context.identifiedNeeds,
    context.objections
  );

  // Inject product context for all post-discovery states
  const postDiscoveryStates = [
    ConversationState.RECOMMENDATION,
    ConversationState.EDUCATION,
    ConversationState.OBJECTION_HANDLING,
    ConversationState.CLOSING,
    ConversationState.SUCCESS,
  ];
  let productContext = '';
  if (matchedProducts && matchedProducts.length > 0) {
    productContext = '\n\n## PRODUCT CATALOG — ONLY discuss these products. Do NOT mention, invent, or describe any other product, supplement, or remedy.\n';
    for (const p of matchedProducts) {
      productContext += `\n### ${p.name} (₹${p.price})`;
      productContext += `\n${p.description}`;
      if (p.sellingPoints?.length > 0) {
        productContext += `\nKey selling points: ${p.sellingPoints.join(' | ')}`;
      }
      productContext += `\nProduct URL: ${p.url}`;
      productContext += `\nWhy it matches: ${p.matchReason}\n`;
    }
    productContext += '\n\n⚠️ STRICT RULE: You must ONLY describe the products listed above. Use their exact names, prices, and selling points. Never say "herbal supplement", "ayurvedic medicine", or make up any ingredient/benefit not listed above.';
  }

  const fullSystemPrompt = systemPrompt + productContext;

  // Call LLM
  const llmResponse = await llmService.generateResponse(
    fullSystemPrompt,
    history,
    message
  );

  // Parse state transition from response
  const { message: botMessage, nextState: parsedState } = parseStateFromResponse(
    llmResponse,
    currentState
  );
  let nextState = parsedState;

  // Server-side override: if user says "show product" in any form, force RECOMMENDATION
  const showIntentWords = ['dikha', 'dikhao', 'show', 'product de', 'products de', 'lena hai', 'buy', 'kharid', 'dekh', 'de na', 'bata', 'kaunsa'];
  const lowerMsg = message.toLowerCase();
  if (showIntentWords.some((w) => lowerMsg.includes(w)) && matchedProducts && matchedProducts.length > 0) {
    // Force RECOMMENDATION regardless of FSM state — user has explicitly asked to see products
    nextState = ConversationState.RECOMMENDATION;
  }

  // If entering RECOMMENDATION but products still empty, re-match using full conversation history
  if (nextState === ConversationState.RECOMMENDATION && !matchedProducts) {
    const allUserText = [
      ...history.filter((m) => m.role === 'user').map((m) => m.content),
      message,
    ].join(' ');
    const products = await matchProducts(allUserText, conversation.merchantId);
    if (products.length > 0) {
      matchedProducts = products;
      persistedProducts = products;
    }
  }

  // Save bot message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: botMessage,
      products: matchedProducts ? JSON.stringify(matchedProducts) : null,
    },
  });

  // Update conversation state, language, and persist matched products
  const updatedMeta = { ...convMeta };
  if (persistedProducts && persistedProducts.length > 0) {
    updatedMeta.matchedProducts = persistedProducts;
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      state: nextState,
      language: detectedLanguage || conversation.language,
      metadata: JSON.stringify(updatedMeta),
    },
  });

  // Only surface product cards in UI when entering RECOMMENDATION state
  const showProducts = nextState === ConversationState.RECOMMENDATION
    || currentState === ConversationState.RECOMMENDATION;

  return {
    message: botMessage,
    products: showProducts ? matchedProducts : undefined,
    state: nextState,
    language: detectedLanguage || conversation.language,
  };
}

export async function startConversation(
  merchantId: string,
  sessionId: string,
  metadata?: Record<string, unknown>
): Promise<{ conversationId: string; greeting: string; config: Record<string, unknown> }> {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { id: merchantId },
  });

  const config = JSON.parse(merchant.config || '{}');
  const greeting =
    config.greeting ||
    `Hi! I'm your wellness assistant at ${merchant.name}. Can I help you find the right product today?`;

  const conversation = await prisma.conversation.create({
    data: {
      merchantId,
      sessionId,
      state: ConversationState.GREETING,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  // Save greeting as first bot message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: greeting,
    },
  });

  return {
    conversationId: conversation.id,
    greeting,
    config,
  };
}
