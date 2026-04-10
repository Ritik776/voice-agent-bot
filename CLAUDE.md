# CLAUDE.md — AI Sales Bot SaaS (Project: VoiceSell)

## What is this project?

VoiceSell is a universal AI sales bot SaaS that any e-commerce merchant can install with one `<script>` tag. It supports Shopify, WooCommerce, and custom websites. It auto-detects 50+ languages (Hindi, Hinglish, Spanish, Arabic, etc.) and responds with voice + text like a smart human sales manager.

### The core user experience

1. Customer visits merchant website (e.g., reset.in)
2. After a trigger (time/scroll/exit intent), a popup asks: "Want our AI assistant to help you find the perfect product?"
3. If yes → opens a voice/text chat widget
4. Customer speaks naturally (e.g., "mere hairfall ho raha hai, skin bhi dull hori hai")
5. Bot maps symptoms/needs to products, explains benefits, usage, timing
6. Bot handles objections like a sales manager ("bahut mehnga hai" → explains value, offers bundle)
7. If interest drops → creates urgency with limited-time coupon
8. Bot asks consent before deep-diving ("Kya main aapko iske fayde bataun?")
9. Goal: guide to purchase, not push — be helpful first, salesy second

## Tech stack (all free / open-source)

| Layer | Tool | Why |
|-------|------|-----|
| LLM | Google Gemini 2.0 Flash (free tier) | 15 RPM free, excellent Hindi/Hinglish |
| Embeddings | Gemini text-embedding-004 (free tier) | 1,500 req/day free |
| Vector DB | ChromaDB (self-hosted) | Open-source, runs locally |
| RAG framework | LangChain.js | Connects LLM + vector DB + product data |
| STT | Faster-Whisper (self-hosted) | 99 languages, runs on CPU |
| TTS | Edge-TTS | Free Microsoft voices, good Hindi support |
| Backend | Node.js + Express + Socket.io | Real-time voice + API server |
| AI services | Python FastAPI microservice | Whisper STT + embedding pipeline |
| Widget | Preact + Vite | 3KB bundle, embeddable anywhere |
| Dashboard | Next.js + Tailwind + shadcn/ui | Merchant config + analytics |
| Auth | NextAuth.js | Free, self-hosted |
| Database | SQLite (dev) → PostgreSQL (prod) | Prisma ORM for easy migration |
| Cache | Redis | Sessions, rate limiting |
| CDN | Cloudflare (free) | Widget JS delivery |
| Hosting | Oracle Cloud free tier / local + Cloudflare Tunnel | 24GB RAM, 4 ARM CPUs free forever |
| Monitoring | Uptime Kuma | Self-hosted uptime alerts |
| CI/CD | GitHub Actions | 2,000 min/mo free |

## Project structure

