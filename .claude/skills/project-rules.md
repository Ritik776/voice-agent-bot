# Project Rules — NEVER break these

## Code rules

1. **TypeScript everywhere** (except Python AI service). No `any` types. Strict mode enabled.
2. **No paid APIs without explicit approval.** Default to free tier / open-source for everything. If you're about to use a paid API, STOP and ask first.
3. **Widget bundle must stay under 15KB gzipped.** Check with `npm run build:widget && gzip -k dist/voicesell.js && ls -la dist/voicesell.js.gz`. If it exceeds 15KB, refactor.
4. **No external CSS frameworks in widget.** Widget uses scoped CSS only. Shadow DOM isolates styles. Tailwind is only for the dashboard.
5. **All widget styles must be scoped.** Use Shadow DOM or CSS-in-JS with unique prefixes (`vs-*`). Widget must NEVER affect merchant's site styling.
6. **Environment variables for all secrets.** Never hardcode API keys, tokens, or credentials. Use `.env` files (gitignored) and `process.env`.
7. **Prisma for all database operations.** No raw SQL except for migrations. This ensures we can switch SQLite → PostgreSQL with zero code changes.
8. **Error boundaries everywhere.** Widget must NEVER crash the merchant's site. Wrap everything in try/catch. If widget fails, fail silently — log to our server, don't show errors to customers.
9. **All LLM calls go through `services/llm.ts`.** Never call Gemini directly from routes or components. The LLM service handles retries, fallbacks, rate limiting, and prompt construction.
10. **All product matching goes through `services/product-matcher.ts`.** Never do raw vector searches from routes. Product matcher handles embedding, search, ranking, and fallback logic.

## Architecture rules

1. **Monorepo with npm workspaces.** Packages: `server`, `ai-service`, `widget`, `dashboard`. Shared types in `packages/shared/`.
2. **Server is the single API gateway.** Widget and dashboard talk to server only. Server talks to AI service internally.
3. **WebSocket for voice, REST for everything else.** Don't mix protocols unnecessarily.
4. **Adapter pattern for platforms.** Every platform (Shopify, WooCommerce, generic) implements the same `PlatformAdapter` interface. New platforms = new adapter file, zero changes elsewhere.
5. **Conversation state machine is the source of truth.** Every conversation has a state. Transitions are explicit. No implicit state changes.

## Conversation / sales rules

1. **ALWAYS ask consent before going deep.** Before explaining product benefits in detail, ask "Kya main aapko iske fayde bataun?" or equivalent. Never assume the user wants a sales pitch.
2. **Helpful first, salesy second.** Answer the user's actual question before recommending products. If someone asks "what helps with hairfall?", explain the causes first, THEN recommend products.
3. **Never lie about products.** Don't invent benefits, ingredients, or claims. Only use information from the merchant's actual product data.
4. **Coupon is the LAST resort, not the first.** Sales flow: explain value → handle objection → offer bundle → THEN coupon. Don't lead with discounts.
5. **Respect "no".** If user says they're not interested, thank them and offer to help with something else. Don't keep pushing.
6. **Detect language from user's first message.** If they speak Hindi, respond in Hindi. If Hinglish, respond in Hinglish. Never force a language.
7. **Keep responses SHORT in voice mode.** Max 2-3 sentences per turn in voice. Longer in text mode. Nobody wants to listen to a 30-second monologue.

## File naming conventions

- Components: `PascalCase.tsx` (e.g., `ChatWindow.tsx`)
- Services/utils: `kebab-case.ts` (e.g., `product-matcher.ts`)
- Routes: `kebab-case.ts` (e.g., `conversation.ts`)
- Types/interfaces: `PascalCase` in `types.ts` files
- Environment files: `.env.local` (gitignored), `.env.example` (committed)
- Test files: `*.test.ts` next to the file they test

## Git rules

- Branch naming: `feat/description`, `fix/description`, `refactor/description`
- Commit messages: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- Never commit `.env`, `node_modules/`, `dist/`, `*.db`, `__pycache__/`
- PR description must explain WHY, not just WHAT

## When you're unsure

- Read the relevant skill file in `.claude/skills/`
- If no skill file covers it, ask before proceeding
- If a decision affects architecture, document it in the skill file after deciding
- Default to the simplest solution that works. We can optimize later.
