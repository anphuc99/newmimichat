import { useState } from "react";
import type { VocabularyItem } from "../VocabularyView";

interface VocabularyListProps {
  items: VocabularyItem[];
  onReview: (vocabId: string, rating: number) => Promise<void>;
  onToggleStar: (vocabId: string) => Promise<void>;
  onDelete: (vocabId: string) => Promise<void>;
  onSaveMemory: (vocabId: string, memoryText: string, linkedIds?: string[]) => Promise<void>;
  onEditMemory?: (item: VocabularyItem) => void;
}

/**
 * Renders a vertical list of vocabulary items with inline actions.
 *
 * @param props - Vocabulary list dependencies.
 * @returns The vocabulary list component.
 */
const VocabularyList = ({
  items,
  onReview,
  onToggleStar,
  onDelete,
  onSaveMemory,
  onEditMemory
}: VocabularyListProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memoryDraft, setMemoryDraft] = useState("");

  const handleExpandToggle = (item: VocabularyItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(item.id);
    setMemoryDraft(item.memory?.userMemory ?? "");
  };

  return (
    <ul className="vocab-list">
      {items.map((item) => {
        const isExpanded = expandedId === item.id;
        const isDue =
          item.review?.nextReviewDate &&
          new Date(item.review.nextReviewDate) <= new Date();

        return (
          <li key={item.id} className={`vocab-item ${isDue ? "vocab-item--due" : ""}`}>
            <div className="vocab-item__row" onClick={() => handleExpandToggle(item)}>
              <span className="vocab-item__korean">{item.korean}</span>
              <span className="vocab-item__vietnamese">{item.vietnamese}</span>
              <span className="vocab-item__actions">
                <button
                  type="button"
                  className="vocab-item__star"
                  title={item.review?.isStarred ? "Unstar" : "Star"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleStar(item.id);
                  }}
                >
                  {item.review?.isStarred ? "★" : "☆"}
                </button>
                <button
                  type="button"
                  className="vocab-item__delete"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(item.id);
                  }}
                >
                  ✕
                </button>
              </span>
            </div>

            {isExpanded ? (
              <div className="vocab-item__details">
                {item.review ? (
                  <div className="vocab-item__review-info">
                    <p>
                      Stability: {item.review.stability.toFixed(2)} &middot;
                      Difficulty: {item.review.difficulty.toFixed(2)} &middot;
                      Next: {new Date(item.review.nextReviewDate).toLocaleDateString()} &middot;
                      Lapses: {item.review.lapses}
                    </p>
                    {isDue ? (
                      <div className="vocab-item__rating-buttons">
                        <span>Rate:</span>
                        <button type="button" onClick={() => void onReview(item.id, 1)}>
                          Again
                        </button>
                        <button type="button" onClick={() => void onReview(item.id, 2)}>
                          Hard
                        </button>
                        <button type="button" onClick={() => void onReview(item.id, 3)}>
                          Good
                        </button>
                        <button type="button" onClick={() => void onReview(item.id, 4)}>
                          Easy
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="vocab-item__memory">
                  {item.memory?.userMemory ? (
                    <div className="vocab-item__memory-preview">
                      <p>{item.memory.userMemory.substring(0, 200)}{item.memory.userMemory.length > 200 ? "..." : ""}</p>
                      {item.memory.linkedMessageIds.length > 0 && (
                        <span className="vocab-item__linked-count">
                          🔗 {item.memory.linkedMessageIds.length} linked message(s)
                        </span>
                      )}
                    </div>
                  ) : null}
                  {onEditMemory ? (
                    <button
                      type="button"
                      className="vocab-item__edit-memory-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMemory(item);
                      }}
                    >
                      📝 {item.memory?.userMemory ? "Edit" : "Add"} memory
                    </button>
                  ) : (
                    <>
                      <textarea
                        rows={3}
                        placeholder="Add a memory note..."
                        value={memoryDraft}
                        onChange={(e) => setMemoryDraft(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void onSaveMemory(
                            item.id,
                            memoryDraft,
                            item.memory?.linkedMessageIds
                          )
                        }
                      >
                        Save memory
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};

export default VocabularyList;
