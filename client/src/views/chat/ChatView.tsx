import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
  assistantId?: string;
  audioId?: string;
  characterName?: string;
  translation?: string;
  tone?: string;
  suppressAutoPlay?: boolean;
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

interface Story {
  id: number;
  name: string;
  description: string;
  currentProgress: string | null;
}

interface StoryListResponse {
  stories: Story[];
}

interface TtsResponse {
  success?: boolean;
  output?: string;
  url?: string;
}

type CharacterGender = "male" | "female";

interface Character {
  id: number;
  name: string;
  personality: string;
  gender: CharacterGender;
  appearance?: string | null;
  voiceName?: string | null;
  pitch?: number | null;
  speakingRate?: number | null;
}

interface AssistantTurn {
  MessageId?: string;
  CharacterName?: string;
  Text?: string;
  Tone?: string;
  Translation?: string;
}

const createMessage = (
  role: ChatRole,
  content: string,
  options: {
    assistantId?: string;
    audioId?: string;
    characterName?: string;
    translation?: string;
    tone?: string;
    suppressAutoPlay?: boolean;
  } = {}
): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  content,
  timestamp: new Date().toISOString(),
  assistantId: options.assistantId,
  audioId: options.audioId,
  characterName: options.characterName,
  translation: options.translation,
  tone: options.tone,
  suppressAutoPlay: options.suppressAutoPlay
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
    const assistantId = typeof turn.MessageId === "string" ? turn.MessageId.trim() : "";
    const text = typeof turn.Text === "string" ? turn.Text.trim() : "";
    const characterName = typeof turn.CharacterName === "string" ? turn.CharacterName.trim() : "Mimi";
    const translation = typeof turn.Translation === "string" ? turn.Translation.trim() : "";
    const tone = typeof turn.Tone === "string" ? turn.Tone.trim() : "";

    return createMessage("assistant", text || content, {
      assistantId: assistantId || undefined,
      characterName: characterName || "Mimi",
      translation,
      tone
    });
  });
};

const DEFAULT_TTS_TONE = "neutral, medium pitch";
const DEFAULT_SPEAKING_RATE = 1.0;
const DEFAULT_PITCH = 0;

/**
 * Requests a TTS audio id for the given text and tone.
 *
 * @param text - Text to synthesize.
 * @param tone - Tone instruction for TTS.
 * @param voice - Voice name override.
 * @param force - Regenerate even if cached.
 * @returns The audio id string or null when unavailable.
 */
const requestTts = async (text: string, tone: string, voice?: string, force = false) => {
  const params = new URLSearchParams({
    text,
    tone
  });

  if (voice) {
    params.set("voice", voice);
  }

  if (force) {
    params.set("force", "true");
  }

  const response = await authFetch(apiUrl(`/api/text-to-speech?${params.toString()}`));

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as TtsResponse;
  return payload.output ?? null;
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

/**
 * Reads a persisted toggle value from localStorage.
 *
 * @param storageKey - Key used for storing the toggle state.
 * @param defaultValue - Value used when storage is empty.
 * @returns The persisted toggle value.
 */
const readStoredToggle = (storageKey: string, defaultValue: boolean) => {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "true") {
    return true;
  }
  if (stored === "false") {
    return false;
  }
  return defaultValue;
};

/**
 * Persists a toggle value to localStorage.
 *
 * @param storageKey - Key used for storing the toggle state.
 * @param value - Value to persist.
 */
const persistToggle = (storageKey: string, value: boolean) => {
  window.localStorage.setItem(storageKey, value ? "true" : "false");
};

interface ChatViewProps {
  userId: number;
  model?: string;
}

/**
 * Renders the main Chat view for MimiChat.
 *
 * @returns The Chat view React component.
 */
