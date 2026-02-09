import { useState } from "react";
import type { VocabularyItem } from "../VocabularyView";

interface VocabularyFlashcardProps {
  item: VocabularyItem;
  index: number;
  total: number;
  onRate: (rating: number) => void;
  onToggleStar: () => void;
}

/**
 * Renders a single flashcard with flip-to-reveal and FSRS rating buttons.
 *
 * @param props - Flashcard dependencies.
 * @returns The flashcard component.
 */
const VocabularyFlashcard = ({
  item,
  index,
  total,
  onRate,
  onToggleStar
}: VocabularyFlashcardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const direction = item.review?.cardDirection ?? "kr-vn";
  const front = direction === "kr-vn" ? item.korean : item.vietnamese;
  const back = direction === "kr-vn" ? item.vietnamese : item.korean;

  const handleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  const handleRate = (rating: number) => {
    setIsFlipped(false);
    onRate(rating);
  };

  return (
    <div className="vocab-flashcard">
      <div className="vocab-flashcard__progress">
        {index + 1} / {total}
      </div>

      <div
        className={`vocab-flashcard__card ${isFlipped ? "flipped" : ""}`}
        onClick={handleFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            handleFlip();
          }
        }}
      >
        <div className="vocab-flashcard__front">
          <p className="vocab-flashcard__text">{front}</p>
          <p className="vocab-flashcard__hint">Click to reveal</p>
        </div>
        {isFlipped ? (
          <div className="vocab-flashcard__back">
            <p className="vocab-flashcard__text vocab-flashcard__text--answer">{back}</p>
            {item.memory?.userMemory ? (
              <p className="vocab-flashcard__memory">{item.memory.userMemory}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="vocab-flashcard__actions">
        <button
          type="button"
          className="vocab-flashcard__star"
          onClick={onToggleStar}
        >
          {item.review?.isStarred ? "★ Starred" : "☆ Star"}
        </button>
      </div>

      {isFlipped ? (
        <div className="vocab-flashcard__ratings">
          <button type="button" className="rating-btn rating-btn--again" onClick={() => handleRate(1)}>
            Again
          </button>
          <button type="button" className="rating-btn rating-btn--hard" onClick={() => handleRate(2)}>
            Hard
          </button>
          <button type="button" className="rating-btn rating-btn--good" onClick={() => handleRate(3)}>
            Good
          </button>
          <button type="button" className="rating-btn rating-btn--easy" onClick={() => handleRate(4)}>
            Easy
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default VocabularyFlashcard;
