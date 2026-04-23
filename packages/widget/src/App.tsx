import { useState, useEffect } from 'preact/hooks';
import { ConsentPopup } from './components/ConsentPopup';
import { ChatWindow } from './components/ChatWindow';

interface AppProps {
  merchantId: string;
  apiUrl: string;
}

type WidgetState = 'hidden' | 'trigger' | 'consent' | 'chat';

interface MerchantConfig {
  name: string;
  greeting: string;
  primaryColor: string;
  triggers: Array<{ type: string; delay?: number; scrollPercent?: number }>;
}

const DEFAULT_CONFIG: MerchantConfig = {
  name: 'VoiceSell',
  greeting: 'Hi! Can I help you find the right product?',
  primaryColor: '#2563eb',
  triggers: [{ type: 'time', delay: 5000 }],
};

export function App({ merchantId, apiUrl }: AppProps) {
  const [widgetState, setWidgetState] = useState<WidgetState>('hidden');
  const [config, setConfig] = useState<MerchantConfig>(DEFAULT_CONFIG);
  const [conversationId, setConversationId] = useState<string | null>(
    () => sessionStorage.getItem('vs_conv_id')
  );

  // Fetch merchant config
  useEffect(() => {
    fetch(`${apiUrl}/api/v1/merchant/${merchantId}/config`)
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            name: data.name || DEFAULT_CONFIG.name,
            greeting: data.config.greeting || DEFAULT_CONFIG.greeting,
            primaryColor: data.config.primaryColor || DEFAULT_CONFIG.primaryColor,
            triggers: data.config.triggers || DEFAULT_CONFIG.triggers,
          });
        }
      })
      .catch(() => {
        // Use defaults if config fetch fails
      });
  }, [merchantId, apiUrl]);

  // Trigger logic — only fires once per session, never after user has chatted
  useEffect(() => {
    if (widgetState !== 'hidden') return;
    if (conversationId) return; // already chatted — don't interrupt again
    if (sessionStorage.getItem('vs_triggered')) return;

    const timers: number[] = [];

    for (const trigger of config.triggers) {
      if (trigger.type === 'time') {
        const t = window.setTimeout(() => {
          sessionStorage.setItem('vs_triggered', '1');
          setWidgetState('consent');
        }, trigger.delay || 5000);
        timers.push(t);
      }

      if (trigger.type === 'scroll' && trigger.scrollPercent) {
        const pct = trigger.scrollPercent;
        const handler = () => {
          const scrolled =
            (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
          if (scrolled >= pct) {
            sessionStorage.setItem('vs_triggered', '1');
            setWidgetState('consent');
            window.removeEventListener('scroll', handler);
          }
        };
        window.addEventListener('scroll', handler);
        timers.push(-1); // placeholder
      }

      if (trigger.type === 'exit_intent') {
        const handler = (e: MouseEvent) => {
          if (e.clientY < 10) {
            sessionStorage.setItem('vs_triggered', '1');
            setWidgetState('consent');
            document.removeEventListener('mouseout', handler);
          }
        };
        document.addEventListener('mouseout', handler);
      }
    }

    return () => {
      timers.forEach((t) => { if (t > 0) clearTimeout(t); });
    };
  }, [widgetState, config.triggers]);

  // Apply theme CSS variable
  const themeStyle = `--vs-primary: ${config.primaryColor};`;

  const handleConsent = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/conversation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId,
          sessionId: getSessionId(),
        }),
      });
      const data = await res.json();
      setConversationId(data.conversationId);
      sessionStorage.setItem('vs_conv_id', data.conversationId);
      setWidgetState('chat');
    } catch {
      // Still open chat with fallback
      setWidgetState('chat');
    }
  };

  const handleDismiss = () => {
    setWidgetState('hidden');
  };

  const handleClose = () => {
    setWidgetState('hidden');
  };

  // Floating button to reopen
  const handleReopen = () => {
    setWidgetState(conversationId ? 'chat' : 'consent');
  };

  if (widgetState === 'hidden') {
    return (
      <button class="vs-fab" onClick={handleReopen} style={themeStyle} aria-label="Open chat assistant">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" /><line x1="9" y1="14" x2="13" y2="14" />
        </svg>
      </button>
    );
  }

  if (widgetState === 'consent') {
    return (
      <ConsentPopup
        merchantName={config.name}
        greeting={config.greeting}
        style={themeStyle}
        onAccept={handleConsent}
        onDismiss={handleDismiss}
      />
    );
  }

  if (widgetState === 'chat') {
    return (
      <ChatWindow
        conversationId={conversationId}
        merchantName={config.name}
        greeting={config.greeting}
        apiUrl={apiUrl}
        style={themeStyle}
        onClose={handleClose}
      />
    );
  }

  return null;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('vs_session');
  if (!sid) {
    sid = 'ses_' + Math.random().toString(36).slice(2, 11);
    sessionStorage.setItem('vs_session', sid);
  }
  return sid;
}
