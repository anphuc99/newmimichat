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
  characterName?: string;
  translation?: string;
  tone?: string;
}

interface ChatResponse {
  reply: string;
  model?: string;
}

interface JournalEndResponse {
  journalId: number;
  summary: string;
}

interface ChatHistoryResponse {
  messages: Array<{ role: ChatRole; content: string }>;
}

interface ChatDeveloperStateResponse {
  activeCharacterNames: string[];
}

type CharacterGender = "male" | "female";

interface Character {
  id: number;
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance?: string | null;
}

interface AssistantTurn {
  CharacterName?: string;
  Text?: string;
  Tone?: string;
  Translation?: string;
}

const createMessage = (
  role: ChatRole,
  content: string,
  options: { characterName?: string; translation?: string; tone?: string } = {}
): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  timestamp: new Date().toISOString(),
  characterName: options.characterName,
  translation: options.translation,
  tone: options.tone
});

/**
 * Attempts to parse the assistant JSON reply into an array of turns.
 */
const parseAssistantReply = (content: string): AssistantTurn[] => {
  const trimmed = content.trim();

  if (!trimmed) {
    return [];
  }

  const tryParse = (input: string) => {
    try {
      const parsed = JSON.parse(input) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as AssistantTurn[];
      }
      if (parsed && typeof parsed === "object") {
        return [parsed as AssistantTurn];
      }
    } catch {
      return null;
    }

    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    const sliced = tryParse(trimmed.slice(arrayStart, arrayEnd + 1));
    if (sliced) {
      return sliced;
    }
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    const sliced = tryParse(trimmed.slice(objectStart, objectEnd + 1));
    if (sliced) {
      return sliced;
    }
  }

  return [];
};

/**
 * Normalizes an assistant reply into chat messages for rendering.
 */
const toAssistantMessages = (content: string): ChatMessage[] => {
  const turns = parseAssistantReply(content);

  if (!turns.length) {
    return [createMessage("assistant", content)];
  }

  return turns.map((turn) => {
    const text = typeof turn.Text === "string" ? turn.Text.trim() : "";
    const characterName = typeof turn.CharacterName === "string" ? turn.CharacterName.trim() : "Mimi";
    const translation = typeof turn.Translation === "string" ? turn.Translation.trim() : "";
    const tone = typeof turn.Tone === "string" ? turn.Tone.trim() : "";

    return createMessage("assistant", text || content, {
      characterName: characterName || "Mimi",
      translation,
      tone
    });
  });
};

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
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterIds, setActiveCharacterIds] = useState<number[]>([]);
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
          const hydrated = payload.messages.flatMap((message) => {
            if (message.role === "assistant") {
              return toAssistantMessages(message.content);
            }
            return [createMessage("user", message.content)];
          });
          setMessages(hydrated);
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

  useEffect(() => {
    let isActive = true;

    const loadCharacters = async () => {
      try {
        const response = await authFetch(apiUrl("/api/characters"));

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as Character[];

        if (isActive) {
          setCharacters(payload ?? []);
        }
      } catch {
        // Ignore character load errors.
      }
    };

    void loadCharacters();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (!characters.length) {
      setActiveCharacterIds([]);
      return () => {
        isActive = false;
      };
    }

    const normalizeName = (value: string) => value.trim().toLowerCase();

    const loadDeveloperState = async () => {
      try {
        const response = await authFetch(
          apiUrl(`/api/chat/developer-state?sessionId=${encodeURIComponent(sessionId)}`)
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ChatDeveloperStateResponse;

        if (!isActive) {
          return;
        }

        const activeNames = new Set((payload.activeCharacterNames ?? []).map(normalizeName));
        const nextActiveIds = characters
          .filter((character) => activeNames.has(normalizeName(character.name)))
          .map((character) => character.id);

        setActiveCharacterIds(nextActiveIds);
      } catch {
        // Ignore developer state load errors.
      }
    };

    void loadDeveloperState();

    return () => {
      isActive = false;
    };
  }, [characters, sessionId]);

  const addCharacterToChat = async (character: Character) => {
    if (activeCharacterIds.includes(character.id)) {
      return;
    }

    try {
      await authFetch(apiUrl("/api/chat/developer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          kind: "character_added",
          character: {
            name: character.name,
            personality: character.personality,
            gender: character.gender,
            appearance: character.appearance ?? null
          }
        })
      });

      setActiveCharacterIds((prev) => [...prev, character.id]);
    } catch {
      // Ignore developer message errors.
    }
  };

  const removeCharacterFromChat = async (character: Character) => {
    if (!activeCharacterIds.includes(character.id)) {
      return;
    }

    try {
      await authFetch(apiUrl("/api/chat/developer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          kind: "character_removed",
          character: {
            name: character.name
          }
        })
      });

      setActiveCharacterIds((prev) => prev.filter((id) => id !== character.id));
    } catch {
      // Ignore developer message errors.
    }
  };

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
    setNotice(null);

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

      setMessages((prev) => [...prev, ...toAssistantMessages(payload.reply)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (isEnding) {
      return;
    }

    setIsEnding(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authFetch(apiUrl("/api/journals/end"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to end conversation");
      }

      const payload = (await response.json()) as JournalEndResponse;

      setMessages([]);
      setActiveCharacterIds([]);
      setInput("");
      setNotice(`Journal saved (#${payload.journalId}).`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsEnding(false);
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
        <button
          type="button"
          className="chat-end-button"
          onClick={handleEndConversation}
          disabled={isEnding}
        >
          {isEnding ? "Ending..." : "End conversation"}
        </button>
      </header>

      <section className="chat-characters">
        <div className="chat-characters__panel">
          <h2>Characters</h2>
          {characters.length === 0 ? (
            <p className="chat-characters__muted">No characters yet. Create one in the Characters tab.</p>
          ) : (
            <ul className="chat-characters__list">
              {characters.map((character) => {
                const isActive = activeCharacterIds.includes(character.id);

                return (
                  <li key={character.id} className="chat-characters__item">
                    <div className="chat-characters__meta">
                      <p className="chat-characters__name">{character.name}</p>
                      <p className="chat-characters__desc">{character.personality}</p>
                    </div>
                    {isActive ? (
                      <button
                        type="button"
                        className="chat-characters__button"
                        onClick={() => removeCharacterFromChat(character)}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="chat-characters__button"
                        onClick={() => addCharacterToChat(character)}
                      >
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="chat-window">
        {error ? <p className="chat-error">{error}</p> : null}
        {notice ? <p className="chat-notice">{notice}</p> : null}
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
