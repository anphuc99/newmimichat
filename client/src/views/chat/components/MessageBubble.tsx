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
      {translation ? (
        <button
          type="button"
          className="chat-bubble__translate-toggle"
          onClick={() => setShowTranslation((prev) => !prev)}
        >
          {showTranslation ? "Hide translation" : "Translate"}
        </button>
      ) : null}
      {translation && showTranslation ? <p className="chat-bubble__translation">{translation}</p> : null}
      {isEditable && !isEditing ? (
        <button
          type="button"
          className="chat-bubble__edit-button"
          onClick={() => setIsEditing(true)}
        >
          Edit
        </button>
      ) : null}
      {isEditable && isEditing ? (
        <div className="chat-bubble__edit-actions">
          <button
            type="button"
            className="chat-bubble__edit-button"
            onClick={() => {
              const trimmed = draft.trim();
              if (trimmed && onEdit) {
                onEdit(trimmed);
              }
              setIsEditing(false);
            }}
          >
            Save
          </button>
          <button
            type="button"
            className="chat-bubble__edit-button"
            onClick={() => {
              setDraft(content);
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {showAudioControls ? (
        <div className="chat-bubble__audio-actions">
          <button type="button" className="chat-bubble__audio-button" onClick={onPlayAudio}>
            Play
          </button>
          <button type="button" className="chat-bubble__audio-button" onClick={onReloadAudio}>
            Reload
          </button>
        </div>
      ) : null}
      {role === "assistant" && onCollectVocab ? (
        <button
          type="button"
          className="chat-bubble__collect-button"
          onClick={() => onCollectVocab(content)}
          title="Collect vocabulary from this message"
        >
          📝 Collect
        </button>
      ) : null}
      <span className="chat-bubble__meta">{timeLabel}</span>
    </article>
  );
};

export default MessageBubble;
