# Architecture — System Design Reference

## Overview

VoiceSell is a 4-service system connected via REST and WebSocket.

```
┌──────────────────────────────────────────────────────────┐
│ Merchant's Website (e.g., reset.in)                      │
│                                                          │
│  <script src="https://cdn.voicesell.com/v1/widget.js"    │
│          data-merchant="m_abc123"></script>               │
│                                                          │
│  ┌────────────────────────┐                              │
│  │ VoiceSell Widget       │ ◄── Preact, Shadow DOM       │
│  │ (Chat + Voice UI)      │     Loaded async, <15KB      │
│  └──────────┬─────────────┘                              │
└─────────────┼────────────────────────────────────────────┘
              │ HTTPS + WebSocket
              ▼
┌──────────────────────────────────────────────────────────┐
│ VoiceSell Server (Node.js + Express + Socket.io)         │
│ Port 3001                                                │
│                                                          │
│ ├── REST API (/api/v1/*)                                 │
│ │   ├── POST /conversation/start                         │
│ │   ├── POST /conversation/message                       │
│ │   ├── GET  /merchant/:id/config                        │
│ │   └── POST /merchant/:id/products/sync                 │
│ │                                                        │
│ ├── WebSocket (voice)                                    │
│ │   ├── event: audio-chunk  (client → server)            │
│ │   ├── event: transcript   (server → client)            │
│ │   ├── event: tts-audio    (server → client)            │
│ │   └── event: bot-response (server → client)            │
│ │                                                        │
│ ├── Services                                             │
│ │   ├── ConversationService  ← state machine             │
│ │   ├── LLMService           ← Gemini API wrapper        │
│ │   ├── ProductMatcherService ← RAG search               │
│ │   ├── CouponService        ← generates discount codes  │
│ │   ├── TTSService           ← Edge-TTS wrapper          │
│ │   └── STTClientService     ← calls Python AI service   │
│ │                                                        │
│ ├── Adapters                                             │
│ │   ├── ShopifyAdapter                                   │
│ │   ├── WooCommerceAdapter                               │
│ │   └── GenericAdapter                                   │
│ │                                                        │
│ └── Database (Prisma + SQLite/PostgreSQL)                 │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP (internal, port 8000)
                   ▼
┌──────────────────────────────────────────────────────────┐
│ AI Service (Python FastAPI)                              │
│ Port 8000                                                │
│                                                          │
│ ├── POST /stt           ← audio bytes → transcript       │
│ │   (Faster-Whisper, auto language detection)            │
│ │                                                        │
│ ├── POST /embed         ← text → vector embedding        │
│ │   (Gemini text-embedding-004)                          │
│ │                                                        │
│ ├── POST /search        ← query → matching products      │
│ │   (ChromaDB similarity search)                         │
│ │                                                        │
│ └── POST /crawl         ← URL → extracted product data   │
│     (BeautifulSoup + Schema.org parser)                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Merchant Dashboard (Next.js)                             │
│ Port 3000                                                │
│                                                          │
│ ├── /dashboard          ← overview + stats               │
│ ├── /dashboard/products ← manage product knowledge       │
│ ├── /dashboard/settings ← bot personality, triggers      │
│ ├── /dashboard/coupons  ← coupon rules engine            │
│ ├── /dashboard/analytics ← conversation funnel           │
│ └── /dashboard/install  ← get script tag + setup wizard  │
└──────────────────────────────────────────────────────────┘
```

## Data flow: text conversation

```
Customer types "mere hairfall ho raha hai"
    │
    ▼
Widget sends POST /api/v1/conversation/message
    { conversationId, message, language: "auto" }
    │
    ▼
ConversationService:
    1. Get current state (e.g., DISCOVERY)
    2. Detect language → "hi" (Hindi)
    3. Call ProductMatcherService.match("hairfall")
       → returns [Biotin Gummies, Marine Collagen] with scores
    4. Build prompt with:
       - Sales persona instructions
       - Detected language
       - Conversation history
       - Matched products with details
       - Current state + allowed transitions
    5. Call LLMService.generate(prompt)
       → "Hairfall ke liye humara Biotin Gummies bahut effective hai..."
    6. Update state: DISCOVERY → RECOMMENDATION
    7. Save to database
    │
    ▼
Response to widget:
    { message, products, state, language }
```

## Data flow: voice conversation

