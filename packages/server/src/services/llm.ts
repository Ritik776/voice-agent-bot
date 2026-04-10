/**
 * LLM Service — Provider-agnostic (works with Groq, xAI/Grok, OpenAI, etc.)
 * Uses the OpenAI-compatible chat completions format.
 */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: string;
}

function detectConfig(): LLMConfig {
  // xAI (Grok)
  const xaiKey = process.env.XAI_API_KEY || process.env.GROQ_API_KEY;
  if (xaiKey && xaiKey.startsWith('xai-')) {
    return {
      apiKey: xaiKey,
      baseUrl: 'https://api.x.ai/v1',
      model: process.env.LLM_MODEL || 'grok-2-latest',
      provider: 'xAI/Grok',
    };
  }

  // Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey.startsWith('gsk_')) {
    return {
      apiKey: groqKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
      provider: 'Groq',
    };
  }

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: 'https://api.openai.com/v1',
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      provider: 'OpenAI',
    };
  }

  // Gemini (legacy — won't use this path anymore but keeps backwards compat)
  return {
    apiKey: '',
    baseUrl: '',
    model: '',
    provider: 'none',
  };
}

class LLMService {
  private config: LLMConfig;

  constructor() {
    this.config = detectConfig();
    if (this.config.provider === 'none') {
      console.warn('[LLM] No API key set — responses will be fallback messages');
    } else {
      console.log(`[LLM] Using ${this.config.provider} model: ${this.config.model}`);
    }
  }

  async generateResponse(
    systemPrompt: string,
    conversationHistory: ChatMessage[],
    userMessage: string
  ): Promise<string> {
    if (this.config.provider === 'none') {
      return this.getFallbackResponse(userMessage);
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (error: any) {
        console.error(`[LLM] Attempt ${attempt + 1} failed:`, error.message || error);
        if (attempt === 1) {
          return this.getFallbackResponse(userMessage);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return this.getFallbackResponse(userMessage);
  }

  private getFallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();
    if (lower.includes('hair') || lower.includes('baal')) {
      return 'Hairfall ke liye humara Biotin Gummies bahut effective hai. Kya main aapko iske baare mein bataun?';
    }
    if (lower.includes('skin') || lower.includes('glow')) {
      return 'Skin glow ke liye Vitamin C Gummies try karein. Kya aap iske fayde jaanna chahenge?';
    }
    if (lower.includes('pain') || lower.includes('dard')) {
      return 'Pain relief ke liye humare paas tablets aur gel dono hain. Aapko kahan dard hota hai?';
    }
    if (lower.includes('sleep') || lower.includes('neend')) {
      return 'Achhi neend ke liye humare Sleep Better Gummies hain — Ashwagandha + Melatonin. Batayein iske baare mein?';
    }
    if (lower.includes('gut') || lower.includes('digestion') || lower.includes('pet')) {
      return 'Digestion ke liye Healthy Gut Gummies (ACV) ya Detox Candy try karein. Kya aap zyada jaanna chahenge?';
    }
    return 'Main aapki madad karne ke liye yahan hoon! Aap mujhe batayein — aapko kis cheez ki zaroorat hai?';
  }
}

export const llmService = new LLMService();
