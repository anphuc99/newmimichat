import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

/** Translation review history entry. */
interface ReviewHistoryEntry {
  date: string;
  rating: number;
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyBefore: number;
  difficultyAfter: number;
  retrievability: number;
}

/** FSRS review state returned from the server. */
interface TranslationReview {
  id: number;
  translationCardId: number;
  stability: number;
  difficulty: number;
  lapses: number;
  currentIntervalDays: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  isStarred: boolean;
  reviewHistory: ReviewHistoryEntry[];
}

/** Translation card with review info. */
interface TranslationCard {
  id: number;
  messageId: string;
  content: string;
  translation: string | null;
  userTranslation: string | null;
  characterName: string;
  journalId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  review: TranslationReview | null;
}

/** Random learn candidate returned by the API. */
interface LearnCandidate {
  messageId: string;
  content: string;
  translation: string | null;
  characterName: string;
  journalId: number;
  createdAt: string;
}

/** Translation stats payload. */
interface TranslationStats {
  totalCards: number;
  withReview: number;
  withoutReview: number;
  dueToday: number;
  starredCount: number;
  difficultCount: number;
}

type TabId = "due" | "difficult" | "starred" | "learn";

interface TranslationFlashcardProps {
  title: string;
  content: string;
  translation: string | null;
  characterName: string;
  isStarred?: boolean;
  showStar?: boolean;
  onRate: (rating: number, userTranslation: string) => void;
  onToggleStar?: () => void;
}

/**
 * Renders a translation drill flashcard with rating controls.
 *
 * @param props - Component props.
 * @returns The flashcard UI for translation drilling.
 */
