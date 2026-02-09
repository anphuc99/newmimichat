import { useState } from "react";
import { apiUrl } from "../../../lib/api";
import { authFetch } from "../../../lib/auth";

interface VocabularyCollectPopupProps {
  /** Pre-filled Korean text (from selection or assistant message). */
  initialKorean?: string;
  /** Message IDs to link to the memory. */
  linkedMessageIds?: string[];
  /** Called when the popup should close. */
  onClose: () => void;
  /** Called after a successful collection to refresh parent state. */
  onCollected?: () => void;
}

/**
 * A popup overlay that lets users collect a Korean word/phrase from a chat
 * message and add it to their vocabulary with translation, memory note, and
 * initial difficulty rating.
 *
 * @param props - Collection popup dependencies.
 * @returns The vocabulary collect popup component.
 */
const VocabularyCollectPopup = ({
  initialKorean = "",
  linkedMessageIds = [],
  onClose,
  onCollected
}: VocabularyCollectPopupProps) => {
  const [korean, setKorean] = useState(initialKorean);
  const [vietnamese, setVietnamese] = useState("");
  const [memory, setMemory] = useState("");
  const [difficulty, setDifficulty] = useState<"very_easy" | "easy" | "medium" | "hard">("medium");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Submits the vocabulary collection request.
   */
  const handleSubmit = async () => {
    const trimmedK = korean.trim();
    const trimmedV = vietnamese.trim();

    if (!trimmedK || !trimmedV) {
      setError("Both Korean and Vietnamese are required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/vocabulary"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          korean: trimmedK,
          vietnamese: trimmedV,
          memory: memory.trim() || undefined,
          linkedMessageIds: linkedMessageIds.length ? linkedMessageIds : undefined,
          difficultyRating: difficulty
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to collect vocabulary");
      }

      setSuccess(true);
      onCollected?.();

      // Auto close after a short delay
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (caught) {
      console.error("Failed to collect vocabulary.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="vocab-collect-overlay" onClick={onClose}>
      <div
        className="vocab-collect-popup"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Collect vocabulary"
      >
        <div className="vocab-collect-popup__header">
          <h3>Collect Vocabulary</h3>
          <button type="button" className="vocab-collect-popup__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {success ? (
          <p className="vocab-collect-popup__success">Collected!</p>
        ) : (
          <>
            <div className="vocab-collect-popup__field">
              <label htmlFor="vocab-korean">Korean</label>
              <input
                id="vocab-korean"
                type="text"
                value={korean}
                onChange={(e) => setKorean(e.target.value)}
                placeholder="한국어"
                autoFocus
              />
            </div>

            <div className="vocab-collect-popup__field">
              <label htmlFor="vocab-vietnamese">Vietnamese</label>
              <input
                id="vocab-vietnamese"
                type="text"
                value={vietnamese}
                onChange={(e) => setVietnamese(e.target.value)}
                placeholder="Tiếng Việt"
              />
            </div>

            <div className="vocab-collect-popup__field">
              <label htmlFor="vocab-memory">Memory note (optional)</label>
              <textarea
                id="vocab-memory"
                rows={3}
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                placeholder="Add a note to help you remember..."
              />
            </div>

            <div className="vocab-collect-popup__field">
              <label htmlFor="vocab-difficulty">Initial difficulty</label>
              <select
                id="vocab-difficulty"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as "very_easy" | "easy" | "medium" | "hard")
                }
              >
                <option value="very_easy">Very Easy (14 days)</option>
                <option value="easy">Easy (7 days)</option>
                <option value="medium">Medium (3 days)</option>
                <option value="hard">Hard (1 day)</option>
              </select>
            </div>

            {error ? <p className="vocab-collect-popup__error">{error}</p> : null}

            <div className="vocab-collect-popup__actions">
              <button type="button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Collect"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VocabularyCollectPopup;
