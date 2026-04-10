interface ConsentPopupProps {
  merchantName: string;
  greeting: string;
  style: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ConsentPopup({
  merchantName,
  greeting,
  style,
  onAccept,
  onDismiss,
}: ConsentPopupProps) {
  return (
    <div class="vs-consent" style={style}>
      <div class="vs-consent-header">
        <div class="vs-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span class="vs-consent-title">{merchantName}</span>
        <button
          class="vs-close-btn"
          onClick={onDismiss}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <p class="vs-consent-text">{greeting}</p>
      <div class="vs-consent-actions">
        <button class="vs-btn vs-btn-primary" onClick={onAccept}>
          Yes, help me!
        </button>
        <button class="vs-btn vs-btn-secondary" onClick={onDismiss}>
          No thanks
        </button>
      </div>
    </div>
  );
}
