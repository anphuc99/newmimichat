import { useEffect, useMemo, useState } from "react";
import MessageInput from "./components/MessageInput";
import MessageList from "./components/MessageList";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
}

interface ChatResponse {
  reply: string;
  model?: string;
}

interface ChatHistoryResponse {
  messages: Array<{ role: ChatRole; content: string }>;
}

const createMessage = (role: ChatRole, content: string): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  timestamp: new Date().toISOString()
});

const getOrCreateSessionId = (storageKey: string) => {
  const existing = window.localStorage.getItem(storageKey);

  if (existing) {
    return existing;
  }

  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(storageKey, next);
  return next;
};

interface ChatViewProps {
  userId: number;
}

/**
 * Renders the main Chat view for MimiChat.
 *
 * @returns The Chat view React component.
 */
const ChatView = ({ userId }: ChatViewProps) => {
  const storageKey = `mimi_chat_session_id_${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("assistant", "Hi! I am MimiChat. What would you like to practice today?")
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionId = useMemo(() => getOrCreateSessionId(storageKey), [storageKey]);

  useEffect(() => {
    let isActive = true;

    const loadHistory = async () => {
      try {
        const response = await authFetch(apiUrl(`/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`));

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ChatHistoryResponse;

        if (!isActive) {
          return;
        }

        if (payload.messages?.length) {
          setMessages(payload.messages.map((message) => createMessage(message.role, message.content)));
        }
      } catch {
        // Ignore history load errors.
      }
    };

    void loadHistory();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  const pendingMessage = useMemo(() => {
    if (!isSending) {
      return null;
    }

    return createMessage("assistant", "...");
  }, [isSending]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();

    if (!trimmed || isSending) {
      return;
    }

    const outgoingMessage = createMessage("user", trimmed);
    setMessages((prev) => [...prev, outgoingMessage]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/chat/send"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmed, sessionId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to send message");
      }

      const payload = (await response.json()) as ChatResponse;

      setMessages((prev) => [...prev, createMessage("assistant", payload.reply)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="chat-shell">
      <header className="chat-header">
        <div>
          <p className="chat-kicker">MimiChat</p>
          <h1>Focus on real conversations</h1>
          <p className="chat-subtitle">Practice Korean with short, friendly replies.</p>
        </div>
      </header>

      <section className="chat-window">
        {error ? <p className="chat-error">{error}</p> : null}
        <MessageList messages={messages} pendingMessage={pendingMessage} />
      </section>

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isSending}
      />
    </main>
  );
};

export default ChatView;