const ChatView = ({ userId, model }: ChatViewProps) => {
  const storageKey = `mimi_chat_session_id_${userId}`;
  const storyStorageKey = `mimi_chat_story_id_${userId}`;
  const characterPanelKey = `mimi_chat_show_characters_${userId}`;
  const storyPanelKey = `mimi_chat_show_story_${userId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [input, setInput] = useState("");
  const [contextInput, setContextInput] = useState("");
  const [isContextSending, setIsContextSending] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterIds, setActiveCharacterIds] = useState<number[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [showCharacters, setShowCharacters] = useState(() => readStoredToggle(characterPanelKey, true));
  const [showStory, setShowStory] = useState(() => readStoredToggle(storyPanelKey, true));
  const [activeStoryId, setActiveStoryId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem(storyStorageKey);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isInteger(parsed) ? parsed : null;
  });
  const sessionId = useMemo(() => getOrCreateSessionId(storageKey), [storageKey]);
  const pendingAudio = useRef(new Set<string>());
  const playedAudio = useRef(new Set<string>());
  const skipAutoPlayOnce = useRef(false);
  const lastAutoPlayIndex = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  /**
   * Loads stories for the current user and keeps the active story selection.
   */
  const loadStories = async () => {
    setStoryError(null);

    try {
      const response = await authFetch(apiUrl("/api/stories"));

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to load stories");
      }

      const payload = (await response.json()) as StoryListResponse;
      const nextStories = payload.stories ?? [];
      setStories(nextStories);

      const stored = window.localStorage.getItem(storyStorageKey);
      const storedId = stored ? Number.parseInt(stored, 10) : NaN;
      const storedValid = Number.isInteger(storedId) && nextStories.some((story) => story.id === storedId);
      const nextActiveId = storedValid ? storedId : nextStories[0]?.id ?? null;

      setActiveStoryId(nextActiveId ?? null);
      if (nextActiveId) {
        window.localStorage.setItem(storyStorageKey, String(nextActiveId));
      } else {
        window.localStorage.removeItem(storyStorageKey);
      }
    } catch (caught) {
      setStoryError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  /**
   * Resolves playback settings for a character by name.
   *
   * @param characterName - Assistant character name.
   * @returns Playback rate and pitch offsets.
   */
  const getCharacterAudioSettings = (characterName?: string) => {
    if (!characterName) {
      return {
        speakingRate: DEFAULT_SPEAKING_RATE,
        pitch: DEFAULT_PITCH
      };
    }

    const character = characters.find((item) => item.name === characterName);
    return {
      speakingRate: character?.speakingRate ?? DEFAULT_SPEAKING_RATE,
      pitch: character?.pitch ?? DEFAULT_PITCH
    };
  };

  /**
   * Resolves the voice name for a character (if configured).
   *
   * @param characterName - Assistant character name.
   * @returns The voice name or an empty string when missing.
   */
  const getCharacterVoiceName = (characterName?: string) => {
    if (!characterName) {
      return "";
    }

    const character = characters.find((item) => item.name === characterName);
    return character?.voiceName?.trim() ?? "";
  };

  /**
   * Plays a cached audio file using per-character playback settings.
   *
   * @param audioId - Hash id for the audio file.
   * @param speakingRate - Playback rate multiplier.
   * @param pitch - Pitch shift offset (0 = default).
   */
  const playAudio = async (audioId: string, speakingRate = DEFAULT_SPEAKING_RATE, pitch = DEFAULT_PITCH) => {
    if (!audioId) {
      return;
    }

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const context = audioContextRef.current;
      if (context.state === "suspended") {
        await context.resume();
      }

      let audioBuffer = audioCacheRef.current.get(audioId);

      if (!audioBuffer) {
        const response = await fetch(apiUrl(`/audio/${audioId}.mp3`));
        if (!response.ok) {
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await context.decodeAudioData(arrayBuffer);
        audioCacheRef.current.set(audioId, audioBuffer);
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speakingRate || DEFAULT_SPEAKING_RATE;
      if (source.detune) {
        source.detune.value = (pitch || DEFAULT_PITCH) * 50;
      }

      source.connect(context.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    } catch {
      // Ignore playback errors.
    }
  };

  /**
   * Appends assistant messages one-by-one and waits for TTS playback before continuing.
   *
   * @param reply - Raw assistant reply payload.
   */
  const appendAssistantMessagesSequentially = async (reply: string) => {
    const turns = parseAssistantReply(reply);
    const normalizedTurns = turns.length
      ? turns
      : [{ Text: reply } as AssistantTurn];

    for (const turn of normalizedTurns) {
      const assistantId = typeof turn.MessageId === "string" ? turn.MessageId.trim() : "";
      const content = typeof turn.Text === "string" ? turn.Text.trim() : reply.trim();
      const characterName = typeof turn.CharacterName === "string" ? turn.CharacterName.trim() : "Mimi";
      const translation = typeof turn.Translation === "string" ? turn.Translation.trim() : "";
      const tone = typeof turn.Tone === "string" ? turn.Tone.trim() : DEFAULT_TTS_TONE;
      const voiceName = getCharacterVoiceName(characterName);
      const audioId = content
        ? await requestTts(content, tone || DEFAULT_TTS_TONE, voiceName || undefined)
        : null;

      const nextMessage = createMessage("assistant", content || reply, {
        assistantId: assistantId || undefined,
        characterName: characterName || "Mimi",
        translation,
        tone,
        audioId: audioId || undefined,
        suppressAutoPlay: true
      });

      setMessages((prev) => [...prev, nextMessage]);

      if (audioId) {
        const settings = getCharacterAudioSettings(characterName || "Mimi");
        playedAudio.current.add(nextMessage.id);
        await playAudio(audioId, settings.speakingRate, settings.pitch);
      }
    }
  };

  /**
   * Ensures a message has playable audio, generating it when needed.
   *
   * @param message - Chat message to synthesize.
   * @param force - Force regeneration of audio.
   */
  const ensureAudioForMessage = async (
    message: ChatMessage,
    options: { force?: boolean; allowReplay?: boolean } = {}
  ) => {
    const { force = false, allowReplay = false } = options;
    if (message.role !== "assistant") {
      return;
    }

    const content = message.content.trim();
    if (!content) {
      return;
    }

    const tone = message.tone?.trim() || DEFAULT_TTS_TONE;
    const voiceName = getCharacterVoiceName(message.characterName);

    if (!force && message.audioId) {
      if (allowReplay || !playedAudio.current.has(message.id)) {
        playedAudio.current.add(message.id);
        const settings = getCharacterAudioSettings(message.characterName);
        void playAudio(message.audioId, settings.speakingRate, settings.pitch);
      }
      return;
    }

    if (pendingAudio.current.has(message.id)) {
      return;
    }

    pendingAudio.current.add(message.id);
    try {
      const audioId = await requestTts(content, tone, voiceName || undefined, force);
      if (!audioId) {
        return;
      }

      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, audioId } : item))
      );

      if (allowReplay || !playedAudio.current.has(message.id)) {
        playedAudio.current.add(message.id);
        const settings = getCharacterAudioSettings(message.characterName);
        void playAudio(audioId, settings.speakingRate, settings.pitch);
      }
    } finally {
      pendingAudio.current.delete(message.id);
    }
  };

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
          skipAutoPlayOnce.current = true;
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
    if (skipAutoPlayOnce.current) {
      skipAutoPlayOnce.current = false;
      lastAutoPlayIndex.current = messages.length;
      return;
    }

    if (messages.length < lastAutoPlayIndex.current) {
      lastAutoPlayIndex.current = messages.length;
      return;
    }

    const startIndex = lastAutoPlayIndex.current;
    if (messages.length === startIndex) {
      return;
    }

    messages.slice(startIndex).forEach((message) => {
      if (message.role === "assistant" && message.content && !message.audioId && !message.suppressAutoPlay) {
        void ensureAudioForMessage(message);
      }
    });

    lastAutoPlayIndex.current = messages.length;
  }, [messages]);

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

  useEffect(() => {
    void loadStories();
  }, [storyStorageKey]);

  const activeStory = useMemo(
    () => stories.find((story) => story.id === activeStoryId) ?? null,
    [stories, activeStoryId]
  );

  const handleStoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    const nextId = nextValue ? Number.parseInt(nextValue, 10) : NaN;
    const resolvedId = Number.isInteger(nextId) ? nextId : null;
    setActiveStoryId(resolvedId);

    if (resolvedId) {
      window.localStorage.setItem(storyStorageKey, String(resolvedId));
    } else {
      window.localStorage.removeItem(storyStorageKey);
    }
  };

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
      setError(null);
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

  const hasActiveCharacter = activeCharacterIds.length > 0;
  const isChatLocked = isSending || isEnding || !hasActiveCharacter;
  const chatLockMessage = hasActiveCharacter ? null : "Add at least one character to start chatting.";

  const handleSend = async (text: string) => {
    const trimmed = text.trim();

    if (!trimmed || isSending || !hasActiveCharacter) {
      if (!hasActiveCharacter) {
        setError("Add at least one character before chatting.");
      }
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
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          model: model?.trim() || undefined,
          storyId: activeStoryId ?? undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to send message");
      }

      const payload = (await response.json()) as ChatResponse;

      await appendAssistantMessagesSequentially(payload.reply);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSending(false);
    }
  };

  const handlePlayAudio = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }

    void ensureAudioForMessage(message, { allowReplay: true });
  };

  const handleReloadAudio = (messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message) {
      return;
    }

    void ensureAudioForMessage(message, { force: true, allowReplay: true });
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
        body: JSON.stringify({
          sessionId,
          storyId: activeStoryId ?? undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to end conversation");
      }

      const payload = (await response.json()) as JournalEndResponse;

      setMessages([]);
      setActiveCharacterIds([]);
      setInput("");
      if (activeStoryId) {
        await loadStories();
      }
      setNotice(`Journal saved (#${payload.journalId}).`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsEnding(false);
    }
  };

  /**
   * Sends developer context to the chat history.
   */
  const handleSendContext = async () => {
    const trimmed = contextInput.trim();

    if (!trimmed || isContextSending) {
      return;
    }

    setIsContextSending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await authFetch(apiUrl("/api/chat/developer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          kind: "context_update",
          context: trimmed
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to save context");
      }

      setContextInput("");
      setNotice("Context saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsContextSending(false);
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
        <div className="chat-header__actions">
          <button
            type="button"
            className="chat-toggle-button"
            onClick={() =>
              setShowCharacters((prev) => {
                const nextValue = !prev;
                persistToggle(characterPanelKey, nextValue);
                return nextValue;
              })
            }
          >
            {showCharacters ? "Hide characters" : "Show characters"}
          </button>
          <button
            type="button"
            className="chat-toggle-button"
            onClick={() =>
              setShowStory((prev) => {
                const nextValue = !prev;
                persistToggle(storyPanelKey, nextValue);
                return nextValue;
              })
            }
          >
            {showStory ? "Hide story" : "Show story"}
          </button>
          <button
            type="button"
            className="chat-end-button"
            onClick={handleEndConversation}
            disabled={isEnding}
          >
            {isEnding ? "Ending..." : "End conversation"}
          </button>
        </div>
      </header>

      {showCharacters ? (
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
      ) : null}

      {showStory ? (
        <section className="chat-story">
          <div className="chat-story__panel">
            <div className="chat-story__header">
              <h2>Story</h2>
              <select value={activeStoryId ?? ""} onChange={handleStoryChange}>
                <option value="">No story</option>
                {stories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.name}
                  </option>
                ))}
              </select>
            </div>
            {storyError ? <p className="chat-story__error">{storyError}</p> : null}
            {activeStory ? (
              <div className="chat-story__content">
                <p className="chat-story__label">Description</p>
                <p className="chat-story__text">{activeStory.description}</p>
                <p className="chat-story__label">Current progress</p>
                <p className="chat-story__text">
                  {activeStory.currentProgress?.trim() ? activeStory.currentProgress : "No progress yet."}
                </p>
              </div>
            ) : (
              <p className="chat-story__muted">No story selected. Create one in the Story tab.</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="chat-context">
        <div className="chat-context__panel">
          <div className="chat-context__header">
            <h2>Developer context</h2>
            <button
              type="button"
              className="chat-context__button"
              onClick={handleSendContext}
              disabled={isContextSending}
            >
              {isContextSending ? "Saving..." : "Save context"}
            </button>
          </div>
          <textarea
            className="chat-context__field"
            rows={3}
            placeholder="Add developer context for the assistant..."
            value={contextInput}
            onChange={(event) => setContextInput(event.target.value)}
            disabled={isContextSending}
          />
          <p className="chat-context__hint">This context is stored as a developer message for this session.</p>
        </div>
      </section>

      <section className="chat-window">
        {error ? <p className="chat-error">{error}</p> : null}
        {notice ? <p className="chat-notice">{notice}</p> : null}
        {chatLockMessage ? <p className="chat-notice">{chatLockMessage}</p> : null}
        <MessageList
          messages={messages}
          pendingMessage={pendingMessage}
          onPlayAudio={handlePlayAudio}
          onReloadAudio={handleReloadAudio}
        />
      </section>

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isChatLocked}
      />
    </main>
  );
};

export default ChatView;
