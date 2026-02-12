import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

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

interface JournalSummary {
  id: number;
  summary: string;
  createdAt: string;
}

interface JournalMessage {
  id: number;
  content: string;
  characterName: string;
  translation?: string | null;
  tone?: string | null;
  audio?: string | null;
  createdAt: string;
}

interface JournalDetailResponse {
  journal: JournalSummary;
  messages: JournalMessage[];
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

const DEFAULT_TTS_TONE = "neutral, medium pitch";
const DEFAULT_SPEAKING_RATE = 1.0;
const DEFAULT_PITCH = 0;

const loggedWarnings = new Set<string>();

/**
 * Logs a warning only once per key to avoid spamming the console.
 */
const warnOnce = (key: string, message: string, error: unknown) => {
  if (loggedWarnings.has(key)) {
    return;
  }

  loggedWarnings.add(key);
  console.warn(message, error);
};

/**
 * Renders the Journal list and detail view.
 *
 * @returns The Journal view React component.
 */
interface JournalViewProps {
  userId: number;
}

const JournalView = ({ userId }: JournalViewProps) => {
  const storyStorageKey = `mimi_chat_story_id_${userId}`;
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [activeJournal, setActiveJournal] = useState<JournalSummary | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [openTranslations, setOpenTranslations] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [activeStoryId, setActiveStoryId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem(storyStorageKey);
    const parsed = stored ? Number.parseInt(stored, 10) : NaN;
    return Number.isInteger(parsed) ? parsed : null;
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  useEffect(() => {
    let isActive = true;

    const loadJournals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (activeStoryId) {
          params.set("storyId", String(activeStoryId));
        }
        const url = params.toString() ? `/api/journals?${params.toString()}` : "/api/journals";
        const response = await authFetch(apiUrl(url));

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Failed to load journals");
        }

        const payload = (await response.json()) as { journals: JournalSummary[] };

        if (isActive) {
          setJournals(payload.journals ?? []);
          if (payload.journals?.length) {
            setActiveJournal(payload.journals[0]);
          } else {
            setActiveJournal(null);
            setMessages([]);
          }
        }
      } catch (caught) {
        console.error("Failed to load journals.", caught);
        if (isActive) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadJournals();

    return () => {
      isActive = false;
    };
  }, [activeStoryId]);

  useEffect(() => {
    let isActive = true;

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

        if (!isActive) {
          return;
        }

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
        console.error("Failed to load stories.", caught);
        if (isActive) {
          setStoryError(caught instanceof Error ? caught.message : "Unknown error");
        }
      }
    };

    void loadStories();

    return () => {
      isActive = false;
    };
  }, [storyStorageKey]);

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
      } catch (caught) {
        warnOnce("journal.loadCharacters", "Failed to load characters; ignoring.", caught);
      }
    };

    void loadCharacters();

    return () => {
      isActive = false;
    };
  }, []);

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

  const getCharacterVoiceName = (characterName?: string) => {
    if (!characterName) {
      return "";
    }

    const character = characters.find((item) => item.name === characterName);
    return character?.voiceName?.trim() ?? "";
  };

  /**
   * Downloads the current active journal as a .txt file.
   */
  const handleDownloadTxt = () => {
    if (!activeJournal || messages.length === 0) {
      return;
    }

    const story = stories.find((s) => s.id === activeStoryId);
    let content = `Story: ${story?.name ?? "Unknown"}\n`;
    content += `Date: ${new Date(activeJournal.createdAt).toLocaleDateString()}\n`;
    content += `Summary: ${activeJournal.summary}\n\n`;
    content += `--- Conversation ---\n`;

    const lines = messages.map((msg) => {
      const sender = msg.characterName || "User";
      return `${sender}: ${msg.content}`;
    });

    content += lines.join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-${activeJournal.id}-${new Date(activeJournal.createdAt).toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let isActive = true;

    if (!activeJournal) {
      setMessages([]);
      return () => {
        isActive = false;
      };
    }

    const loadDetail = async () => {
      try {
        const response = await authFetch(apiUrl(`/api/journals/${activeJournal.id}`));

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Failed to load journal");
        }

        const payload = (await response.json()) as JournalDetailResponse;

        if (isActive) {
          setMessages(payload.messages ?? []);
          setOpenTranslations({});
        }
      } catch (caught) {
        console.error("Failed to load journal details.", caught);
        if (isActive) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      }
    };

    void loadDetail();

    return () => {
      isActive = false;
    };
  }, [activeJournal]);

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
      source.start();
    } catch (caught) {
      warnOnce("journal.playAudio", "Audio playback failed; ignoring.", caught);
    }
  };

  /**
   * Requests a TTS audio id for the given text and tone.
   *
   * @param text - Text to synthesize.
   * @param tone - Tone instruction for TTS.
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

    const payload = (await response.json()) as { output?: string };
    return payload.output ?? null;
  };

  /**
   * Ensures a journal message has playable audio, generating it when needed.
   *
   * @param message - Journal message to synthesize.
   * @param force - Force regeneration of audio.
   */
  const ensureAudio = async (message: JournalMessage, force = false) => {
    if (!force && message.audio) {
      const settings = getCharacterAudioSettings(message.characterName);
      void playAudio(message.audio, settings.speakingRate, settings.pitch);
      return;
    }

    const content = message.content.trim();
    if (!content) {
      return;
    }

    const tone = message.tone?.trim() || DEFAULT_TTS_TONE;
    const voiceName = getCharacterVoiceName(message.characterName);
    const audioId = await requestTts(content, tone, voiceName || undefined, force);
    if (!audioId) {
      return;
    }

    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, audio: audioId } : item))
    );
    const settings = getCharacterAudioSettings(message.characterName);
    void playAudio(audioId, settings.speakingRate, settings.pitch);
  };

  const handleStoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    const nextId = nextValue ? Number.parseInt(nextValue, 10) : NaN;
    const resolvedId = Number.isInteger(nextId) ? nextId : null;
    setActiveStoryId(resolvedId);
    setActiveJournal(null);
    setMessages([]);

    if (resolvedId) {
      window.localStorage.setItem(storyStorageKey, String(resolvedId));
    } else {
      window.localStorage.removeItem(storyStorageKey);
    }
  };

  return (
    <main className="journal-shell">
      <header className="journal-header">
        <div>
          <p className="journal-kicker">Journal</p>
          <h1>Conversation summaries</h1>
          <p className="journal-subtitle">Review past chats and all messages.</p>
        </div>
        <div className="journal-story-filter">
          <label htmlFor="journal-story-selector">Story</label>
          <select id="journal-story-selector" value={activeStoryId ?? ""} onChange={handleStoryChange}>
            <option value="">All stories</option>
            {stories.map((story) => (
              <option key={story.id} value={story.id}>
                {story.name}
              </option>
            ))}
          </select>
          {storyError ? <span className="journal-story-filter__error">{storyError}</span> : null}
        </div>
      </header>

      {error ? <p className="journal-error">{error}</p> : null}

      <section className="journal-content">
        <aside className="journal-list">
          <h2>Summaries</h2>
          {isLoading ? <p className="journal-muted">Loading...</p> : null}
          {!isLoading && journals.length === 0 ? (
            <p className="journal-muted">No journals yet.</p>
          ) : (
            <ul className="journal-list__items">
              {journals.map((journal) => (
                <li key={journal.id}>
                  <button
                    type="button"
                    className={`journal-card ${activeJournal?.id === journal.id ? "active" : ""}`}
                    onClick={() => setActiveJournal(journal)}
                  >
                    <p className="journal-card__summary">{journal.summary}</p>
                    <span className="journal-card__meta">
                      {new Date(journal.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="journal-detail">
          <div className="journal-detail__header">
            <h2>Messages</h2>
            {activeJournal && messages.length > 0 && (
              <button
                type="button"
                className="journal-detail__download"
                onClick={handleDownloadTxt}
                title="Download conversation as TXT"
              >
                Download TXT
              </button>
            )}
          </div>
          {!activeJournal ? (
            <p className="journal-muted">Select a journal to view messages.</p>
          ) : messages.length === 0 ? (
            <p className="journal-muted">No messages saved.</p>
          ) : (
            <div className="journal-messages">
              {messages.map((message) => (
                <article key={message.id} className="journal-message">
                  <div className="journal-message__header">
                    <span className="journal-message__name">{message.characterName}</span>
                    <span className="journal-message__time">
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="journal-message__text">{message.content}</p>
                  {message.tone || message.audio ? (
                    <div className="journal-message__audio-actions">
                      <button
                        type="button"
                        className="journal-message__audio-button"
                        onClick={() => void ensureAudio(message)}
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="journal-message__audio-button"
                        onClick={() => void ensureAudio(message, true)}
                      >
                        Reload
                      </button>
                    </div>
                  ) : null}
                  {message.translation ? (
                    <button
                      type="button"
                      className="journal-message__translate-toggle"
                      onClick={() =>
                        setOpenTranslations((prev) => ({
                          ...prev,
                          [message.id]: !prev[message.id]
                        }))
                      }
                    >
                      {openTranslations[message.id] ? "Hide translation" : "Translate"}
                    </button>
                  ) : null}
                  {message.translation && openTranslations[message.id] ? (
                    <p className="journal-message__translation">{message.translation}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
};

export default JournalView;
