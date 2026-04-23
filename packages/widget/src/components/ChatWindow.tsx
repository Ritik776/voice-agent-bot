import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { MessageBubble } from './MessageBubble';
import { ProductCard } from './ProductCard';
import { VoiceButton } from './VoiceButton';
import { useVoice } from '../hooks/useVoice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Array<{
    id: string; name: string; description: string; price: number;
    currency: string; url: string; imageUrl?: string | null;
    sellingPoints: string[]; matchReason: string;
  }>;
}

interface ChatWindowProps {
  conversationId: string | null;
  merchantName: string;
  greeting: string;
  apiUrl: string;
  style: string;
  onClose: () => void;
}

const SESSION_KEY = 'vs_messages';
const LANG_KEY = 'vs_lang';

function detectLang(text: string): string {
  const hindi = (text.match(/[\u0900-\u097F]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  return total > 0 && hindi / total > 0.2 ? 'hi' : 'en';
}

export function ChatWindow({ conversationId, merchantName, greeting, apiUrl, style, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) return JSON.parse(saved) as Message[];
    } catch {}
    return [{ role: 'assistant', content: greeting }];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(() => sessionStorage.getItem('vs_muted') === '1');

  const convLangRef = useRef<string>(sessionStorage.getItem(LANG_KEY) || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      sessionStorage.setItem('vs_muted', next ? '1' : '0');
      if (next) stopAudio();
      return next;
    });
  }, [stopAudio]);

  const speakText = useCallback(async (text: string) => {
    if (isMuted) return;
    stopAudio();
    const lang = detectLang(text);
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
      setIsPlaying(true);
      audio.onended = () => { URL.revokeObjectURL(url); setIsPlaying(false); };
      audio.onerror = () => setIsPlaying(false);
      audio.play().catch(() => setIsPlaying(false));
    } catch (e) {
      console.error('[TTS]', e);
      setIsPlaying(false);
    }
  }, [apiUrl, stopAudio, isMuted]);

  const onUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
  }, []);

  const onBotResponse = useCallback((data: { message: string; products?: any[]; language?: string }) => {
    if (data.language) {
      convLangRef.current = data.language;
      sessionStorage.setItem(LANG_KEY, data.language);
    }
    setMessages((prev) => [...prev, { role: 'assistant', content: data.message, products: data.products }]);
  }, []);

  const onVoiceError = useCallback((msg: string) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
  }, []);

  const { isListening, isProcessing, isSupported, startListening, stopListening, stopSpeaking } = useVoice({
    apiUrl,
    conversationId,
    convLang: convLangRef,
    onUserMessage,
    onBotResponse,
    onError: onVoiceError,
  });

  // Stop ALL audio (text-mode TTS + voice-mode TTS)
  const stopAllAudio = useCallback(() => {
    stopAudio();
    stopSpeaking();
  }, [stopAudio, stopSpeaking]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    stopAllAudio();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      if (!conversationId) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, could not connect. Please try again.' }]);
        return;
      }
      const res = await fetch(`${apiUrl}/api/v1/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (data.language) {
        convLangRef.current = data.language;
        sessionStorage.setItem(LANG_KEY, data.language);
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message, products: data.products }]);
      speakText(data.message);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  useEffect(() => () => stopAllAudio(), [stopAllAudio]);

  const statusText = isLoading ? 'Typing...'
    : isListening ? 'Listening...'
    : isProcessing ? 'Processing...'
    : 'Online';

  return (
    <div class="vs-chat" style={style}>
      {/* Header — clean, no mute button here */}
      <div class="vs-chat-header">
        <div class="vs-avatar">🌿</div>
        <div class="vs-chat-header-info">
          <div class="vs-chat-header-name">{merchantName}</div>
          <div class="vs-chat-header-status">
            <span class="vs-status-dot" />{statusText}
          </div>
        </div>
        <div class="vs-header-actions">
          <button class="vs-icon-btn" onClick={onClose} aria-label="Close chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div class="vs-chat-messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.products?.map((p) => (
              <div class="vs-product-wrap" key={p.id}><ProductCard product={p} /></div>
            ))}
          </div>
        ))}
        {(isLoading || isProcessing) && (
          <div class="vs-typing">
            <span class="vs-dot" /><span class="vs-dot" /><span class="vs-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Speaking bar — compact strip, appears only while audio plays */}
      {isPlaying && (
        <div class="vs-speaking-bar">
          <div class="vs-speaking-waves">
            <span class="vs-wave-bar" />
            <span class="vs-wave-bar" />
            <span class="vs-wave-bar" />
            <span class="vs-wave-bar" />
            <span class="vs-wave-bar" />
          </div>
          <span class="vs-speaking-label">Priya is speaking</span>
          <button class="vs-stop-speaking" onClick={stopAllAudio} aria-label="Stop speaking">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        </div>
      )}

      {/* Input row */}
      <div class="vs-chat-input">
        <input
          type="text"
          class="vs-input"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening… tap mic to stop' : 'Type a message…'}
          disabled={isLoading || isListening || isProcessing}
        />

        {/* Voice on/off toggle */}
        <button
          class={`vs-voice-toggle ${isMuted ? 'vs-voice-toggle-off' : 'vs-voice-toggle-on'}`}
          onClick={toggleMute}
          aria-label={isMuted ? 'Voice muted — click to enable' : 'Voice on — click to mute'}
          title={isMuted ? 'Voice off' : 'Voice on'}
        >
          {isMuted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>

        {isSupported && (
          <VoiceButton
            isListening={isListening}
            isProcessing={isProcessing}
            onClick={() => { if (isListening) stopListening(); else { stopAllAudio(); startListening(); } }}
          />
        )}
        <button class="vs-send-btn" onClick={sendMessage} disabled={isLoading || !input.trim()} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
