import { useEffect, useRef, useState } from "react";
import type { VocabularyItem } from "../VocabularyView";
import { apiUrl } from "../../../lib/api";
import { authFetch } from "../../../lib/auth";

interface LinkedMessageResult {
  messageId: string;
  content: string;
  characterName: string;
  journalDate: string;
  audio: string | null;
}

interface Character {
  id: number;
  name: string;
  pitch?: number | null;
  speakingRate?: number | null;
}

const stripMemoryMarkers = (content: string) => content.replace(/\[MSG:[^\]]+\]/g, "").trim();

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
  const [linkedDetailsByVocab, setLinkedDetailsByVocab] = useState<Record<string, LinkedMessageResult[]>>({});
  const [linkedLoadingId, setLinkedLoadingId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());

  const getCharacterAudioSettings = (characterName?: string) => {
    if (!characterName) {
      return { speakingRate: 1.0, pitch: 0 };
    }

    const character = characters.find((item) => item.name === characterName);
    return {
      speakingRate: character?.speakingRate ?? 1.0,
      pitch: character?.pitch ?? 0
    };
  };

  const playAudio = async (audioId: string, characterName?: string) => {
    if (!audioId) return;

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
          throw new Error("Failed to load audio");
        }
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await context.decodeAudioData(arrayBuffer);
        audioCacheRef.current.set(audioId, audioBuffer);
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      const settings = getCharacterAudioSettings(characterName);
      source.playbackRate.value = settings.speakingRate || 1.0;
      if (source.detune) {
        source.detune.value = (settings.pitch || 0) * 50;
      }
      source.connect(context.destination);
      source.start(0);
    } catch (error) {
      console.error("Failed to play audio.", error);
    }
  };

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
      } catch (error) {
        console.warn("Failed to load characters for memory audio.", error);
      }
    };

    void loadCharacters();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    if (linkedDetailsByVocab[expandedId]) return;

    const item = items.find((v) => v.id === expandedId);
    if (!item?.memory?.linkedMessageIds?.length) return;

    const loadLinkedMessages = async () => {
      setLinkedLoadingId(expandedId);
      const messages: LinkedMessageResult[] = [];

      for (const id of item.memory?.linkedMessageIds ?? []) {
        try {
          const response = await authFetch(
            apiUrl(`/api/journals/search?q=${encodeURIComponent(id)}&limit=10`)
          );

          if (!response.ok) {
            continue;
          }

          const data = (await response.json()) as { results: LinkedMessageResult[] };
          const result = data.results.find((r) => r.messageId === id);

          if (result) {
            messages.push(result);
          }
        } catch {
          // Skip failed fetches
        }
      }

      setLinkedDetailsByVocab((prev) => ({ ...prev, [expandedId]: messages }));
      setLinkedLoadingId(null);
    };

    void loadLinkedMessages();
  }, [expandedId, items, linkedDetailsByVocab]);

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
        const memoryPreview = item.memory?.userMemory ? stripMemoryMarkers(item.memory.userMemory) : "";
        const previewText = memoryPreview || (item.memory?.linkedMessageIds?.length ? "Tin nhắn đã liên kết" : "");

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
                      <p>
                        {previewText.substring(0, 200)}
                        {previewText.length > 200 ? "..." : ""}
                      </p>
                      {item.memory.linkedMessageIds.length > 0 && (
                        <span className="vocab-item__linked-count">
                          🔗 {item.memory.linkedMessageIds.length} linked message(s)
                        </span>
                      )}
                    </div>
                  ) : null}
                  {item.memory?.linkedMessageIds?.length ? (
                    <div className="vocab-item__linked-messages">
                      {linkedLoadingId === item.id ? (
                        <p className="vocab-item__linked-loading">Đang tải tin nhắn...</p>
                      ) : null}
                      {linkedDetailsByVocab[item.id]?.map((msg) => (
                        <div key={msg.messageId} className="vocab-item__linked-message">
                          <div className="vocab-item__linked-meta">
                            <span className="vocab-item__linked-char">👤 {msg.characterName}</span>
                            <span className="vocab-item__linked-date">
                              📅 {new Date(msg.journalDate).toLocaleDateString("vi-VN")}
                            </span>
                            {msg.audio ? (
                              <button
                                type="button"
                                className="vocab-item__linked-audio-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void playAudio(msg.audio ?? "", msg.characterName);
                                }}
                                title="Nghe âm thanh"
                              >
                                🔊
                              </button>
                            ) : null}
                          </div>
                          <p className="vocab-item__linked-text">{msg.content}</p>
                        </div>
                      ))}
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