```
Customer speaks into mic
    │
    ▼
Widget captures audio via Web Audio API
    → Chunks into 250ms PCM16 frames
    → Sends via WebSocket event "audio-chunk"
    │
    ▼
Server socket handler:
    1. Buffers audio chunks (accumulate ~2-3 seconds or detect silence via VAD)
    2. POST buffered audio to AI Service /stt
       → Returns { transcript: "mere hairfall ho raha hai", language: "hi" }
    3. Feed transcript into ConversationService (same as text flow)
    4. Get bot response text
    5. Call TTSService.synthesize(text, language="hi")
       → Returns audio buffer (MP3)
    6. Send via WebSocket event "tts-audio"
    │
    ▼
Widget plays audio via Web Audio API
    + Shows text transcript in chat
```

## Database schema (Prisma)

```prisma
model Merchant {
  id            String   @id @default(cuid())
  name          String
  domain        String   @unique
  platform      String   // "shopify" | "woocommerce" | "generic"
  apiKey        String   @unique  // merchant's API key for our service
  config        Json     // bot personality, triggers, widget theme
  couponRules   Json?    // discount rules
  createdAt     DateTime @default(now())
  products      Product[]
  conversations Conversation[]
}

model Product {
  id           String   @id @default(cuid())
  merchantId   String
  merchant     Merchant @relation(fields: [merchantId], references: [id])
  externalId   String?  // Shopify/WooCommerce product ID
  name         String
  description  String
  price        Float
  currency     String   @default("INR")
  url          String
  imageUrl     String?
  category     String?
  tags         String[] // ["hairfall", "biotin", "gummies"]
  useCases     String[] // ["hairfall", "nail strength", "skin glow"]
  sellingPoints String[] // ["pharma-backed", "award-winning"]
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Conversation {
  id          String   @id @default(cuid())
  merchantId  String
  merchant    Merchant @relation(fields: [merchantId], references: [id])
  sessionId   String   // browser session
  language    String?  // detected language code
  state       String   @default("GREETING") // current state machine state
  channel     String   @default("text") // "text" | "voice"
  metadata    Json?    // user agent, referrer, page URL
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  messages    Message[]
  events      ConversationEvent[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           String   // "user" | "assistant"
  content        String
  products       Json?    // products mentioned in this message
  createdAt      DateTime @default(now())
}

model ConversationEvent {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  type           String   // "product_shown" | "cart_add" | "coupon_generated" | "purchase"
  data           Json?
  createdAt      DateTime @default(now())
}
```

## Environment variables

```env
# .env.local (NEVER commit this file)

# Gemini
GEMINI_API_KEY=your_gemini_api_key

# Server
PORT=3001
NODE_ENV=development
DATABASE_URL=file:./dev.db

# AI Service
AI_SERVICE_URL=http://localhost:8000

# Redis
REDIS_URL=redis://localhost:6379

# Auth (NextAuth)
NEXTAUTH_SECRET=generate-a-random-secret-here
NEXTAUTH_URL=http://localhost:3000

# Widget
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## Port assignments

| Service | Port | Protocol |
|---------|------|----------|
| Dashboard (Next.js) | 3000 | HTTP |
| Server (Express) | 3001 | HTTP + WS |
| AI Service (FastAPI) | 8000 | HTTP |
| Widget Dev (Vite) | 5173 | HTTP |
| Redis | 6379 | TCP |

## Key design decisions

1. **Why separate Python AI service?** Faster-Whisper and ChromaDB are Python-native. Running them in a separate process means the Node.js server stays lightweight and handles thousands of WebSocket connections without blocking on ML inference.

2. **Why Prisma over raw SQL?** Single ORM that works with SQLite (dev) and PostgreSQL (prod). Zero code changes when we migrate. Built-in migrations, type safety, visual studio.

3. **Why Shadow DOM for widget?** The widget runs on merchant sites with unknown CSS. Shadow DOM guarantees our styles don't leak out and merchant styles don't leak in. No conflicts, ever.

4. **Why monorepo?** Shared types between server, widget, and dashboard. One `git clone`, one `npm install`, everything works. Turborepo handles parallel builds.

5. **Why Edge-TTS over Piper?** Edge-TTS has significantly better Hindi/Hinglish voices out of the box. Piper is our offline fallback if Edge-TTS ever breaks.
