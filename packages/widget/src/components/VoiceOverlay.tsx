interface VoiceOverlayProps {
  isListening: boolean;
  processingStage: string | null;
  transcript: string | null;
  onStop: () => void;
}

export function VoiceOverlay({
  isListening,
  processingStage,
  transcript,
  onStop,
}: VoiceOverlayProps) {
  if (!isListening && !processingStage) return null;

  const statusText = isListening
    ? 'Listening...'
    : processingStage === 'transcribing'
      ? 'Converting speech...'
      : processingStage === 'thinking'
        ? 'Thinking...'
        : processingStage === 'speaking'
          ? 'Responding...'
          : 'Processing...';

  return (
    <div class="vs-voice-overlay">
      {/* Waveform visualization */}
      <div class="vs-waveform">
        {isListening ? (
          <>
            <span class="vs-wave-bar" style="--delay: 0s" />
            <span class="vs-wave-bar" style="--delay: 0.1s" />
            <span class="vs-wave-bar" style="--delay: 0.2s" />
            <span class="vs-wave-bar" style="--delay: 0.3s" />
            <span class="vs-wave-bar" style="--delay: 0.4s" />
          </>
        ) : (
          <div class="vs-processing-spinner" />
        )}
      </div>

      <div class="vs-voice-status">{statusText}</div>

      {transcript && (
        <div class="vs-voice-transcript">"{transcript}"</div>
      )}

      <button class="vs-voice-stop" onClick={onStop} aria-label="Stop">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
  );
}
