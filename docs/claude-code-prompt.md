# Claude Code — VoiceSell Kickoff Prompt

Copy-paste the prompt below into Claude Code after cloning the repo.

---

## Step 1: Clone & setup

```bash
git clone <your-repo-url> voicesell
cd voicesell
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## Step 2: Paste this prompt into Claude Code

```
Read the CLAUDE.md file at the project root. Then read ALL skill files in .claude/skills/ — every single one. These are your permanent reference. They define the architecture, rules, conversation logic, voice pipeline, widget specs, platform adapters, and dashboard design.

After reading all skills, do the following:

1. CONFIRM you've read all skill files by listing each one and its key purpose in one sentence.

2. Then start building Phase 1. Here is the exact order:

TASK 1 — Server entry point
Create packages/server/src/index.ts:
- Express server on PORT from env
- Socket.io attached to same server
- CORS enabled for all origins (dev mode)
- Health check at GET /health
- Mount API routes at /api/v1
- Import and initialize Prisma client
- Start server with console log

TASK 2 — LLM Service (Gemini wrapper)
Create packages/server/src/services/llm.ts:
- Import @google/generative-ai
- Initialize Gemini 2.0 Flash with API key from env
- Function: generateResponse(systemPrompt, conversationHistory, userMessage)
  - Builds the full prompt with system prompt + history + user message
  - Calls Gemini with temperature 0.7
  - Returns the response text
  - Handles errors gracefully (retry once, then return fallback message)
  - Rate limiting: track requests, if approaching 15 RPM, add delay
- Export as singleton

TASK 3 — Product Matcher Service
Create packages/server/src/services/product-matcher.ts:
- Function: matchProducts(userMessage, merchantId)
  - Calls the Python AI service /search endpoint
  - Passes the user message as query
  - Gets back matching products from ChromaDB
  - Enriches with full product data from Prisma DB
  - Returns top 2-3 matches with relevance scores
  - Includes product name, price, description, useCases, sellingPoints

TASK 4 — Conversation Service (state machine)
Create packages/server/src/services/conversation.ts:
- Implements the FULL state machine from .claude/skills/conversation-engine.md
- All states: IDLE, GREETING, CONSENT, DISCOVERY, RECOMMENDATION, EDUCATION, OBJECTION_HANDLING, CLOSING, SUCCESS, SOFT_EXIT
- All transitions enforced strictly
- Function: processMessage(conversationId, message, language?)
  - Loads conversation from DB
  - Determines current state
  - Calls product matcher if in DISCOVERY state
  - Builds the sales persona system prompt (from skill file)
  - Injects: current state, products, language, history
  - Calls LLM service
  - Detects state transition from LLM response
  - Saves message + new state to DB
  - Returns: { message, products, state, language }
- Function: startConversation(merchantId, sessionId, metadata?)
  - Creates new conversation in DB with GREETING state
  - Returns greeting message based on merchant config

TASK 5 — API Routes
Create packages/server/src/routes/conversation.ts:
- POST /api/v1/conversation/start
  - Body: { merchantId, sessionId, metadata? }
  - Returns: { conversationId, greeting, config }
- POST /api/v1/conversation/message
  - Body: { conversationId, message }
  - Returns: { message, products?, state }
Create packages/server/src/routes/merchant.ts:
- GET /api/v1/merchant/:id/config
  - Returns widget config (colors, triggers, greeting)

TASK 6 — Widget (text-only v1)
Build the Preact widget in packages/widget/:
- src/index.tsx — Widget loader with Shadow DOM (from skill file)
- src/App.tsx — Main app component
- src/components/ConsentPopup.tsx — Initial "Want help?" popup
- src/components/ChatWindow.tsx — Chat interface
- src/components/MessageBubble.tsx — Bot/user message bubbles
- src/components/ProductCard.tsx — Inline product recommendation card
- src/hooks/useChat.ts — Chat state management + API calls
- src/styles/widget.css — All widget styles (scoped)
- vite.config.ts — Build config for IIFE bundle
- public/demo.html — Demo page that loads the widget (simulates reset.in)

Follow the widget skill file EXACTLY for:
- Shadow DOM isolation
- Bundle size constraints
- Trigger logic
- Style system with CSS custom properties

TASK 7 — Product seeding for reset.in
Create packages/server/src/scripts/seed-reset.ts:
- Seed the database with Reset Wellness products:
  - Biotin Gummies (hairfall, nail strength)
  - Marine Collagen (skin glow, anti-aging)
  - Pain Relief Tablets (body pain, headache)
  - Pain Relief Gel/Spray (muscle pain, joint pain)
  - Detox Candies (gut health, toxin removal)
  - Multivitamin Gummies (daily wellness, energy)
- Each product must have: name, price, description, useCases, sellingPoints, tags
- Embed all products into ChromaDB via the AI service

TASK 8 — Wire everything together
- Update packages/server/src/index.ts to mount all routes
- Ensure widget connects to server correctly
- Test the full flow: open demo.html → consent popup → type message → get product recommendation

After each task, test it works before moving to the next. Tell me when each task is complete and show me how to test it.
```

## Step 3: After Phase 1 is working, use this prompt for Phase 2 (Voice)

```
Read .claude/skills/voice-pipeline.md again. Now add voice to the existing text bot:

1. Set up the WebSocket voice handler in packages/server/src/voice/socket-handler.ts
2. Create the TTS service using edge-tts in packages/server/src/voice/tts.ts
3. Create the STT client that calls the Python service in packages/server/src/voice/stt-client.ts
4. Set up the Python STT endpoint using faster-whisper in packages/ai-service/stt.py
5. Add VoiceButton component to the widget
6. Add audio capture with AudioWorklet in the widget
7. Add audio playback for TTS responses
8. Add the voice overlay UI with waveform visualization
9. Test: open demo → click mic → speak → bot responds with voice

Follow the voice pipeline skill file for all implementation details.
```
