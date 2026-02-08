import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  characterName?: string;
  translation?: string;
  audioId?: string;
  assistantId?: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  pendingMessage: ChatMessage | null;
  onPlayAudio?: (messageId: string) => void;
  onReloadAudio?: (messageId: string) => void;
  onEditUserMessage?: (userMessageIndex: number, content: string) => void;
  onEditAssistantMessage?: (assistantMessageId: string, localMessageId: string, content: string) => void;
}

/**
 * Renders the scrollable list of chat messages.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message list component.
 */
const MessageList = ({
  messages,
  pendingMessage,
  onPlayAudio,
  onReloadAudio,
  onEditUserMessage,
  onEditAssistantMessage
}: MessageListProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  let userIndex = 0;

  useEffect(() => {
    // Keep the newest message visible after updates.
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessage]);

  return (
    <div className="chat-messages">
      {messages.map((message) => {
        const currentUserIndex = message.role === "user" ? userIndex++ : null;
        const canEditUser = message.role === "user" && typeof currentUserIndex === "number" && onEditUserMessage;
        const canEditAssistant = message.role === "assistant" && message.assistantId && onEditAssistantMessage;

        return (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            characterName={message.characterName}
            translation={message.translation}
            showAudioControls={message.role === "assistant"}
            isEditable={Boolean(canEditUser || canEditAssistant)}
            onEdit={(nextContent) => {
              if (canEditUser && typeof currentUserIndex === "number") {
                onEditUserMessage?.(currentUserIndex, nextContent);
              }

              if (canEditAssistant && message.assistantId) {
                onEditAssistantMessage?.(message.assistantId, message.id, nextContent);
              }
            }}
            onPlayAudio={onPlayAudio ? () => onPlayAudio(message.id) : undefined}
            onReloadAudio={onReloadAudio ? () => onReloadAudio(message.id) : undefined}
          />
        );
      })}
      {pendingMessage ? (
        <MessageBubble
          key={pendingMessage.id}
          role={pendingMessage.role}
          content={pendingMessage.content}
          timestamp={pendingMessage.timestamp}
          characterName={pendingMessage.characterName}
          translation={pendingMessage.translation}
          showAudioControls={false}
        />
      ) : null}
      <div ref={endRef} />
    </div>
  );
};

export default MessageList;
