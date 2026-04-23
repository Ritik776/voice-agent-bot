import { useState, useRef, useCallback, useEffect } from 'preact/hooks';

type VoiceState = 'idle' | 'listening' | 'processing';

interface UseVoiceOptions {
  apiUrl: string;
  conversationId: string | null;
  convLang?: { current: string };
  onUserMessage: (text: string) => void;
  onBotResponse: (data: { message: string; products?: any[]; state?: string; language?: string }) => void;
  onError: (msg: string) => void;
}

const SILENCE_THRESHOLD = 15;     // avg frequency amplitude — below = silence
const SILENCE_DURATION_MS = 1200; // stop after 1.2s of silence
const MAX_RECORD_MS = 8000;       // hard cap 8 seconds

export function useVoice({ apiUrl, conversationId, convLang, onUserMessage, onBotResponse, onError }: UseVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const isSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const cleanupRecording = useCallback(() => {
    if (silenceTimerRef.current) { clearInterval(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
  }, []);

  const speakResponse = useCallback(async (text: string, lang: string) => {
    stopAudio();
    try {
      const res = await fetch(`${apiUrl}/api/v1/voice/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: lang }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    } catch (e) {
      console.error('[TTS]', e);
    }
  }, [apiUrl, stopAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanupRecording();
  }, [cleanupRecording]);

  const startListening = useCallback(async () => {
    if (!conversationId) { onError('Start a conversation first.'); return; }
    stopAudio();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((t) => MediaRecorder.isTypeSupported(t)) || '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        cleanupRecording();
        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });

        if (audioBlob.size < 500) { setVoiceState('idle'); return; }

        setVoiceState('processing');
        try {
          const lang = convLang?.current || '';
          const sttUrl = lang
            ? `${apiUrl}/api/v1/voice/stt?language=${encodeURIComponent(lang)}`
            : `${apiUrl}/api/v1/voice/stt`;

          const sttRes = await fetch(sttUrl, {
            method: 'POST',
            headers: { 'Content-Type': mimeType || 'audio/webm' },
            body: audioBlob,
          });

          if (!sttRes.ok) throw new Error(`STT ${sttRes.status}`);
          const { text, language } = await sttRes.json();

          if (!text?.trim()) { setVoiceState('idle'); return; }

          onUserMessage(text);

          const convRes = await fetch(`${apiUrl}/api/v1/conversation/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversationId, message: text }),
          });
          const data = await convRes.json();
          onBotResponse(data);

          const responseLang = data.language || convLang?.current || 'en';
          await speakResponse(data.message, responseLang);
        } catch (e) {
          console.error('[Voice]', e);
          onError('Could not process voice. Please try again.');
        } finally {
          setVoiceState('idle');
        }
      };

      // Start recording
      recorder.start(250); // collect data every 250ms
      setVoiceState('listening');

      // ── Silence detection via AudioContext ──
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(stream).connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let hasSpeech = false;
        let silenceSince = 0;

        silenceTimerRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;

          if (avg > SILENCE_THRESHOLD) {
            hasSpeech = true;
            silenceSince = Date.now();
          } else if (hasSpeech && Date.now() - silenceSince > SILENCE_DURATION_MS) {
            stopRecording();
          }
        }, 200);
      } catch {
        // AudioContext not available — fall back to manual stop only
      }

      // Hard cap
      maxTimerRef.current = window.setTimeout(() => stopRecording(), MAX_RECORD_MS);

    } catch (err: any) {
      cleanupRecording();
      if (err?.name === 'NotAllowedError') {
        onError('Microphone access denied. Please allow mic in browser settings.');
      } else {
        onError('Could not start recording. Try again.');
        console.error('[Voice] getUserMedia error:', err);
      }
      setVoiceState('idle');
    }
  }, [conversationId, apiUrl, convLang, onUserMessage, onBotResponse, onError, stopAudio, stopRecording, speakResponse, cleanupRecording]);

  const stopListening = useCallback(() => {
    stopRecording();
    stopAudio();
    setVoiceState('idle');
  }, [stopRecording, stopAudio]);

  useEffect(() => {
    return () => {
      stopRecording();
      stopAudio();
    };
  }, [stopRecording, stopAudio]);

  return {
    voiceState,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    isSupported,
    startListening,
    stopListening,
    stopSpeaking: stopAudio,
  };
}
