import { useEffect, useRef, useState } from "react";
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

const DEFAULT_TTS_TONE = "neutral, medium pitch";
const DEFAULT_SPEAKING_RATE = 1.0;
const DEFAULT_PITCH = 0;

/**
 * Renders the Journal list and detail view.
 *
 * @returns The Journal view React component.
 */
const JournalView = () => {
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [activeJournal, setActiveJournal] = useState<JournalSummary | null>(null);
  const [messages, setMessages] = useState<JournalMessage[]>([]);
  const [openTranslations, setOpenTranslations] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  useEffect(() => {
    let isActive = true;

    const loadJournals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authFetch(apiUrl("/api/journals"));

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
  }, []);

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
    } catch {
      // Ignore playback errors.
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

  return (
    <main className="journal-shell">
      <header className="journal-header">
        <div>
          <p className="journal-kicker">Journal</p>
          <h1>Conversation summaries</h1>
          <p className="journal-subtitle">Review past chats and all messages.</p>
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
          <h2>Messages</h2>
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
