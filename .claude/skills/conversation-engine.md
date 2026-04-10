# Conversation Engine — Sales Bot Brain

## State machine

Every conversation follows this state machine. States are stored in the database. Transitions are explicit — no implicit jumps.

```
                    ┌─────────────┐
                    │   IDLE      │ (widget loaded, no interaction)
                    └──────┬──────┘
                           │ user clicks widget / trigger fires
                           ▼
                    ┌─────────────┐
                    │  GREETING   │ "Hi! Can I help you find the right product?"
                    └──────┬──────┘
                           │ user says yes / asks a question
                           ▼
                    ┌─────────────┐
                    │  CONSENT    │ "Would you like me to guide you? I can help with voice too"
                    └──────┬──────┘
                           │ user consents
                           ▼
                    ┌─────────────┐
              ┌───► │  DISCOVERY  │ ◄───── user asks new question
              │     │             │ Bot asks about needs, symptoms, goals
              │     └──────┬──────┘
              │            │ needs identified, products matched
              │            ▼
              │     ┌──────────────────┐
              │     │ RECOMMENDATION   │ Bot presents 1-2 products
              │     │                  │ Explains WHY this product fits
              │     └──────┬───────────┘
              │            │
              │     ┌──────┴──────────────────┐
              │     │                         │
              │     ▼                         ▼
              │ User interested          User objects
              │     │                         │
              │     ▼                         ▼
              │ ┌───────────────┐    ┌────────────────┐
              │ │ EDUCATION     │    │ OBJECTION      │
              │ │               │    │ HANDLING        │
              │ │ Deep dive:    │    │                 │
              │ │ benefits,     │    │ "bahut mehnga"  │
              │ │ how to use,   │    │ → explain value │
              │ │ when to take, │    │ → offer bundle  │
              │ │ expected      │    │ → last: coupon  │
              │ │ results       │    └────────┬───────┘
              │ └──────┬────────┘             │
              │        │                      │
              │        ▼                      ▼
              │ ┌──────────────────────────────────┐
              │ │ CLOSING                          │
              │ │                                  │
              │ │ "Shall I add this to your cart?" │
              │ │ OR generate purchase link        │
              │ │ OR apply coupon + link           │
              │ └──────┬───────────────────────────┘
              │        │
              │   ┌────┴────────────┐
              │   │                 │
              │   ▼                 ▼
              │ User buys      User declines
              │   │                 │
              │   ▼                 ▼
              │ ┌─────────┐  ┌─────────────┐
              │ │ SUCCESS  │  │ SOFT_EXIT   │
              │ │ "Great   │  │ "No problem!│
              │ │ choice!" │  │ Browse at   │
              │ └──────────┘  │ your pace"  │
              │               └──────┬──────┘
              │                      │ user asks another question
              └──────────────────────┘
```

## State definitions

```typescript
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

// Allowed transitions — enforce this strictly
const TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  IDLE: ["GREETING"],
  GREETING: ["CONSENT", "DISCOVERY"],  // skip consent if user jumps to question
  CONSENT: ["DISCOVERY", "SOFT_EXIT"],
  DISCOVERY: ["RECOMMENDATION", "DISCOVERY"],  // can loop in discovery
  RECOMMENDATION: ["EDUCATION", "OBJECTION_HANDLING", "CLOSING", "DISCOVERY"],
  EDUCATION: ["CLOSING", "OBJECTION_HANDLING", "DISCOVERY"],
  OBJECTION_HANDLING: ["CLOSING", "EDUCATION", "SOFT_EXIT"],
  CLOSING: ["SUCCESS", "SOFT_EXIT", "DISCOVERY"],
  SUCCESS: ["DISCOVERY"],  // user might want another product
  SOFT_EXIT: ["DISCOVERY"],  // user might re-engage
};
```

## Sales persona system prompt

This is the master prompt sent to Gemini with every message. It defines WHO the bot is.

```
You are a friendly, knowledgeable wellness consultant for {merchant_name}. 
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
- VOICE MODE: max 2-3 SHORT sentences. Nobody wants to listen to a speech.
- TEXT MODE: can be slightly longer, but still concise.

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
- State: {current_state}
- Language: {detected_language}
- Products discussed: {products_shown}
- Customer's needs: {identified_needs}
- Objections raised: {objections}
```

