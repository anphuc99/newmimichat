import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VocabularyFlashcard,
  VocabularyList,
  VocabularyMemoryEditor,
  VocabularySearch
} from "./components";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

/** A vocabulary item returned from the server. */
export interface VocabularyItem {
  id: string;
  korean: string;
  vietnamese: string;
  isManuallyAdded: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
  review: VocabularyReview | null;
  memory: VocabularyMemory | null;
}

/** FSRS review state returned from the server. */
export interface VocabularyReview {
  id: number;
  vocabularyId: string;
  stability: number;
  difficulty: number;
  lapses: number;
  currentIntervalDays: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  cardDirection: string;
  isStarred: boolean;
  reviewHistory: ReviewHistoryEntry[];
}

/** A single entry in the review history array. */
export interface ReviewHistoryEntry {
  date: string;
  rating: number;
  stability: number;
  difficulty: number;
  interval: number;
}

/** Memory attached to a vocabulary item. */
export interface VocabularyMemory {
  id: number;
  vocabularyId: string;
  userMemory: string;
  linkedMessageIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Stats payload. */
interface VocabularyStats {
  totalVocabularies: number;
  withReview: number;
  withoutReview: number;
  dueToday: number;
  starredCount: number;
  difficultCount: number;
}

type TabId = "all" | "due" | "difficult" | "starred" | "learn";

interface VocabularyViewProps {
  /** Current user ID for keying storage. */
  userId: number;
}

/**
 * Renders the Vocabulary memory / spaced-repetition view.
 *
 * Includes tabs: All, Due, Difficult, Starred, Learn (flashcard mode).
 *
 * @returns The Vocabulary view React component.
 */
const VocabularyView = (_props: VocabularyViewProps) => {
  const [tab, setTab] = useState<TabId>("all");
  const [allItems, setAllItems] = useState<VocabularyItem[]>([]);
  const [dueItems, setDueItems] = useState<VocabularyItem[]>([]);
  const [stats, setStats] = useState<VocabularyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Manual add form state ─────────────────────────────────────────────
  const [showAddForm, setShowAddForm] = useState(false);
  const [addKorean, setAddKorean] = useState("");
  const [addVietnamese, setAddVietnamese] = useState("");
  const [addDifficulty, setAddDifficulty] = useState<"very_easy" | "easy" | "medium" | "hard">("medium");
  const [isAdding, setIsAdding] = useState(false);

  // ── Learn mode state ──────────────────────────────────────────────────
  const [learnIndex, setLearnIndex] = useState(0);
  const [simpleQueue, setSimpleQueue] = useState<VocabularyItem[]>([]);
  const [dueQueueIds, setDueQueueIds] = useState<string[]>([]);
  const [dueIndex, setDueIndex] = useState(0);

  // ── Memory editor state ───────────────────────────────────────────────
  const [editingVocab, setEditingVocab] = useState<VocabularyItem | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [vocabRes, dueRes, statsRes] = await Promise.all([
        authFetch(apiUrl("/api/vocabulary")),
        authFetch(apiUrl("/api/vocabulary/due")),
        authFetch(apiUrl("/api/vocabulary/stats"))
      ]);

      if (!vocabRes.ok || !dueRes.ok || !statsRes.ok) {
        throw new Error("Failed to load vocabulary data");
      }

      const vocabPayload = (await vocabRes.json()) as { vocabularies: VocabularyItem[] };
      const duePayload = (await dueRes.json()) as { vocabularies: VocabularyItem[]; total: number };
      const statsPayload = (await statsRes.json()) as VocabularyStats;

      setAllItems(vocabPayload.vocabularies ?? []);
      setDueItems(duePayload.vocabularies ?? []);
      setStats(statsPayload);
    } catch (caught) {
      console.error("Failed to load vocabulary data.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setDueQueueIds((prev) => {
      const dueIds = dueItems.map((item) => item.id);
      if (dueIds.length === 0) {
        return [];
      }
      if (prev.length === 0) {
        return dueIds;
      }
      const dueSet = new Set(dueIds);
      return prev.filter((id) => dueSet.has(id));
    });
  }, [dueItems]);

  // ── Filtered items ────────────────────────────────────────────────────

  const starredItems = useMemo(
    () => allItems.filter((v) => v.review?.isStarred),
    [allItems]
  );

  const difficultItems = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

    return allItems.filter((v) => {
      if (!v.review?.reviewHistory?.length) {
        return false;
      }

      return v.review.reviewHistory.some((h) => {
        const reviewDate = new Date(h.date).toLocaleDateString("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh"
        });
        return reviewDate === todayStr && (h.rating === 1 || h.rating === 2);
      });
    });
  }, [allItems]);

  const searchedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return allItems;
    }

    return allItems.filter(
      (v) =>
        v.korean.toLowerCase().includes(q) ||
        v.vietnamese.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const learnItems = useMemo(
    () => dueItems.filter((item) => !(item.review?.reviewHistory?.length ?? 0)),
    [dueItems]
  );

  const dueQueue = useMemo(() => {
    const map = new Map(dueItems.map((item) => [item.id, item] as const));
    return dueQueueIds.map((id) => map.get(id)).filter(Boolean) as VocabularyItem[];
  }, [dueQueueIds, dueItems]);

  /** Items shown in the current tab (excluding learn). */
  const displayItems = useMemo(() => {
    switch (tab) {
      case "due":
        return dueQueue;
      case "starred":
        return starredItems;
      case "difficult":
        return difficultItems;
      default:
        return searchedItems;
    }
  }, [tab, dueQueue, starredItems, difficultItems, searchedItems]);

  const resetSimpleQueue = useCallback((items: VocabularyItem[]) => {
    setSimpleQueue(items);
  }, []);

  useEffect(() => {
    if (tab === "difficult") {
      resetSimpleQueue(difficultItems);
    } else if (tab === "starred") {
      resetSimpleQueue(starredItems);
    }
  }, [tab, difficultItems, starredItems, resetSimpleQueue]);

  const handleSimpleRemember = useCallback(() => {
    setSimpleQueue((prev) => {
      const next = prev.slice(1);
      return next;
    });
  }, []);

  const handleSimpleForgot = useCallback(() => {
    setSimpleQueue((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return [...prev.slice(1), prev[0]];
    });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────

  /**
   * Submits a review rating for a vocabulary item.
   *
   * @param vocabId - Vocabulary item ID (string).
   * @param rating - FSRS rating 1–4.
   */
  const handleReview = async (vocabId: string, rating: number, skipRefresh = false) => {
    try {
      const response = await authFetch(apiUrl(`/api/vocabulary/${vocabId}/review`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      // Refresh data after review
      if (!skipRefresh) {
        await fetchAll();
      }
    } catch (caught) {
      console.error("Failed to review vocabulary.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  const handleDueReview = async (vocabId: string, rating: number) => {
    await handleReview(vocabId, rating, true);

    setDueQueueIds((prev) => {
      const next = prev.filter((id) => id !== vocabId);

      if (next.length === 0) {
        void fetchAll().then(() => {
          setDueQueueIds([]);
          setDueIndex(0);
        });
        return [];
      }

      return next;
    });

    setDueIndex((prev) => (prev >= dueQueue.length - 1 ? 0 : prev));
  };

  /**
   * Toggles star status for a vocabulary item.
   *
   * @param vocabId - Vocabulary item ID (string).
   */
  const handleToggleStar = async (vocabId: string) => {
    try {
      const response = await authFetch(apiUrl(`/api/vocabulary/${vocabId}/star`), {
        method: "PUT"
      });

      if (!response.ok) {
        throw new Error("Toggle star failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to toggle star.", caught);
    }
  };

  /**
   * Deletes a vocabulary item.
   *
   * @param vocabId - Vocabulary item ID (string).
   */
  const handleDelete = async (vocabId: string) => {
    if (!window.confirm("Delete this vocabulary?")) {
      return;
    }

    try {
      const response = await authFetch(apiUrl(`/api/vocabulary/${vocabId}`), {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to delete vocabulary.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  /**
   * Manually adds a vocabulary item.
   */
  const handleManualAdd = async () => {
    const trimmedK = addKorean.trim();
    const trimmedV = addVietnamese.trim();

    if (!trimmedK || !trimmedV || isAdding) {
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/vocabulary"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korean: trimmedK,
          vietnamese: trimmedV,
          difficultyRating: addDifficulty
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to add vocabulary");
      }

      setAddKorean("");
      setAddVietnamese("");
      setShowAddForm(false);
      await fetchAll();
    } catch (caught) {
      console.error("Failed to add vocabulary.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * Saves or updates memory text for a vocabulary.
   *
   * @param vocabId - Vocabulary item ID (string).
   * @param memoryText - User memory content.
   * @param linkedIds - Optional linked message IDs.
   */
  const handleSaveMemory = async (vocabId: string, memoryText: string, linkedIds?: string[]) => {
    try {
      const response = await authFetch(apiUrl(`/api/vocabulary/${vocabId}/memory`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMemory: memoryText,
          linkedMessageIds: linkedIds ?? []
        })
      });

      if (!response.ok) {
        throw new Error("Save memory failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to save memory.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "all", label: "All", count: allItems.length },
    { id: "due", label: "Due", count: dueQueue.length },
    { id: "difficult", label: "Difficult", count: difficultItems.length },
    { id: "starred", label: "Starred", count: starredItems.length },
    { id: "learn", label: "Learn", count: learnItems.length }
  ];

  return (
    <main className="vocab-shell">
      <header className="vocab-header">
        <h1>Vocabulary & Memory</h1>
        {stats ? (
          <p className="vocab-stats">
            {stats.totalVocabularies} words &middot; {stats.dueToday} due &middot;{" "}
            {stats.starredCount} starred
          </p>
        ) : null}
        <button
          type="button"
          className="vocab-add-button"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? "Cancel" : "+ Add word"}
        </button>
      </header>

      {showAddForm ? (
        <section className="vocab-add-form">
          <input
            type="text"
            placeholder="Korean"
            value={addKorean}
            onChange={(e) => setAddKorean(e.target.value)}
          />
          <input
            type="text"
            placeholder="Vietnamese"
            value={addVietnamese}
            onChange={(e) => setAddVietnamese(e.target.value)}
          />
          <select
            value={addDifficulty}
            onChange={(e) =>
              setAddDifficulty(e.target.value as "very_easy" | "easy" | "medium" | "hard")
            }
          >
            <option value="very_easy">Very Easy</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <button type="button" onClick={handleManualAdd} disabled={isAdding}>
            {isAdding ? "Adding..." : "Add"}
          </button>
        </section>
      ) : null}

      <nav className="vocab-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`vocab-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => {
              setTab(t.id);
              if (t.id === "learn" || t.id === "due") {
                setLearnIndex(0);
              }
            }}
          >
            {t.label}
            {t.count != null ? <span className="vocab-tab__count">{t.count}</span> : null}
          </button>
        ))}
      </nav>

      {error ? <p className="vocab-error">{error}</p> : null}

      {isLoading ? (
        <p className="vocab-loading">Loading...</p>
      ) : tab === "learn" || tab === "due" ? (
        (tab === "learn" ? learnItems : dueQueue).length === 0 ? (
          <p className="vocab-empty">No items due for review. Come back later!</p>
        ) : (
          <VocabularyFlashcard
            item={(tab === "learn" ? learnItems : dueQueue)[tab === "learn" ? learnIndex : dueIndex]!}
            index={tab === "learn" ? learnIndex : dueIndex}
            total={(tab === "learn" ? learnItems : dueQueue).length}
            onRate={(rating: number) => {
              const activeItems = tab === "learn" ? learnItems : dueQueue;
              const currentIndex = tab === "learn" ? learnIndex : dueIndex;
              const currentItem = activeItems[currentIndex];
              if (currentItem) {
                if (tab === "due") {
                  void handleDueReview(currentItem.id, rating);
                } else {
                  void handleReview(currentItem.id, rating);
                }
              }

              if (tab === "learn") {
                if (learnIndex < activeItems.length - 1) {
                  setLearnIndex((prev) => prev + 1);
                } else {
                  setTab("all");
                  setLearnIndex(0);
                }
              } else if (tab === "due") {
                if (dueIndex < activeItems.length - 1) {
                  setDueIndex((prev) => prev + 1);
                } else {
                  setDueIndex(0);
                }
              }
            }}
            onToggleStar={() => {
              const activeItems = tab === "learn" ? learnItems : dueQueue;
              const currentIndex = tab === "learn" ? learnIndex : dueIndex;
              const currentItem = activeItems[currentIndex];
              if (currentItem) {
                void handleToggleStar(currentItem.id);
              }
            }}
          />
        )
      ) : tab === "difficult" || tab === "starred" ? (
        (tab === "difficult" ? difficultItems : starredItems).length === 0 ? (
          <p className="vocab-empty">No vocabulary items in this tab.</p>
        ) : simpleQueue.length === 0 ? (
          <div className="vocab-empty">
            <p>Hoàn thành lượt học.</p>
            <button
              type="button"
              className="vocab-add-button"
              onClick={() =>
                resetSimpleQueue(tab === "difficult" ? difficultItems : starredItems)
              }
            >
              Học lại
            </button>
          </div>
        ) : (
          <div className="vocab-flashcard">
            <div className="vocab-flashcard__progress">
              {(tab === "difficult" ? difficultItems : starredItems).length - simpleQueue.length + 1} / {(
                tab === "difficult" ? difficultItems : starredItems
              ).length}
            </div>
            <div className="vocab-flashcard__card flipped">
              <div className="vocab-flashcard__front">
                <p className="vocab-flashcard__text">{simpleQueue[0]?.korean}</p>
                <p className="vocab-flashcard__hint">Nhớ hay quên?</p>
              </div>
              <div className="vocab-flashcard__back">
                <p className="vocab-flashcard__text vocab-flashcard__text--answer">
                  {simpleQueue[0]?.vietnamese}
                </p>
                {simpleQueue[0]?.memory?.userMemory ? (
                  <p className="vocab-flashcard__memory">{simpleQueue[0]?.memory?.userMemory}</p>
                ) : null}
              </div>
            </div>
            <div className="vocab-flashcard__ratings">
              <button
                type="button"
                className="rating-btn rating-btn--good"
                onClick={handleSimpleRemember}
              >
                Nhớ
              </button>
              <button
                type="button"
                className="rating-btn rating-btn--again"
                onClick={handleSimpleForgot}
              >
                Quên
              </button>
            </div>
          </div>
        )
      ) : (
        <>
          {tab === "all" ? (
            <VocabularySearch value={searchQuery} onChange={setSearchQuery} />
          ) : null}
          {displayItems.length === 0 ? (
            <p className="vocab-empty">No vocabulary items in this tab.</p>
          ) : (
            <VocabularyList
              items={displayItems}
              onReview={handleReview}
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              onSaveMemory={handleSaveMemory}
              onEditMemory={setEditingVocab}
            />
          )}
        </>
      )}

      {/* Memory Editor Overlay */}
      {editingVocab && (
        <div className="vocab-memory-overlay">
          <VocabularyMemoryEditor
            vocabulary={editingVocab}
            existingMemory={editingVocab.memory}
            onSave={async (userMemory, linkedMessageIds) => {
              await handleSaveMemory(editingVocab.id, userMemory, linkedMessageIds);
              setEditingVocab(null);
            }}
            onCancel={() => setEditingVocab(null)}
          />
        </div>
      )}
    </main>
  );
};

export default VocabularyView;