const TranslationFlashcard = ({
  title,
  content,
  translation,
  characterName,
  isStarred,
  showStar,
  onRate,
  onToggleStar
}: TranslationFlashcardProps) => {
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setDraft("");
    setRevealed(false);
  }, [content, translation]);

  return (
    <div className="translation-card">
      <div className="translation-card__header">
        <div>
          <p className="translation-card__title">{title}</p>
          <p className="translation-card__subtitle">{characterName}</p>
        </div>
        {showStar ? (
          <button type="button" className="translation-card__star" onClick={onToggleStar}>
            {isStarred ? "Starred" : "Star"}
          </button>
        ) : null}
      </div>
      <div className="translation-card__prompt">{content}</div>
      <label className="translation-card__label" htmlFor="translation-input">
        Your translation
      </label>
      <textarea
        id="translation-input"
        className="translation-card__input"
        rows={3}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Nhap cau ban dich..."
      />
      {revealed ? (
        <div className="translation-card__answer">
          <span>Dap an goi y:</span>
          <strong>{translation || "(Chua co ban dich mau)"}</strong>
        </div>
      ) : null}
      <div className="translation-card__actions">
        {!revealed ? (
          <button type="button" className="translation-card__primary" onClick={() => setRevealed(true)}>
            Xem dap an
          </button>
        ) : (
          <div className="translation-card__ratings">
            {[1, 2, 3, 4].map((rating) => (
              <button
                key={rating}
                type="button"
                className="translation-card__rating"
                onClick={() => onRate(rating, draft)}
              >
                {rating === 1 ? "Again" : rating === 2 ? "Hard" : rating === 3 ? "Good" : "Easy"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Renders the Translation Drill view.
 *
 * @returns The Translation view React component.
 */
const TranslationView = () => {
  const [tab, setTab] = useState<TabId>("learn");
  const [allCards, setAllCards] = useState<TranslationCard[]>([]);
  const [dueCards, setDueCards] = useState<TranslationCard[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [learnCandidate, setLearnCandidate] = useState<LearnCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLearnLoading, setIsLearnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [cardsRes, dueRes, statsRes] = await Promise.all([
        authFetch(apiUrl("/api/translation")),
        authFetch(apiUrl("/api/translation/due")),
        authFetch(apiUrl("/api/translation/stats"))
      ]);

      if (!cardsRes.ok || !dueRes.ok || !statsRes.ok) {
        throw new Error("Failed to load translation data");
      }

      const cardsPayload = (await cardsRes.json()) as { cards: TranslationCard[] };
      const duePayload = (await dueRes.json()) as { cards: TranslationCard[]; total: number };
      const statsPayload = (await statsRes.json()) as TranslationStats;

      setAllCards(cardsPayload.cards ?? []);
      setDueCards(duePayload.cards ?? []);
      setStats(statsPayload);
    } catch (caught) {
      console.error("Failed to load translation data.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLearnCandidate = useCallback(async () => {
    setIsLearnLoading(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/translation/learn"));

      if (!response.ok) {
        if (response.status === 404) {
          setLearnCandidate(null);
          return;
        }
        throw new Error("Failed to load learn candidate");
      }

      const payload = (await response.json()) as LearnCandidate;
      setLearnCandidate(payload);
    } catch (caught) {
      console.error("Failed to load learn candidate.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLearnLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === "learn") {
      void fetchLearnCandidate();
    }
  }, [tab, fetchLearnCandidate]);

  useEffect(() => {
    setReviewIndex(0);
  }, [tab, dueCards, allCards]);

  const starredItems = useMemo(
    () => allCards.filter((card) => card.review?.isStarred),
    [allCards]
  );

  const difficultItems = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

    return allCards.filter((card) => {
      if (!card.review?.reviewHistory?.length) {
        return false;
      }

      return card.review.reviewHistory.some((entry) => {
        const reviewDate = new Date(entry.date).toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh"
        });
        return reviewDate === todayStr && (entry.rating === 1 || entry.rating === 2);
      });
    });
  }, [allCards]);

  const activeList = useMemo(() => {
    if (tab === "due") return dueCards;
    if (tab === "difficult") return difficultItems;
    if (tab === "starred") return starredItems;
    return [] as TranslationCard[];
  }, [tab, dueCards, difficultItems, starredItems]);

  /**
   * Sends a translation review rating for an existing card.
   *
   * @param cardId - Translation card ID.
   * @param rating - FSRS rating (1-4).
   * @param userTranslation - User-provided translation.
   */
  const handleReview = async (cardId: number, rating: number, userTranslation: string) => {
    try {
      const response = await authFetch(apiUrl("/api/translation/review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, cardId, userTranslation })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to review translation card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  /**
   * Sends a translation review rating for a new random message.
   *
   * @param messageId - Message ID used to create a new card.
   * @param rating - FSRS rating (1-4).
   * @param userTranslation - User-provided translation.
   */
  const handleLearnReview = async (messageId: string, rating: number, userTranslation: string) => {
    try {
      const response = await authFetch(apiUrl("/api/translation/review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, messageId, userTranslation })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      await fetchAll();
      await fetchLearnCandidate();
    } catch (caught) {
      console.error("Failed to review translation learn card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  /**
   * Toggles star status for a translation card.
   *
   * @param cardId - Translation card ID.
   */
  const handleToggleStar = async (cardId: number) => {
    try {
      const response = await authFetch(apiUrl(`/api/translation/${cardId}/star`), {
        method: "PUT"
      });

      if (!response.ok) {
        throw new Error("Toggle star failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to toggle translation star.", caught);
    }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "due", label: "Due", count: dueCards.length },
    { id: "difficult", label: "Difficult", count: difficultItems.length },
    { id: "starred", label: "Starred", count: starredItems.length },
    { id: "learn", label: "Learn", count: learnCandidate ? 1 : 0 }
  ];

  return (
    <main className="translation-shell">
      <header className="translation-header">
        <h1>Translation Drill</h1>
        {stats ? (
          <p className="translation-stats">
            {stats.totalCards} cards - {stats.dueToday} due - {stats.starredCount} starred
          </p>
        ) : null}
      </header>

      <nav className="translation-tabs">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`translation-tab ${tab === entry.id ? "active" : ""}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.count != null ? <span className="translation-tab__count">{entry.count}</span> : null}
          </button>
        ))}
      </nav>

      {error ? <p className="translation-error">{error}</p> : null}

      {isLoading ? (
        <p className="translation-loading">Loading...</p>
      ) : tab === "learn" ? (
        isLearnLoading ? (
          <p className="translation-loading">Loading...</p>
        ) : learnCandidate ? (
          <TranslationFlashcard
            title="Learn"
            content={learnCandidate.content}
            translation={learnCandidate.translation}
            characterName={learnCandidate.characterName}
            onRate={(rating, draft) => handleLearnReview(learnCandidate.messageId, rating, draft)}
          />
        ) : (
          <p className="translation-empty">No new messages available for learning.</p>
        )
      ) : activeList.length === 0 ? (
        <p className="translation-empty">No cards in this tab.</p>
      ) : (
        <TranslationFlashcard
          title={tab === "due" ? "Due" : tab === "difficult" ? "Difficult" : "Starred"}
          content={activeList[reviewIndex]?.content ?? ""}
          translation={activeList[reviewIndex]?.translation ?? null}
          characterName={activeList[reviewIndex]?.characterName ?? ""}
          isStarred={!!activeList[reviewIndex]?.review?.isStarred}
          showStar
          onToggleStar={() => {
            const active = activeList[reviewIndex];
            if (active) {
              void handleToggleStar(active.id);
            }
          }}
          onRate={(rating, draft) => {
            const active = activeList[reviewIndex];
            if (!active) {
              return;
            }

            void handleReview(active.id, rating, draft);

            if (reviewIndex < activeList.length - 1) {
              setReviewIndex((prev) => prev + 1);
            } else {
              setReviewIndex(0);
            }
          }}
        />
      )}
    </main>
  );
};

export default TranslationView;
