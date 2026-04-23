export const widgetStyles = `
:host {
  --vs-primary: #22c55e;
  --vs-primary-dark: #16a34a;
  --vs-primary-light: #bbf7d0;
  --vs-primary-glow: rgba(34,197,94,0.35);
  --vs-bg: #ffffff;
  --vs-bg-secondary: #f0fdf4;
  --vs-bg-messages: #f8fafc;
  --vs-text: #0f172a;
  --vs-text-secondary: #64748b;
  --vs-border: #e2e8f0;
  --vs-radius: 20px;
  --vs-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
  --vs-shadow-fab: 0 8px 24px var(--vs-primary-glow), 0 2px 8px rgba(0,0,0,0.12);
  --vs-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  font-family: var(--vs-font);
  font-size: 14px;
  line-height: 1.5;
  color: var(--vs-text);
  box-sizing: border-box;
}

*, *::before, *::after { box-sizing: border-box; }

/* ── FAB ── */
.vs-fab {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--vs-primary) 0%, var(--vs-primary-dark) 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--vs-shadow-fab);
  transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s;
  position: relative;
  animation: vs-fab-in 0.4s cubic-bezier(.34,1.56,.64,1);
}
.vs-fab::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--vs-primary-glow);
  animation: vs-fab-pulse 2.5s ease-in-out infinite;
  z-index: -1;
}
.vs-fab:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 32px var(--vs-primary-glow), 0 4px 12px rgba(0,0,0,0.15);
}

/* ── Consent Popup ── */
.vs-consent {
  width: 330px;
  background: var(--vs-bg);
  border-radius: var(--vs-radius);
  box-shadow: var(--vs-shadow);
  overflow: hidden;
  animation: vs-slide-up 0.35s cubic-bezier(.34,1.56,.64,1);
}
.vs-consent-top {
  background: linear-gradient(135deg, var(--vs-primary) 0%, var(--vs-primary-dark) 100%);
  padding: 20px 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.vs-consent-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 22px;
}
.vs-consent-title {
  font-weight: 700;
  font-size: 16px;
  color: white;
}
.vs-consent-subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
}
.vs-consent-body { padding: 16px 20px 20px; }
.vs-consent-text {
  color: var(--vs-text-secondary);
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
}
.vs-consent-actions { display: flex; gap: 8px; }

/* ── Buttons ── */
.vs-btn {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.vs-btn-primary {
  background: linear-gradient(135deg, var(--vs-primary), var(--vs-primary-dark));
  color: white;
  flex: 1;
  box-shadow: 0 4px 12px var(--vs-primary-glow);
}
.vs-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px var(--vs-primary-glow); }
.vs-btn-secondary {
  background: var(--vs-bg-secondary);
  color: var(--vs-text-secondary);
  border: 1px solid var(--vs-border);
}
.vs-btn-secondary:hover { background: var(--vs-border); }

.vs-icon-btn {
  background: rgba(255,255,255,0.15);
  border: none;
  cursor: pointer;
  color: white;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.vs-icon-btn:hover { background: rgba(255,255,255,0.25); }
.vs-icon-btn-muted {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.5);
}

/* ── Avatar ── */
.vs-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  border: 2px solid rgba(255,255,255,0.4);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
}

/* ── Chat Window ── */
.vs-chat {
  width: 385px;
  max-width: calc(100vw - 24px);
  height: 560px;
  max-height: calc(100vh - 90px);
  background: var(--vs-bg);
  border-radius: var(--vs-radius);
  box-shadow: var(--vs-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: vs-slide-up 0.35s cubic-bezier(.34,1.56,.64,1);
}

/* ── Header ── */
.vs-chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--vs-primary) 0%, var(--vs-primary-dark) 100%);
  flex-shrink: 0;
}
.vs-chat-header-info { flex: 1; min-width: 0; }
.vs-chat-header-name {
  font-weight: 700;
  font-size: 15px;
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vs-chat-header-status {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  gap: 5px;
}
.vs-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a7f3d0;
  animation: vs-status-pulse 2s ease-in-out infinite;
}
.vs-header-actions { display: flex; align-items: center; gap: 4px; }

/* ── Messages Area ── */
.vs-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--vs-bg-messages);
  scroll-behavior: smooth;
}
.vs-chat-messages::-webkit-scrollbar { width: 4px; }
.vs-chat-messages::-webkit-scrollbar-track { background: transparent; }
.vs-chat-messages::-webkit-scrollbar-thumb { background: var(--vs-border); border-radius: 4px; }

/* ── Bubbles ── */
.vs-bubble {
  display: flex;
  gap: 8px;
  max-width: 88%;
  animation: vs-msg-in 0.25s ease-out;
}
.vs-bubble-assistant { align-self: flex-start; }
.vs-bubble-user { align-self: flex-end; flex-direction: row-reverse; }
.vs-bubble-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--vs-primary), var(--vs-primary-dark));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 13px;
  box-shadow: 0 2px 6px var(--vs-primary-glow);
}
.vs-bubble-content {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}
.vs-bubble-content-assistant {
  background: white;
  border-radius: 4px 16px 16px 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  color: var(--vs-text);
}
.vs-bubble-content-user {
  background: linear-gradient(135deg, var(--vs-primary), var(--vs-primary-dark));
  border-radius: 16px 4px 16px 16px;
  color: white;
  box-shadow: 0 2px 8px var(--vs-primary-glow);
}

/* ── Typing indicator ── */
.vs-typing {
  display: flex;
  gap: 5px;
  padding: 12px 16px;
  background: white;
  border-radius: 4px 16px 16px 16px;
  align-self: flex-start;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  margin-left: 36px;
}
.vs-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vs-primary);
  animation: vs-bounce 1.2s ease-in-out infinite;
}
.vs-dot:nth-child(2) { animation-delay: 0.18s; }
.vs-dot:nth-child(3) { animation-delay: 0.36s; }

/* ── Product Card ── */
.vs-product-wrap { margin: 2px 0 2px 36px; }
.vs-product-card {
  display: block;
  background: white;
  border: 1.5px solid var(--vs-border);
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none;
  color: var(--vs-text);
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.vs-product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  border-color: var(--vs-primary);
}
.vs-product-img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
  background: var(--vs-bg-secondary);
}
.vs-product-body { padding: 10px 12px 12px; }
.vs-product-name {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 3px;
  color: var(--vs-text);
}
.vs-product-price {
  font-weight: 800;
  color: var(--vs-primary-dark);
  font-size: 16px;
  margin-bottom: 6px;
}
.vs-product-point {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 12px;
  color: var(--vs-text-secondary);
  margin-bottom: 3px;
  line-height: 1.4;
}
.vs-product-point-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--vs-primary);
  flex-shrink: 0;
  margin-top: 5px;
}
.vs-product-cta {
  margin-top: 10px;
  display: block;
  text-align: center;
  padding: 8px;
  background: linear-gradient(135deg, var(--vs-primary), var(--vs-primary-dark));
  color: white;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  transition: opacity 0.2s;
}
.vs-product-cta:hover { opacity: 0.9; }

/* ── Speaking Bar ── */
.vs-speaking-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  background: linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%);
  border-top: 1px solid #bbf7d0;
  flex-shrink: 0;
  animation: vs-bar-in 0.22s cubic-bezier(.34,1.56,.64,1);
}
.vs-speaking-waves {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 18px;
  flex-shrink: 0;
}
.vs-wave-bar {
  width: 3px;
  border-radius: 3px;
  background: var(--vs-primary);
  animation: vs-wave 0.75s ease-in-out infinite;
  height: 6px;
}
.vs-wave-bar:nth-child(1) { animation-delay: 0.00s; }
.vs-wave-bar:nth-child(2) { animation-delay: 0.12s; }
.vs-wave-bar:nth-child(3) { animation-delay: 0.24s; }
.vs-wave-bar:nth-child(4) { animation-delay: 0.12s; }
.vs-wave-bar:nth-child(5) { animation-delay: 0.00s; }
.vs-speaking-label {
  flex: 1;
  font-size: 12px;
  color: var(--vs-primary-dark);
  font-weight: 500;
  white-space: nowrap;
}
.vs-stop-speaking {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  background: white;
  border: 1.5px solid #fca5a5;
  color: #ef4444;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  letter-spacing: 0.2px;
}
.vs-stop-speaking:hover { background: #fee2e2; transform: scale(1.04); }
.vs-stop-speaking:active { transform: scale(0.97); }

/* ── Input Area ── */
.vs-chat-input {
  display: flex;
  gap: 7px;
  padding: 12px 14px;
  border-top: 1px solid var(--vs-border);
  background: white;
  align-items: center;
  flex-shrink: 0;
}
.vs-input {
  flex: 1;
  padding: 10px 16px;
  border: 1.5px solid var(--vs-border);
  border-radius: 24px;
  font-size: 14px;
  outline: none;
  font-family: var(--vs-font);
  background: var(--vs-bg-messages);
  color: var(--vs-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.vs-input:focus {
  border-color: var(--vs-primary);
  box-shadow: 0 0 0 3px rgba(34,197,94,0.12);
  background: white;
}
.vs-input:disabled { opacity: 0.55; }
.vs-input::placeholder { color: var(--vs-text-secondary); }
.vs-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--vs-primary), var(--vs-primary-dark));
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  flex-shrink: 0;
  box-shadow: 0 3px 10px var(--vs-primary-glow);
}
.vs-send-btn:hover { transform: scale(1.08); }
.vs-send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

/* ── Voice Button ── */
.vs-voice-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--vs-bg-messages);
  color: var(--vs-text-secondary);
  border: 1.5px solid var(--vs-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
}
.vs-voice-btn:hover { border-color: var(--vs-primary); color: var(--vs-primary); }
.vs-voice-btn-active {
  background: #fee2e2;
  color: #ef4444;
  border-color: #fca5a5;
}
.vs-voice-btn-active:hover { background: #fecaca; }
.vs-voice-btn-processing { opacity: 0.6; cursor: not-allowed; }
.vs-pulse-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid #ef4444;
  animation: vs-pulse 1.4s ease-out infinite;
}

/* ── Voice Toggle (mute/unmute) ── */
.vs-voice-toggle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
  position: relative;
}
.vs-voice-toggle:hover { transform: scale(1.1); }
.vs-voice-toggle:active { transform: scale(0.95); }
.vs-voice-toggle-on {
  background: var(--vs-bg-secondary);
  color: var(--vs-primary-dark);
  border-color: var(--vs-primary-light);
  box-shadow: 0 0 0 0 var(--vs-primary-glow);
}
.vs-voice-toggle-on:hover {
  box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
  background: #dcfce7;
}
.vs-voice-toggle-off {
  background: #f1f5f9;
  color: #94a3b8;
  border-color: #e2e8f0;
}
.vs-voice-toggle-off:hover { background: #e2e8f0; }

/* ── Animations ── */
@keyframes vs-slide-up {
  from { opacity: 0; transform: translateY(20px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes vs-fab-in {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes vs-fab-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%       { transform: scale(1.2); opacity: 0; }
}
@keyframes vs-bounce {
  0%, 80%, 100% { transform: scale(0.55) translateY(0); opacity: 0.4; }
  40%           { transform: scale(1) translateY(-4px); opacity: 1; }
}
@keyframes vs-msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vs-pulse {
  0%   { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes vs-status-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
@keyframes vs-spin {
  to { transform: rotate(360deg); }
}
@keyframes vs-wave {
  0%, 100% { height: 4px; opacity: 0.5; }
  50%       { height: 18px; opacity: 1; }
}
@keyframes vs-bar-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Mobile ── */
@media (max-width: 480px) {
  .vs-chat {
    width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    position: fixed;
    bottom: 0;
    right: 0;
  }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .vs-fab, .vs-consent, .vs-chat { animation: none; }
  .vs-fab::before, .vs-pulse-ring { animation: none; }
  .vs-dot { animation: none; opacity: 0.7; }
  .vs-fab:hover { transform: none; }
  .vs-status-dot { animation: none; }
}
`;
