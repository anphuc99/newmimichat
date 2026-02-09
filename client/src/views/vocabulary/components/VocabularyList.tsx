import { useState } from "react";
import type { VocabularyItem } from "../VocabularyView";

interface VocabularyListProps {
  items: VocabularyItem[];
  onReview: (vocabId: number, rating: number) => Promise<void>;
  onToggleStar: (vocabId: number) => Promise<void>;
  onDelete: (vocabId: number) => Promise<void>;
  onSaveMemory: (vocabId: number, memoryText: string, linkedIds?: string[]) => Promise<void>;
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
  onSaveMemory
}: VocabularyListProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
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
