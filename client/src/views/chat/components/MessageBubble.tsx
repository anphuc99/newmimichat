type ChatRole = "user" | "assistant";

interface MessageBubbleProps {
  role: ChatRole;
  content: string;
  timestamp: string;
}

/**
 * Renders a single chat message bubble.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message bubble component.
 */
const MessageBubble = ({ role, content, timestamp }: MessageBubbleProps) => {
  const timeLabel = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <article className={`chat-bubble chat-bubble--${role}`}>
      <p className="chat-bubble__text">{content}</p>
      <span className="chat-bubble__meta">{timeLabel}</span>
    </article>
  );
};

export default MessageBubble;
