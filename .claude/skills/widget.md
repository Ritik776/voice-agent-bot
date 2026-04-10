# Widget — Embeddable Chat + Voice UI

## Installation (merchant's perspective)

Merchant adds ONE line to their website:

```html
<script src="https://cdn.voicesell.com/v1/widget.js" data-merchant="m_abc123" async></script>
```

That's it. Widget loads asynchronously, doesn't block page load, auto-configures itself.

## Widget loader (entry point)

```typescript
// widget/src/index.tsx — The ONLY file that touches the merchant's DOM

(function() {
  // 1. Don't initialize twice
  if (window.__voicesell_loaded) return;
  window.__voicesell_loaded = true;
  
  // 2. Get merchant ID from script tag
  const script = document.currentScript as HTMLScriptElement;
  const merchantId = script?.getAttribute('data-merchant');
  if (!merchantId) {
    console.warn('[VoiceSell] Missing data-merchant attribute');
    return;
  }
  
  // 3. Create isolated container
  const container = document.createElement('div');
  container.id = 'voicesell-root';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;';
  document.body.appendChild(container);
  
  // 4. Attach Shadow DOM for style isolation
  const shadow = container.attachShadow({ mode: 'closed' });
  
  // 5. Inject our styles into shadow root (bundled at build time)
  const style = document.createElement('style');
  style.textContent = __WIDGET_CSS__; // Replaced at build time by Vite
  shadow.appendChild(style);
  
  // 6. Render Preact app inside shadow root
  const app = document.createElement('div');
  shadow.appendChild(app);
  
  import('./App').then(({ mount }) => {
    mount(app, { merchantId });
  });
})();
```

## Bundle constraints

- **Total JS: under 15KB gzipped** — this is non-negotiable
- **No external CSS files** — all styles bundled inline
- **No external fonts** — use system font stack
- **No external images** — use inline SVG for icons
- **Async loading** — widget.js has `async` attribute, never blocks page
- **Lazy load heavy parts** — voice recording module loaded only when user clicks mic

### What's in the 15KB budget:

| Part | Estimated size (gzipped) |
|------|--------------------------|
| Preact runtime | ~3KB |
| Widget UI components | ~4KB |
| WebSocket client | ~2KB |
| Chat logic + state | ~2KB |
| Styles (CSS) | ~1.5KB |
| Audio worklet loader | ~1KB |
| **Buffer** | **~1.5KB** |

Audio recording module (~3KB) and AudioWorklet processor are **lazy loaded** only when user activates voice.

## Component hierarchy

```
WidgetRoot
├── TriggerButton          ← Floating button / initial popup
│   └── PulseAnimation     ← Draws attention
├── ConsentPopup           ← "Want help finding a product?"
│   ├── AcceptButton
│   └── DismissButton
└── ChatWindow             ← Main chat interface
    ├── ChatHeader
    │   ├── BotAvatar
    │   ├── StatusIndicator  ← "Online" / "Typing..."
    │   └── CloseButton
    ├── MessageList
    │   ├── MessageBubble (bot)
    │   │   └── ProductCard  ← Inline product recommendation
    │   └── MessageBubble (user)
    ├── InputArea
    │   ├── TextInput
    │   ├── VoiceButton      ← Mic toggle
    │   │   └── PulseRing    ← Active recording indicator
    │   └── SendButton
    └── VoiceOverlay         ← Full voice mode UI
        ├── WaveformVisualizer
        ├── TranscriptDisplay
        └── StopButton
```

## Trigger logic

When does the popup appear? Configurable per merchant, defaults below:

```typescript
interface TriggerConfig {
  type: 'time' | 'scroll' | 'exit_intent' | 'idle' | 'page_specific';
  delay?: number;          // ms for time trigger (default: 5000)
  scrollPercent?: number;  // % for scroll trigger (default: 40)
  idleTime?: number;       // ms for idle trigger (default: 15000)
  pages?: string[];        // URL patterns for page_specific
  showOnce?: boolean;      // Don't show again after dismiss (default: true per session)
  showOnMobile?: boolean;  // Mobile has smaller screens (default: true)
}

// Default trigger: show after 5s on page, OR 40% scroll, OR exit intent
// Whichever happens first
const DEFAULT_TRIGGERS: TriggerConfig[] = [
  { type: 'time', delay: 5000 },
  { type: 'scroll', scrollPercent: 40 },
  { type: 'exit_intent' },
];
```

## Style system

All styles scoped inside Shadow DOM. Use CSS custom properties for merchant theming:

```css
/* Base theme — merchant can override via dashboard */
:host {
  --vs-primary: #2563eb;        /* Brand color */
  --vs-primary-hover: #1d4ed8;
  --vs-bg: #ffffff;
  --vs-bg-secondary: #f8fafc;
  --vs-text: #1e293b;
  --vs-text-secondary: #64748b;
  --vs-border: #e2e8f0;
  --vs-radius: 12px;
  --vs-shadow: 0 8px 30px rgba(0,0,0,0.12);
  --vs-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  
  font-family: var(--vs-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--vs-text);
}

/* Merchant theme override — injected from config */
/* e.g., Reset.in uses green: --vs-primary: #22c55e */
```

## Product card (inside chat)

When the bot recommends a product, show an inline card:

```
┌─────────────────────────────────────┐
│ [Product Image]                     │
│                                     │
│ Biotin Gummies for Hair Growth      │
│ ₹599  ₹799  (25% off)              │
│                                     │
│ ✓ Reduces hairfall in 8 weeks       │
│ ✓ Pharma-grade biotin               │
│                                     │
│ [View Product]  [Add to Cart]       │
└─────────────────────────────────────┘
```

Product card is a `<a>` tag linking to the product page. "Add to Cart" calls the platform adapter's `addToCart()` method.

## Critical widget rules

1. **NEVER inject global styles.** All CSS lives inside Shadow DOM.
2. **NEVER modify the merchant's DOM** beyond adding our container.
3. **NEVER use `document.cookie`** — use our server for state management.
4. **NEVER make the widget modal/blocking** — user must be able to close it instantly.
5. **NEVER auto-play sound** — always require user interaction first.
6. **NEVER store PII in localStorage** — all conversation data stays on our server.
7. **Handle errors silently** — if API is down, widget hides itself. No error popups.
8. **Respect `prefers-reduced-motion`** — disable animations if user has this set.
9. **Support keyboard navigation** — all interactive elements must be tab-accessible.
10. **Mobile-first design** — widget works on 320px screens. Chat window is full-screen on mobile.

## Vite build config

```typescript
// widget/vite.config.ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'VoiceSell',
      fileName: 'voicesell',
      formats: ['iife'],  // Single file, self-executing
    },
    rollupOptions: {
      output: {
        // Everything in one file — no chunks
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.log in production
      },
    },
  },
});
```
