interface ConsentPopupProps {
  merchantName: string;
  greeting: string;
  style: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ConsentPopup({ merchantName, greeting, style, onAccept, onDismiss }: ConsentPopupProps) {
  return (
    <div class="vs-consent" style={style}>
      <div class="vs-consent-top">
        <div class="vs-consent-avatar">🌿</div>
        <div>
          <div class="vs-consent-title">{merchantName}</div>
          <div class="vs-consent-subtitle">AI Wellness Assistant • Online</div>
        </div>
      </div>
      <div class="vs-consent-body">
        <p class="vs-consent-text">{greeting}</p>
        <div class="vs-consent-actions">
          <button class="vs-btn vs-btn-primary" onClick={onAccept}>Yes, help me!</button>
          <button class="vs-btn vs-btn-secondary" onClick={onDismiss}>No thanks</button>
        </div>
      </div>
    </div>
  );
}
