import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

type VoiceState = 'idle' | 'listening' | 'processing';

interface UseVoiceOptions {
  apiUrl: string;
  conversationId: string | null;
  onUserMessage: (text: string) => void;
  onBotResponse: (data: { message: string; products?: any[]; state?: string }) => void;
  onError: (msg: string) => void;
}

export function useVoice({
  apiUrl,
  conversationId,
  onUserMessage,
  onBotResponse,
  onError,
}: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopTTS = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speakResponse = useCallback((text: string, lang: string) => {
    if (!window.speechSynthesis) return;

    stopTTS();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang.startsWith(lang === 'hi' ? 'hi' : 'en') && v.name.includes('Female')
    ) || voices.find(v => v.lang.startsWith(lang === 'hi' ? 'hi' : 'en'));
    if (preferred) utterance.voice = preferred;

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [stopTTS]);

  const startListening = useCallback(() => {
    if (!isSupported || !conversationId) {
      onError('Voice not supported in this browser. Try Chrome or Edge.');
      return;
    }

    // Stop any ongoing TTS
    stopTTS();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = ''; // Auto-detect
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceState('listening');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (!transcript.trim()) {
        setVoiceState('idle');
        return;
      }

      // Show user message immediately
      onUserMessage(transcript);
      setVoiceState('processing');

      // Send to API
      try {
        const res = await fetch(`${apiUrl}/api/v1/conversation/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: transcript }),
        });
        const data = await res.json();
        onBotResponse(data);

        // Speak the response
        const lang = data.language || 'en';
        speakResponse(data.message, lang);
      } catch {
        onError('Connection error. Please try again.');
      } finally {
        setVoiceState('idle');
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Silently go back to idle
      } else if (event.error === 'not-allowed') {
        onError('Microphone access denied. Please allow mic access.');
      } else {
        onError('Voice recognition failed. Try again.');
      }
      setVoiceState('idle');
    };

    recognition.onend = () => {
      // Only reset to idle if not already processing
      setVoiceState((prev) => prev === 'listening' ? 'idle' : prev);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, conversationId, apiUrl, onUserMessage, onBotResponse, onError, stopTTS, speakResponse]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    stopTTS();
    setVoiceState('idle');
  }, [stopTTS]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopTTS();
    };
  }, [stopTTS]);

  return {
    voiceState,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    isSupported,
    startListening,
    stopListening,
  };
}
