import { useEffect, useState } from "react";

type ChatRole = "user" | "assistant";

interface MessageBubbleProps {
  role: ChatRole;
  content: string;
  timestamp: string;
  characterName?: string;
  translation?: string;
  showAudioControls?: boolean;
  isEditable?: boolean;
  onEdit?: (nextContent: string) => void;
  onPlayAudio?: () => void;
  onReloadAudio?: () => void;
  onCollectVocab?: (korean: string) => void;
}

/**
 * Renders a single chat message bubble.
 *
 * @param props - Dependencies injected from the Chat view.
 * @returns The message bubble component.
 */
const MessageBubble = ({
  role,
  content,
  timestamp,
  characterName,
  translation,
  showAudioControls,
  isEditable,
  onEdit,
  onPlayAudio,
  onReloadAudio,
  onCollectVocab
}: MessageBubbleProps) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const timeLabel = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  useEffect(() => {
    if (!isEditing) {
      setDraft(content);
    }
  }, [content, isEditing]);

  const showActions =
    Boolean(translation) ||
    Boolean(showAudioControls) ||
    Boolean(onCollectVocab && role === "assistant") ||
    Boolean(isEditable);

  return (
    <article className={`chat-bubble chat-bubble--${role}`}>
      {characterName ? <p className="chat-bubble__name">{characterName}</p> : null}
      {isEditing ? (
        <textarea
          className="chat-bubble__edit-field"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <p className="chat-bubble__text">{content}</p>
      )}
      {translation && showTranslation ? <p className="chat-bubble__translation">{translation}</p> : null}
      {showActions ? (
        <div className="chat-bubble__actions">
          {translation ? (
            <button
              type="button"
              className="chat-bubble__icon-button"
              onClick={() => setShowTranslation((prev) => !prev)}
              title={showTranslation ? "Hide translation" : "Show translation"}
              aria-label={showTranslation ? "Hide translation" : "Show translation"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h10M9 6v3m0 0L5 14m4-5 4 5m4-8h3m-1 0v12m-6 0h8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          {showAudioControls ? (
            <button
              type="button"
              className="chat-bubble__icon-button"
              onClick={onPlayAudio}
              title="Play audio"
              aria-label="Play audio"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polygon points="8,6 18,12 8,18" fill="currentColor" />
              </svg>
            </button>
          ) : null}
          {showAudioControls ? (
            <button
              type="button"
              className="chat-bubble__icon-button"
              onClick={onReloadAudio}
              title="Reload audio"
              aria-label="Reload audio"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M20 12a8 8 0 1 1-2.35-5.65M20 5v5h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          {role === "assistant" && onCollectVocab ? (
            <button
              type="button"
              className="chat-bubble__icon-button"
              onClick={() => onCollectVocab(content)}
              title="Collect vocabulary"
              aria-label="Collect vocabulary"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 4h9a3 3 0 0 1 3 3v10H9a3 3 0 0 0-3 3V4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 18h9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
          {isEditable && !isEditing ? (
            <button
              type="button"
              className="chat-bubble__icon-button"
              onClick={() => setIsEditing(true)}
              title="Edit"
              aria-label="Edit"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          {isEditable && isEditing ? (
            <>
              <button
                type="button"
                className="chat-bubble__icon-button"
                onClick={() => {
                  const trimmed = draft.trim();
                  if (trimmed && onEdit) {
                    onEdit(trimmed);
                  }
                  setIsEditing(false);
                }}
                title="Save"
                aria-label="Save"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12l4 4L19 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="chat-bubble__icon-button"
                onClick={() => {
                  setDraft(content);
                  setIsEditing(false);
                }}
                title="Cancel"
                aria-label="Cancel"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6l-12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      <span className="chat-bubble__meta">{timeLabel}</span>
    </article>
  );
};

export default MessageBubble;