## Product matching logic

```typescript
async function matchProducts(
  userMessage: string,
  merchantId: string,
  conversationHistory: Message[]
): Promise<MatchedProduct[]> {
  
  // 1. Extract intent/symptoms from the message
  // "mere hairfall ho raha hai, skin bhi dull hori hai"
  // → intents: ["hairfall", "skin dullness"]
  
  // 2. Search vector DB for each intent
  // ChromaDB similarity search on product useCases + tags
  // → Biotin Gummies (score: 0.92 for hairfall)
  // → Marine Collagen (score: 0.89 for skin)
  // → Multivitamin (score: 0.71 for both)
  
  // 3. Rank by relevance score + product priority
  // Priority: merchant can set priority products in dashboard
  
  // 4. Return top 2-3 matches with:
  // - Product details (name, price, description, image)
  // - Match reason ("Recommended for hairfall")
  // - Selling points relevant to this user's need
  
  // 5. NEVER return more than 3 products
  // Paradox of choice — too many options = no purchase
}
```

## Objection handling playbook

The LLM handles objections, but we provide it with specific strategies via the prompt:

| Objection | Strategy | Example response |
|-----------|----------|------------------|
| "Bahut mehnga hai" (Too expensive) | Break down cost per day, compare to daily chai | "Ye daily sirf ₹17 aata hai — ek chai se bhi kam. Aur results 8 weeks mein dikhte hain" |
| "Kaam karega?" (Will it work?) | Social proof + pharma backing | "Venus Remedies ka pharma-backed formula hai, 10,000+ customers use kar rahe hain. 30 din try karke dekhiye" |
| "Sochna padega" (Need to think) | Offer to help, don't push | "Bilkul, aap sochiye! Agar koi sawaal ho toh main yahan hoon. Aur haan, abhi order karoge toh free shipping milega" |
| "Competitor X se le lunga" (I'll buy from competitor) | Don't badmouth, highlight unique advantages | "Aapki marzi! Bas ye dhyan rakhiyega ki humara formula pharma-grade hai aur GMP certified facility mein banta hai" |
| "Abhi nahi chahiye" (Not now) | Soft exit + create gentle urgency | "Koi baat nahi! Bas bata dun — ye limited stock mein hai. Jab chahein tab aa jaiyega" |

## Coupon generation rules

```typescript
interface CouponRules {
  maxDiscountPercent: number;    // e.g., 15
  minOrderValue: number;         // e.g., 500
  validForHours: number;         // e.g., 24
  maxUsage: number;              // e.g., 1
  onlyForProducts?: string[];    // specific product IDs
  prefix: string;                // e.g., "VOICE" → "VOICE-ABC123"
}

// Coupon generation happens ONLY when:
// 1. Bot is in OBJECTION_HANDLING or CLOSING state
// 2. Customer has shown interest but is hesitating
// 3. Other objection handling strategies have been tried first
// 4. Merchant has enabled coupons in dashboard
// 5. Maximum one coupon per conversation
```

## Conversation metrics to track

For every conversation, track these events:

```typescript
enum EventType {
  WIDGET_OPENED = "widget_opened",
  CONSENT_GIVEN = "consent_given",
  CONSENT_DECLINED = "consent_declined",
  FIRST_MESSAGE = "first_message",
  PRODUCT_SHOWN = "product_shown",        // which product, in which state
  PRODUCT_CLICKED = "product_clicked",     // user clicked product link
  CART_ADD = "cart_add",                   // via adapter
  COUPON_GENERATED = "coupon_generated",   // which coupon, what discount
  COUPON_APPLIED = "coupon_applied",
  PURCHASE = "purchase",                   // via adapter webhook
  OBJECTION_RAISED = "objection_raised",   // what type
  VOICE_STARTED = "voice_started",
  VOICE_ENDED = "voice_ended",
  CONVERSATION_ENDED = "conversation_ended",
  LANGUAGE_DETECTED = "language_detected", // which language
}
```
