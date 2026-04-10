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
  [ConversationState.GREETING]: [ConversationState.CONSENT, ConversationState.DISCOVERY],
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

  return `You are a friendly, knowledgeable wellness consultant for ${merchantName}.
You help customers find the right products by understanding their needs first.

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
- For other languages, respond in that language
- Keep responses conversational, not formal
- TEXT MODE: be concise, max 3-4 sentences per response

## Sales approach
1. LISTEN first — understand what they need
2. EDUCATE — explain the science/reason simply
3. RECOMMEND — suggest 1-2 products max (not 5)
4. CONSENT — "Kya main iske fayde bataun?" before deep-diving
5. HANDLE OBJECTIONS — with empathy, not aggression
   - Price objection → explain value per day, compare to alternatives
   - Trust objection → mention pharma backing, awards, reviews
   - Need objection → relate to their specific symptom
6. CLOSE gently — "Aap chahein toh main cart mein add kar dun?"
7. URGENCY (only if interest is dropping) — "Aapke liye ek special offer hai, limited time..."

## Things you NEVER do
- Never make up product information
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
  const stateRegex = /\[STATE:(\w+)\]\s*$/;
  const match = response.match(stateRegex);

  let nextState = currentState;
  let message = response;

  if (match) {
    const parsed = match[1] as ConversationState;
    message = response.replace(stateRegex, '').trim();

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

  // Match products if in DISCOVERY or related states
  let matchedProducts: ProcessMessageResult['products'] = undefined;
  const discoveryStates: ConversationState[] = [
    ConversationState.DISCOVERY,
    ConversationState.GREETING,
    ConversationState.CONSENT,
  ];

  if (discoveryStates.includes(currentState)) {
    const products = await matchProducts(message, conversation.merchantId);
    if (products.length > 0) {
      matchedProducts = products;
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

  // Inject product context if we have matches
  let productContext = '';
  if (matchedProducts && matchedProducts.length > 0) {
    productContext = '\n\n## Available products matching this customer\'s needs:\n';
    for (const p of matchedProducts) {
      productContext += `\n### ${p.name} (₹${p.price})`;
      productContext += `\n${p.description}`;
      if (p.sellingPoints?.length > 0) {
        productContext += `\nSelling points: ${p.sellingPoints.join(', ')}`;
      }
      productContext += `\nURL: ${p.url}`;
      if (p.imageUrl) productContext += `\nImage: ${p.imageUrl}`;
      productContext += `\nMatch reason: ${p.matchReason}\n`;
    }
  }

  const fullSystemPrompt = systemPrompt + productContext;

  // Call LLM
  const llmResponse = await llmService.generateResponse(
    fullSystemPrompt,
    history,
    message
  );

  // Parse state transition from response
  const { message: botMessage, nextState } = parseStateFromResponse(
    llmResponse,
    currentState
  );

  // Save bot message
  await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: botMessage,
      products: matchedProducts ? JSON.stringify(matchedProducts) : null,
    },
  });

  // Update conversation state and language
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      state: nextState,
      language: detectedLanguage || conversation.language,
    },
  });

  return {
    message: botMessage,
    products: matchedProducts,
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