```
voicesell/
├── CLAUDE.md                    # ← You are here
├── .claude/
│   └── skills/                  # Claude Code skill files
│       ├── project-rules.md     # Hard rules, never break these
│       ├── architecture.md      # System architecture reference
│       ├── conversation-engine.md # Sales bot conversation logic
│       ├── voice-pipeline.md    # STT/TTS/WebSocket voice flow
│       ├── widget.md            # Embeddable widget guidelines
│       ├── platform-adapters.md # Shopify/WooCommerce/generic adapters
│       └── dashboard.md         # Merchant dashboard guidelines
├── packages/
│   ├── server/                  # Node.js API + WebSocket server
│   │   ├── src/
│   │   │   ├── index.ts         # Express + Socket.io entry
│   │   │   ├── routes/          # REST API routes
│   │   │   ├── services/        # Business logic
│   │   │   │   ├── conversation.ts  # Conversation state machine
│   │   │   │   ├── product-matcher.ts # RAG product matching
│   │   │   │   ├── coupon.ts    # Coupon generation
│   │   │   │   └── llm.ts      # Gemini API wrapper
│   │   │   ├── adapters/        # Platform adapters
│   │   │   │   ├── base.ts      # Abstract adapter interface
│   │   │   │   ├── shopify.ts
│   │   │   │   ├── woocommerce.ts
│   │   │   │   └── generic.ts
│   │   │   ├── voice/           # Voice pipeline
│   │   │   │   ├── socket-handler.ts
│   │   │   │   ├── tts.ts       # Edge-TTS wrapper
│   │   │   │   └── stt-client.ts # Calls Python STT service
│   │   │   └── db/
│   │   │       ├── schema.prisma
│   │   │       └── seed.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ai-service/              # Python FastAPI microservice
│   │   ├── main.py              # FastAPI entry
│   │   ├── stt.py               # Faster-Whisper STT
│   │   ├── embeddings.py        # Product embedding pipeline
│   │   ├── vector_store.py      # ChromaDB operations
│   │   └── requirements.txt
│   ├── widget/                  # Preact embeddable widget
│   │   ├── src/
│   │   │   ├── index.tsx        # Widget entry + loader
│   │   │   ├── components/
│   │   │   │   ├── ChatWindow.tsx
│   │   │   │   ├── VoiceButton.tsx
│   │   │   │   ├── ConsentPopup.tsx
│   │   │   │   └── MessageBubble.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useVoice.ts
│   │   │   │   └── useChat.ts
│   │   │   └── styles/
│   │   │       └── widget.css
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── dashboard/               # Next.js merchant dashboard
│       ├── app/
│       │   ├── page.tsx
│       │   ├── dashboard/
│       │   ├── settings/
│       │   └── analytics/
│       ├── components/
│       ├── lib/
│       └── package.json
├── docker-compose.yml           # Local dev: all services
├── scripts/
│   ├── crawl-products.ts        # Crawl merchant site for products
│   ├── seed-embeddings.ts       # Generate & store product embeddings
│   └── setup.sh                 # One-command local setup
├── docs/
│   ├── setup-guide.md
│   ├── api-reference.md
│   └── deployment.md
├── package.json                 # Monorepo root (npm workspaces)
└── turbo.json                   # Turborepo config
```

## Development workflow

1. Always read the relevant skill file in `.claude/skills/` before working on a component
2. Run `npm run dev` from root to start all services
3. Widget dev server: `http://localhost:5173`
4. API server: `http://localhost:3001`
5. AI service: `http://localhost:8000`
6. Dashboard: `http://localhost:3000`
7. Test the bot at `http://localhost:5173/demo.html` (demo page with widget embedded)

## Key commands

```bash
# Setup (first time)
./scripts/setup.sh

# Development
npm run dev              # Start all services
npm run dev:server       # Server only
npm run dev:widget       # Widget only
npm run dev:dashboard    # Dashboard only
npm run dev:ai           # Python AI service only

# Build
npm run build            # Build all packages
npm run build:widget     # Build widget (outputs dist/voicesell.js)

# Database
npx prisma migrate dev   # Run migrations
npx prisma studio        # Visual DB browser

# Testing
npm run test             # Run all tests
npm run test:conversation # Test conversation flows

# Product crawling
npm run crawl -- --url https://reset.in  # Crawl & embed products
```

## Current phase

We are in **Phase 1: Core AI engine + widget shell**. Focus areas:
- [ ] Project scaffolding (monorepo, packages, configs)
- [ ] Gemini LLM integration with sales persona prompt
- [ ] Product crawling and embedding pipeline
- [ ] RAG product matching (symptom → product)
- [ ] Conversation state machine
- [ ] Basic chat widget (text only, no voice yet)
- [ ] Demo page with widget on a mock reset.in page

## Important context

- **Primary test site:** reset.in (Reset Wellness — D2C wellness brand)
- **Products:** Pain relief tablets, topical gels/sprays, detox candies, gummies (biotin, multivitamin), marine collagen, yoga accessories
- **Key selling points:** Backed by Venus Remedies (listed pharma company), award-winning, anti-painkiller positioning
- **Target customers:** Indian consumers, primarily Hindi/Hinglish/English speakers
- **Conversation style:** Empathetic, helpful-first, consultative selling — NOT aggressive pushiness
