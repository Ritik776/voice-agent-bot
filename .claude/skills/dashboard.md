# Dashboard — Merchant Configuration + Analytics

## Overview

The dashboard is a Next.js app where merchants configure their bot, monitor conversations, and view analytics. It communicates with the server via REST API.

## Tech stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui components
- **Auth:** NextAuth.js (Google + email/password)
- **Charts:** Chart.js (lightweight, free)
- **Hosting:** Vercel free tier or Cloudflare Pages
- **State:** React Query (TanStack Query) for server state

## Pages

```
/                        → Landing page (marketing, pricing, signup)
/login                   → NextAuth login
/dashboard               → Overview: key metrics, recent conversations
/dashboard/products      → Product knowledge management
/dashboard/settings      → Bot personality, widget config, triggers
/dashboard/coupons       → Coupon rules engine
/dashboard/analytics     → Conversation funnel, revenue attribution
/dashboard/install       → Get script tag, setup wizard
/dashboard/conversations → Browse conversation transcripts
```

## Dashboard overview (/dashboard)

Top-level metrics (last 7 days):

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Conversations│  │ Products     │  │ Coupons      │  │ Revenue      │
│ 342          │  │ Shown: 856   │  │ Generated: 47│  │ Attributed:  │
│ +12% vs prev │  │ Clicked: 234 │  │ Redeemed: 23 │  │ ₹1,24,500    │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

Below: conversation funnel chart + recent conversations list.

## Product management (/dashboard/products)

Merchants review auto-indexed products and enhance them:

```
┌─────────────────────────────────────────────────────────────┐
│ Products (47 active)                    [Sync Now] [+ Add]  │
├─────────────────────────────────────────────────────────────┤
│ 🔍 Search products...                                       │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [img] Biotin Gummies for Hair Growth                   │  │
│ │       ₹599 | Category: Gummies | In Stock              │  │
│ │                                                        │  │
│ │       Use cases: [hairfall] [nail strength] [+ Add]    │  │
│ │       Selling points:                                  │  │
│ │       - "Pharma-backed biotin formula"                 │  │
│ │       - "Visible results in 8 weeks"   [Edit] [+ Add] │  │
│ │                                                        │  │
│ │       Priority: ⭐ High (shown first in recommendations)│  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ [img] Marine Collagen Powder                           │  │
│ │       ₹1,299 | Category: Supplements | In Stock        │  │
│ │       ...                                              │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

Key features:
- **Auto-generated use cases and selling points** — AI crawls the product page and generates these. Merchant just reviews and edits.
- **Priority ranking** — drag to reorder. High-priority products are recommended first when multiple products match.
- **Use case tags** — these map to customer needs. "hairfall" tag means this product shows up when customer mentions hairfall.

## Bot settings (/dashboard/settings)

```
┌──────────────────────────────────────────────┐
│ Bot Personality                              │
│                                              │
│ Tone:     [Friendly ▼]                       │
│           Options: Friendly, Professional,    │
│           Casual, Energetic                  │
│                                              │
│ Greeting: [Hi! Want help finding the         │
│            right product? ___________]       │
│                                              │
│ Language: [Auto-detect ▼]                    │
│           Primary: Hindi                     │
│           Fallback: English                  │
│                                              │
│ Sales aggressiveness: [═══●═══] Medium       │
│  (Low = pure helper, High = closer)          │
│                                              │
│ Enable coupons: [✓] Yes                      │
│ Max discount: [15]%                          │
│ Coupon prefix: [RESET]                       │
├──────────────────────────────────────────────┤
│ Widget Appearance                            │
│                                              │
│ Primary color: [#22c55e] (picker)            │
│ Position: [Bottom Right ▼]                   │
│ Bot avatar: [Upload] or [Use default]        │
│                                              │
│ Trigger rules:                               │
│ [✓] After 5 seconds on page                 │
│ [✓] On 40% scroll                           │
│ [✓] On exit intent                          │
│ [ ] On specific pages only: [___________]    │
│                                              │
│ [Preview Widget]  [Save Changes]             │
└──────────────────────────────────────────────┘
```

## Analytics (/dashboard/analytics)

### Conversation funnel

```
Visitors ──────────────────────── 10,000 (100%)
    │
Widget shown ──────────────────── 3,200 (32%)
    │
Engaged (said yes) ───────────── 1,800 (56% of shown)
    │
Product recommended ──────────── 1,200 (67% of engaged)
    │
Product clicked ──────────────── 480 (40% of recommended)
    │
Cart add / purchase link ─────── 180 (37.5% of clicked)
    │
Purchase confirmed ───────────── 72 (40% of cart add)
```

### Additional analytics views

- **Revenue attribution:** total revenue from bot-influenced purchases
- **Language breakdown:** which languages drive most engagement
- **Top products:** most recommended, most clicked, best conversion
- **Objection analysis:** what customers push back on most
- **Time analysis:** peak conversation hours, avg conversation length
- **Voice vs text:** which channel converts better

## Install page (/dashboard/install)

Step-by-step wizard:

```
Step 1: Copy your script tag
┌──────────────────────────────────────────────────────────────┐
│ <script src="https://cdn.voicesell.com/v1/widget.js"        │
│         data-merchant="m_abc123" async></script>              │
│                                                    [Copy]    │
└──────────────────────────────────────────────────────────────┘

Step 2: Paste it into your website
  • Shopify: Settings → Custom code → Before </body>
  • WooCommerce: Appearance → Theme Editor → footer.php
  • Custom site: Paste before </body> in your HTML

Step 3: Verify installation
[Check Installation] → ✅ Widget detected on reset.in!

Step 4: Configure your bot
[Go to Settings →]
```

## API endpoints (dashboard → server)

```typescript
// Auth
POST   /api/auth/signup         // Create merchant account
POST   /api/auth/login          // Login
GET    /api/auth/me             // Current merchant

// Products
GET    /api/merchants/:id/products
PUT    /api/merchants/:id/products/:pid     // Update use cases, selling points
POST   /api/merchants/:id/products/sync     // Trigger product re-sync
POST   /api/merchants/:id/products/embed    // Re-embed in vector DB

// Settings
GET    /api/merchants/:id/config
PUT    /api/merchants/:id/config

// Analytics
GET    /api/merchants/:id/analytics/funnel?period=7d
GET    /api/merchants/:id/analytics/revenue?period=30d
GET    /api/merchants/:id/analytics/languages
GET    /api/merchants/:id/analytics/products

// Conversations
GET    /api/merchants/:id/conversations?page=1&limit=20
GET    /api/merchants/:id/conversations/:cid    // Full transcript

// Coupons
GET    /api/merchants/:id/coupons
PUT    /api/merchants/:id/coupon-rules
```

## Design guidelines for dashboard

- Use shadcn/ui components — don't build custom UI
- Follow shadcn's design patterns for consistency
- Dashboard should feel professional but simple — this is for non-technical merchants
- All data tables must have search + filters + pagination
- All forms must have validation + loading states + success/error feedback
- Mobile responsive — merchants will check analytics on phone
- Dark mode support via Tailwind's dark: prefix
