import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  pendingMessage: ChatMessage | null;
}

/**
 * Renders the scrollable list of chat messages.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message list component.
 */
const MessageList = ({ messages, pendingMessage }: MessageListProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep the newest message visible after updates.
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessage]);

  return (
    <div className="chat-messages">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          role={message.role}
          content={message.content}
          timestamp={message.timestamp}
        />
      ))}
      {pendingMessage ? (
        <MessageBubble
          key={pendingMessage.id}
          role={pendingMessage.role}
          content={pendingMessage.content}
          timestamp={pendingMessage.timestamp}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
