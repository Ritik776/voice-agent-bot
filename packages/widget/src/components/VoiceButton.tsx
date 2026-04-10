interface VoiceButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  onClick: () => void;
}

export function VoiceButton({ isListening, isProcessing, onClick }: VoiceButtonProps) {
  const label = isListening ? 'Stop recording' : isProcessing ? 'Processing...' : 'Start voice';

  return (
    <button
      class={`vs-voice-btn ${isListening ? 'vs-voice-btn-active' : ''} ${isProcessing ? 'vs-voice-btn-processing' : ''}`}
      onClick={onClick}
      disabled={isProcessing}
      aria-label={label}
      title={label}
    >
      {isListening ? (
        // Stop icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        // Mic icon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
      {isListening && <span class="vs-pulse-ring" />}
    </button>
  );
}
