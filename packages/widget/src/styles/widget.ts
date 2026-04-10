export const widgetStyles = `
:host {
  --vs-primary: #2563eb;
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
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* -- FAB (Floating Action Button) -- */
.vs-fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--vs-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--vs-shadow);
  transition: transform 0.2s, background 0.2s;
}
.vs-fab:hover {
  transform: scale(1.08);
  background: var(--vs-primary-hover);
}

/* -- Consent Popup -- */
.vs-consent {
  width: 320px;
  background: var(--vs-bg);
  border-radius: var(--vs-radius);
  box-shadow: var(--vs-shadow);
  padding: 16px;
  animation: vs-slide-up 0.3s ease-out;
}
.vs-consent-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.vs-consent-title {
  font-weight: 600;
  flex: 1;
}
.vs-consent-text {
  color: var(--vs-text-secondary);
  margin: 0 0 16px 0;
  font-size: 14px;
}
.vs-consent-actions {
  display: flex;
  gap: 8px;
}

/* -- Buttons -- */
.vs-btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s, opacity 0.2s;
}
.vs-btn-primary {
  background: var(--vs-primary);
  color: white;
  flex: 1;
}
.vs-btn-primary:hover { background: var(--vs-primary-hover); }
.vs-btn-secondary {
  background: var(--vs-bg-secondary);
  color: var(--vs-text-secondary);
}
.vs-btn-secondary:hover { opacity: 0.8; }

.vs-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--vs-text-secondary);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}
.vs-close-btn:hover { background: var(--vs-bg-secondary); }

.vs-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--vs-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* -- Chat Window -- */
.vs-chat {
  width: 370px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 100px);
  background: var(--vs-bg);
  border-radius: var(--vs-radius);
  box-shadow: var(--vs-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: vs-slide-up 0.3s ease-out;
}
.vs-chat-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vs-border);
  background: var(--vs-bg);
}
.vs-chat-header-info { flex: 1; }
.vs-chat-header-name {
  font-weight: 600;
  font-size: 14px;
}
.vs-chat-header-status {
  font-size: 12px;
  color: var(--vs-text-secondary);
}

/* -- Messages Area -- */
.vs-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--vs-bg-secondary);
}

/* -- Bubbles -- */
.vs-bubble {
  display: flex;
  gap: 8px;
  max-width: 85%;
}
.vs-bubble-assistant { align-self: flex-start; }
.vs-bubble-user { align-self: flex-end; }
.vs-bubble-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--vs-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.vs-bubble-content {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
.vs-bubble-content-assistant {
  background: var(--vs-bg);
  border: 1px solid var(--vs-border);
}
.vs-bubble-content-user {
  background: var(--vs-primary);
  color: white;
}

/* -- Product Card -- */
.vs-product-wrap {
  margin: 4px 0 4px 32px;
}
.vs-product-card {
  display: block;
  background: var(--vs-bg);
  border: 1px solid var(--vs-border);
  border-radius: 10px;
  padding: 12px;
  text-decoration: none;
  color: var(--vs-text);
  transition: box-shadow 0.2s;
}
.vs-product-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
.vs-product-img {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 8px;
}
.vs-product-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}
.vs-product-price {
  font-weight: 700;
  color: var(--vs-primary);
  font-size: 15px;
  margin-bottom: 6px;
}
.vs-product-point {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--vs-text-secondary);
  margin-bottom: 2px;
}
.vs-product-point svg { color: #22c55e; flex-shrink: 0; }
.vs-product-cta {
  margin-top: 8px;
  text-align: center;
  padding: 6px;
  background: var(--vs-primary);
  color: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

/* -- Input Area -- */
.vs-chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--vs-border);
  background: var(--vs-bg);
}
.vs-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--vs-border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  font-family: var(--vs-font);
  background: var(--vs-bg);
  color: var(--vs-text);
}
.vs-input:focus { border-color: var(--vs-primary); }
.vs-input:disabled { opacity: 0.6; }
.vs-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--vs-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}
.vs-send-btn:hover { background: var(--vs-primary-hover); }
.vs-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* -- Typing indicator -- */
.vs-typing {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  align-self: flex-start;
}
.vs-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vs-text-secondary);
  animation: vs-bounce 1.4s ease-in-out infinite;
}
.vs-dot:nth-child(2) { animation-delay: 0.2s; }
.vs-dot:nth-child(3) { animation-delay: 0.4s; }

/* -- Animations -- */
@keyframes vs-slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vs-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* -- Mobile: full-screen chat -- */
@media (max-width: 480px) {
  .vs-chat {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    position: fixed;
    bottom: 0;
    right: 0;
  }
}

/* -- Voice Button -- */
.vs-voice-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--vs-bg-secondary);
  color: var(--vs-text-secondary);
  border: 1px solid var(--vs-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
}
.vs-voice-btn:hover { background: var(--vs-border); }
.vs-voice-btn-active {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}
.vs-voice-btn-active:hover { background: #dc2626; }
.vs-voice-btn-processing {
  opacity: 0.6;
  cursor: not-allowed;
}
.vs-pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 2px solid #ef4444;
  animation: vs-pulse 1.5s ease-out infinite;
}

/* -- Voice Overlay -- */
.vs-voice-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background: var(--vs-bg);
  border-top: 1px solid var(--vs-border);
}
.vs-voice-status {
  font-size: 13px;
  color: var(--vs-text-secondary);
  font-weight: 500;
}
.vs-voice-transcript {
  font-size: 14px;
  color: var(--vs-text);
  text-align: center;
  font-style: italic;
  max-width: 280px;
  word-break: break-word;
}
.vs-voice-stop {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.vs-voice-stop:hover { background: #dc2626; }

/* -- Waveform -- */
.vs-waveform {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 40px;
}
.vs-wave-bar {
  width: 4px;
  height: 20px;
  background: var(--vs-primary);
  border-radius: 2px;
  animation: vs-wave 1s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}
.vs-processing-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--vs-border);
  border-top-color: var(--vs-primary);
  border-radius: 50%;
  animation: vs-spin 0.8s linear infinite;
}

@keyframes vs-pulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(1.4); opacity: 0; }
}
@keyframes vs-wave {
  0%, 100% { height: 8px; }
  50% { height: 32px; }
}
@keyframes vs-spin {
  to { transform: rotate(360deg); }
}

/* -- Reduced motion -- */
@media (prefers-reduced-motion: reduce) {
  .vs-fab, .vs-consent, .vs-chat { animation: none; }
  .vs-dot { animation: none; opacity: 0.6; }
  .vs-fab:hover { transform: none; }
  .vs-wave-bar { animation: none; height: 20px; }
  .vs-pulse-ring { animation: none; }
  .vs-processing-spinner { animation: none; }
}
`;
