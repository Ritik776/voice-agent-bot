interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div class={`vs-bubble vs-bubble-${role}`}>
      {role === 'assistant' && (
        <div class="vs-bubble-avatar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      )}
      <div class={`vs-bubble-content vs-bubble-content-${role}`}>
        {content}
      </div>
    </div>
  );
}
