import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

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
  audio?: string | null;
  createdAt: string;
}

interface JournalDetailResponse {
  journal: JournalSummary;
  messages: JournalMessage[];
}

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
