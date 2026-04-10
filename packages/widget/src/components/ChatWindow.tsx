import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { MessageBubble } from './MessageBubble';
import { ProductCard } from './ProductCard';
import { VoiceButton } from './VoiceButton';
import { useVoice } from '../hooks/useVoice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    url: string;
    imageUrl?: string | null;
    sellingPoints: string[];
    matchReason: string;
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

export function ChatWindow({
  conversationId,
  merchantName,
  greeting,
  apiUrl,
  style,
  onClose,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: greeting },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice callbacks
  const onUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
  }, []);

  const onBotResponse = useCallback((data: { message: string; products?: any[] }) => {
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: data.message, products: data.products },
    ]);
  }, []);

  const onVoiceError = useCallback((msg: string) => {
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: msg },
    ]);
  }, []);

  const {
    isListening,
    isProcessing,
    isSupported,
    startListening,
    stopListening,
  } = useVoice({
    apiUrl,
    conversationId,
    onUserMessage,
    onBotResponse,
    onError: onVoiceError,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      if (!conversationId) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I could not connect. Please try again.' },
        ]);
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/api/v1/conversation/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message, products: data.products },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const statusText = isLoading
    ? 'Typing...'
    : isListening
      ? 'Listening...'
      : isProcessing
        ? 'Processing...'
        : 'Online';

  return (
    <div class="vs-chat" style={style}>
      {/* Header */}
      <div class="vs-chat-header">
        <div class="vs-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div class="vs-chat-header-info">
          <div class="vs-chat-header-name">{merchantName}</div>
          <div class="vs-chat-header-status">{statusText}</div>
        </div>
        <button class="vs-close-btn" onClick={onClose} aria-label="Close chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div class="vs-chat-messages">
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble role={msg.role} content={msg.content} />
            {msg.products?.map((p) => (
              <div class="vs-product-wrap" key={p.id}>
                <ProductCard product={p} />
              </div>
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

      {/* Input */}
      <div class="vs-chat-input">
        <input
          type="text"
          class="vs-input"
          value={input}
          onInput={(e) => setInput((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Speak now...' : 'Type your message...'}
          disabled={isLoading || isListening || isProcessing}
        />
        {isSupported && (
          <VoiceButton
            isListening={isListening}
            isProcessing={isProcessing}
            onClick={handleVoiceClick}
          />
        )}
        <button
          class="vs-send-btn"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
