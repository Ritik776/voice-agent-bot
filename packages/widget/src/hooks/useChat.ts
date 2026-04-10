import { useState, useCallback } from 'preact/hooks';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  url: string;
  imageUrl?: string | null;
  sellingPoints: string[];
  matchReason: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

interface UseChatOptions {
  apiUrl: string;
  conversationId: string | null;
  initialGreeting: string;
}

export function useChat({ apiUrl, conversationId, initialGreeting }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: initialGreeting },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !conversationId) return;

      setMessages((prev) => [...prev, { role: 'user', content: text }]);
      setIsLoading(true);

      try {
        const res = await fetch(`${apiUrl}/api/v1/conversation/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: text }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message,
            products: data.products,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Connection error. Please try again.' },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, conversationId, isLoading]
  );

  return { messages, isLoading, sendMessage };
}
