type ChatRole = "user" | "assistant";

interface MessageBubbleProps {
  role: ChatRole;
  content: string;
  timestamp: string;
  characterName?: string;
  translation?: string;
}

/**
 * Renders a single chat message bubble.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message bubble component.
 */
const MessageBubble = ({ role, content, timestamp, characterName, translation }: MessageBubbleProps) => {
  const timeLabel = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  return (
    <article className={`chat-bubble chat-bubble--${role}`}>
      {characterName ? <p className="chat-bubble__name">{characterName}</p> : null}
      <p className="chat-bubble__text">{content}</p>
      {translation ? <p className="chat-bubble__translation">{translation}</p> : null}
      <span className="chat-bubble__meta">{timeLabel}</span>
    </article>
  );
};

export default MessageBubble;
