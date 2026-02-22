import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
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
  audio?: string | null;
  explanationMd?: string | null;
  journalId: number;
  journalSummary?: string | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  review: TranslationReview | null;
}

/** Learn candidate returned by the API. */
interface LearnCandidate {
  messageId: string;
  content: string;
  translation: string | null;
  characterName: string;
  audio?: string | null;
  journalId: number;
  journalSummary?: string | null;
  createdAt: string;
}

interface Character {
  id: number;
  name: string;
  pitch?: number | null;
  speakingRate?: number | null;
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

/** Token comparison result for shadowing. */
interface ShadowingToken {
  text: string;
  match: boolean;
}

interface TranslationFlashcardProps {
  title: string;
  content: string;
  translation: string | null;
  characterName: string;
  audioId?: string | null;
  journalSummary?: string | null;
  isStarred?: boolean;
  showStar?: boolean;
  onPlayAudio?: (audioId: string, characterName?: string) => void;
  explanationMd?: string | null;
  isExplainLoading?: boolean;
  onExplain?: (draft: string) => void;
  onRate: (rating: number, userTranslation: string) => void;
  onToggleStar?: () => void;
  ratingOptions?: Array<{ value: number; label: string }>;
  // Shadowing props
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string | null;
  comparison: ShadowingToken[];
}

/**
 * Renders a unified translation/listening/shadowing drill flashcard.
 * Workflow:
 * 1. First hides text and plays audio (listening mode)
 * 2. Button to reveal text
 * 3. Shows AI explanation, recording for shadowing, and rating options
 *
 * @param props - Component props.
 * @returns The flashcard UI for drilling.
 */
const TranslationFlashcard = ({
  title,
  content,
  translation,
  characterName,
  audioId,
  journalSummary,
  isStarred,
  showStar,
  onPlayAudio,
  explanationMd,
  isExplainLoading,
  onExplain,
  onRate,
  onToggleStar,
  ratingOptions,
  onStartRecording,
  onStopRecording,
  isRecording,
  isTranscribing,
  transcript,
  comparison
}: TranslationFlashcardProps) => {
  const [draft, setDraft] = useState("");
  const [textRevealed, setTextRevealed] = useState(false);
  const [meaningRevealed, setMeaningRevealed] = useState(false);

  const resolvedRatings =
    ratingOptions ??
    [
      { value: 1, label: "Again" },
      { value: 2, label: "Hard" },
      { value: 3, label: "Good" },
      { value: 4, label: "Easy" }
    ];

  // Reset state when content changes
  useEffect(() => {
    setDraft("");
    setTextRevealed(false);
    setMeaningRevealed(false);
  }, [content, translation]);

  // Show ratings only when text is revealed
  const canRate = textRevealed;

  return (
    <div className="translation-card">
      <div className="translation-card__header">
        <div>
          <p className="translation-card__title">{title}</p>
          <p className="translation-card__subtitle">{characterName}</p>
          {journalSummary ? (
            <p className="translation-card__journal">
              📖 {journalSummary}
            </p>
          ) : null}
        </div>
        <div className="translation-card__header-actions">
          {audioId && onPlayAudio ? (
            <button
              type="button"
              className="translation-card__audio"
              onClick={() => onPlayAudio(audioId, characterName)}
              title="Nghe am thanh"
            >
              🔊 Audio
            </button>
          ) : null}
          {showStar ? (
            <button type="button" className="translation-card__star" onClick={onToggleStar}>
              {isStarred ? "⭐ Starred" : "☆ Star"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Hidden/revealed text - first listen then reveal */}
      <div className="translation-card__prompt">
        {textRevealed ? content : "••••••••••••••••••••"}
      </div>

      {/* Reveal text button */}
      {!textRevealed ? (
        <button
          type="button"
          className="translation-card__primary"
          onClick={() => setTextRevealed(true)}
        >
          👁 Hien chu
        </button>
      ) : null}

      {/* Show additional controls when text is revealed */}
      {textRevealed ? (
        <>
          {/* User translation input */}
          <label className="translation-card__label" htmlFor="translation-input">
            Ban dich cua ban
          </label>
          <textarea
            id="translation-input"
            className="translation-card__input"
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Nhap cau ban dich..."
          />

          {/* Show meaning button and answer */}
          {meaningRevealed ? (
            <div className="translation-card__answer">
              <span>Dap an goi y:</span>
              <strong>{translation || "(Chua co ban dich mau)"}</strong>
            </div>
          ) : (
            <button
              type="button"
              className="translation-card__primary"
              onClick={() => setMeaningRevealed(true)}
            >
              📖 Xem nghia
            </button>
          )}

          {/* AI Explanation */}
          {explanationMd ? (
            <div className="translation-card__explanation">
              <ReactMarkdown>{explanationMd}</ReactMarkdown>
            </div>
          ) : null}

          {/* Shadowing controls */}
          <div className="shadowing-controls">
            <button
              type="button"
              className={`translation-card__primary ${isRecording ? "shadowing-recording" : ""}`}
              onClick={isRecording ? onStopRecording : onStartRecording}
            >
              {isRecording ? "⏹ Stop" : "🎤 Ghi am"}
            </button>
            {isTranscribing ? <span className="shadowing-status">Dang chuyen doi...</span> : null}
          </div>

          {/* Shadowing result */}
          {transcript ? (
            <div className="shadowing-result">
              <div className="shadowing-result__label">Transcript</div>
              <div className="shadowing-result__text">{transcript}</div>
              <div className="shadowing-compare">
                {comparison.map((token, index) => (
                  <span
                    key={`${token.text}-${index}`}
                    className={`shadowing-token ${token.match ? "shadowing-token--match" : "shadowing-token--mismatch"}`}
                  >
                    {token.text}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="translation-card__actions">
            {onExplain ? (
              <button
                type="button"
                className="translation-card__explain"
                onClick={() => onExplain(draft)}
                disabled={isExplainLoading}
              >
                {isExplainLoading ? "Dang giai thich..." : "🤖 AI giai thich"}
              </button>
            ) : null}

            {/* Rating buttons */}
            {canRate ? (
              <div className="translation-card__ratings">
                {resolvedRatings.map((rating) => (
                  <button
                    key={rating.value}
                    type="button"
                    className="translation-card__rating"
                    onClick={() => onRate(rating.value, draft)}
                  >
                    {rating.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

/**
 * Tokenizes a string for shadowing comparison.
 */
const tokenize = (value: string) =>
  value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

/**
 * Normalizes a token for case-insensitive comparison.
 */
const normalizeToken = (value: string) => value.toLowerCase();

/**
 * Builds token comparison between reference and transcript.
 */
const buildComparison = (reference: string, transcript: string): ShadowingToken[] => {
  const referenceTokens = tokenize(reference);
  const transcriptTokens = tokenize(transcript);

  return referenceTokens.map((token, index) => {
    const candidate = transcriptTokens[index] ?? "";
    return {
      text: token,
      match: normalizeToken(token) === normalizeToken(candidate)
    };
  });
};

/**
 * Converts a Blob to a data URL.
 */
const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });

/**
 * Renders the unified Translation/Listening/Shadowing Drill view.
 *
 * @returns The Translation view React component.
 */
const TranslationView = () => {
  const [tab, setTab] = useState<TabId>("learn");
  const [allCards, setAllCards] = useState<TranslationCard[]>([]);
  const [dueCards, setDueCards] = useState<TranslationCard[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [learnCandidates, setLearnCandidates] = useState<LearnCandidate[]>([]);
  const [learnIndex, setLearnIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLearnLoading, setIsLearnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [explanationMd, setExplanationMd] = useState<string | null>(null);
  const [isExplanationVisible, setIsExplanationVisible] = useState(false);
  const [explanationCardId, setExplanationCardId] = useState<number | null>(null);
  const [isExplainLoading, setIsExplainLoading] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const [practiceQueues, setPracticeQueues] = useState<{ difficult: number[]; starred: number[] }>({
    difficult: [],
    starred: []
  });
  const [dueQueueIds, setDueQueueIds] = useState<number[]>([]);

  // Shadowing state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ShadowingToken[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTargetRef = useRef<{ content: string; translation: string | null } | null>(null);

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

  const fetchLearnCandidates = useCallback(async () => {
    setIsLearnLoading(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/translation/learn"));

      if (!response.ok) {
        throw new Error("Failed to load learn candidates");
      }

      const payload = (await response.json()) as { candidates: LearnCandidate[] };
      setLearnCandidates(payload.candidates ?? []);
      setLearnIndex(0);
    } catch (caught) {
      console.error("Failed to load learn candidates.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLearnLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setDueQueueIds((prev) => {
      const dueIds = dueCards.map((card) => card.id);
      if (dueIds.length === 0) {
        return [];
      }
      if (prev.length === 0) {
        return dueIds;
      }
      const dueSet = new Set(dueIds);
      return prev.filter((id) => dueSet.has(id));
    });
  }, [dueCards]);

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
      } catch (caught) {
        console.warn("Failed to load characters for translation audio.", caught);
      }
    };

    void loadCharacters();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (tab === "learn") {
      void fetchLearnCandidates();
    }
  }, [tab, fetchLearnCandidates]);

  useEffect(() => {
    setReviewIndex(0);
  }, [tab, dueCards, allCards]);

  // Current learn candidate
  const currentLearnCandidate = learnCandidates[learnIndex] ?? null;

  useEffect(() => {
    if (tab !== "learn") {
      return;
    }

    setExplanationMd(null);
  }, [tab, currentLearnCandidate?.messageId]);

  // Reset shadowing state when card changes
  useEffect(() => {
    setTranscript(null);
    setComparison([]);
  }, [tab, reviewIndex, currentLearnCandidate?.messageId]);

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

  const cardById = useMemo(() => new Map(allCards.map((card) => [card.id, card])), [allCards]);
  const difficultIds = useMemo(() => difficultItems.map((card) => card.id), [difficultItems]);
  const starredIds = useMemo(() => starredItems.map((card) => card.id), [starredItems]);

  const syncQueue = (current: number[], next: number[]) => {
    const nextSet = new Set(next);
    const kept = current.filter((id) => nextSet.has(id));
    const keptSet = new Set(kept);
    const appended = next.filter((id) => !keptSet.has(id));
    return [...kept, ...appended];
  };

  useEffect(() => {
    setPracticeQueues((prev) => ({
      difficult: syncQueue(prev.difficult, difficultIds),
      starred: syncQueue(prev.starred, starredIds)
    }));
  }, [difficultIds, starredIds]);

  const difficultQueue = useMemo(
    () => practiceQueues.difficult.map((id) => cardById.get(id)).filter(Boolean) as TranslationCard[],
    [practiceQueues.difficult, cardById]
  );

  const starredQueue = useMemo(
    () => practiceQueues.starred.map((id) => cardById.get(id)).filter(Boolean) as TranslationCard[],
    [practiceQueues.starred, cardById]
  );

  const dueQueue = useMemo(
    () => dueQueueIds.map((id) => cardById.get(id)).filter(Boolean) as TranslationCard[],
    [dueQueueIds, cardById]
  );

  useEffect(() => {
    if (tab === "difficult" && difficultQueue.length === 0 && difficultIds.length > 0) {
      setPracticeQueues((prev) => ({
        ...prev,
        difficult: [...difficultIds]
      }));
      setReviewIndex(0);
      return;
    }

    if (tab === "starred" && starredQueue.length === 0 && starredIds.length > 0) {
      setPracticeQueues((prev) => ({
        ...prev,
        starred: [...starredIds]
      }));
      setReviewIndex(0);
    }
  }, [tab, difficultQueue.length, starredQueue.length, difficultIds, starredIds]);

  const activeList = useMemo(() => {
    if (tab === "due") return dueQueue;
    if (tab === "difficult") return difficultQueue;
    if (tab === "starred") return starredQueue;
    return [] as TranslationCard[];
  }, [tab, dueQueue, difficultQueue, starredQueue]);

  const activeCard = activeList[reviewIndex] ?? null;

  useEffect(() => {
    if (tab === "learn") {
      return;
    }

    const active = activeList[reviewIndex];
    if (active?.id !== explanationCardId) {
      setIsExplanationVisible(false);
      setExplanationCardId(active?.id ?? null);
    }
  }, [tab, activeList, reviewIndex, explanationCardId]);

  const getCharacterAudioSettings = (name?: string) => {
    if (!name) {
      return { speakingRate: 1.0, pitch: 0 };
    }

    const character = characters.find((item) => item.name === name);
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
    } catch (caught) {
      console.error("Failed to play translation audio.", caught);
    }
  };

  const handleExplain = async (payload: {
    cardId?: number;
    messageId?: string;
    userTranslation?: string;
  }) => {
    setIsExplainLoading(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/translation/explain"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Explain failed");
      }

      const data = (await response.json()) as { explanation: string; card: TranslationCard };
      setExplanationMd(data.explanation);

      setAllCards((prev) => {
        const exists = prev.some((card) => card.id === data.card.id);
        if (!exists) {
          return [data.card, ...prev];
        }
        return prev.map((card) =>
          card.id === data.card.id ? { ...card, explanationMd: data.explanation } : card
        );
      });
      setDueCards((prev) =>
        prev.map((card) => (card.id === data.card.id ? { ...card, explanationMd: data.explanation } : card))
      );
    } catch (caught) {
      console.error("Failed to explain translation card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsExplainLoading(false);
    }
  };

  /**
   * Sends a translation review rating for an existing card.
   *
   * @param cardId - Translation card ID.
   * @param rating - FSRS rating (1-4).
   * @param userTranslation - User-provided translation.
   */
  const handleReview = async (cardId: number, rating: number, userTranslation: string, skipRefresh = false) => {
    try {
      const response = await authFetch(apiUrl("/api/translation/review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, cardId, userTranslation })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      if (!skipRefresh) {
        await fetchAll();
      }
    } catch (caught) {
      console.error("Failed to review translation card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  const handleDueReview = async (cardId: number, rating: number, userTranslation: string) => {
    await handleReview(cardId, rating, userTranslation, true);

    setDueQueueIds((prev) => {
      const next = prev.filter((id) => id !== cardId);

      if (next.length === 0) {
        void fetchAll().then(() => {
          setDueQueueIds([]);
          setReviewIndex(0);
        });
        return [];
      }

      return next;
    });

    setReviewIndex((prev) => (prev >= dueQueue.length - 1 ? 0 : prev));
  };

  /**
   * Sends a translation review rating for a new message from learn candidates.
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

      // Remove current candidate from list and move to next
      setLearnCandidates((prev) => prev.filter((c) => c.messageId !== messageId));
      // Keep same index if there are more candidates, reset if at end
      setLearnIndex((prev) => {
        const newLength = learnCandidates.length - 1;
        return prev >= newLength ? Math.max(0, newLength - 1) : prev;
      });
      await fetchAll();
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

  const handleLocalQueueReview = (queue: "difficult" | "starred", cardId: number, action: "hard" | "easy") => {
    const listLength = activeList.length;

    setPracticeQueues((prev) => {
      const current = prev[queue];
      const next = current.filter((id) => id !== cardId);

      if (action === "hard") {
        next.push(cardId);
      }

      return {
        ...prev,
        [queue]: next
      };
    });

    setReviewIndex((prev) => {
      if (listLength <= 1) {
        return 0;
      }

      if (action === "hard") {
        return prev < listLength - 1 ? prev : 0;
      }

      const nextLength = listLength - 1;
      if (nextLength <= 0) {
        return 0;
      }

      return prev >= nextLength ? 0 : prev;
    });
  };

  // Shadowing functions
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    const targetContent = tab === "learn" ? currentLearnCandidate?.content : activeCard?.content;
    const targetTranslation = tab === "learn" ? currentLearnCandidate?.translation ?? null : activeCard?.translation ?? null;

    if (!targetContent) {
      setError("No text available for shadowing");
      return;
    }

    setError(null);
    setTranscript(null);
    setComparison([]);
    setIsTranscribing(false);
    recordingTargetRef.current = { content: targetContent, translation: targetTranslation };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        if (!chunks.length) {
          return;
        }

        try {
          setIsTranscribing(true);
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const audio = await blobToDataUrl(blob);
          const response = await authFetch(apiUrl("/api/translation/transcribe"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio })
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { message?: string } | null;
            throw new Error(payload?.message ?? "Transcribe failed");
          }

          const payload = (await response.json()) as { transcript: string };
          const transcriptText = payload.transcript?.trim() ?? "";
          setTranscript(transcriptText || null);

          const reference = recordingTargetRef.current?.content ?? "";
          setComparison(buildComparison(reference, transcriptText));
        } catch (caught) {
          console.error("Failed to transcribe audio.", caught);
          setError(caught instanceof Error ? caught.message : "Unknown error");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (caught) {
      console.error("Failed to start recording.", caught);
      setError(caught instanceof Error ? caught.message : "Unable to access microphone");
    }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "due", label: "Due", count: dueQueue.length },
    { id: "difficult", label: "Difficult", count: difficultQueue.length },
    { id: "starred", label: "Starred", count: starredQueue.length },
    { id: "learn", label: "Learn", count: learnCandidates.length }
  ];

  return (
    <main className="translation-shell">
      <header className="translation-header">
        <h1>Luyen tap</h1>
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
        ) : currentLearnCandidate ? (
          <TranslationFlashcard
            title={`Learn (${learnIndex + 1}/${learnCandidates.length})`}
            content={currentLearnCandidate.content}
            translation={currentLearnCandidate.translation}
            characterName={currentLearnCandidate.characterName}
            audioId={currentLearnCandidate.audio ?? null}
            journalSummary={currentLearnCandidate.journalSummary ?? null}
            onPlayAudio={playAudio}
            explanationMd={explanationMd}
            isExplainLoading={isExplainLoading}
            onExplain={(draft) =>
              handleExplain({ messageId: currentLearnCandidate.messageId, userTranslation: draft })
            }
            onRate={(rating, draft) => handleLearnReview(currentLearnCandidate.messageId, rating, draft)}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            transcript={transcript}
            comparison={comparison}
          />
        ) : (
          <p className="translation-empty">No new messages available for learning.</p>
        )
      ) : activeList.length === 0 ? (
        <p className="translation-empty">No cards in this tab.</p>
      ) : (
        <TranslationFlashcard
          title={
            tab === "due"
              ? `Due (${reviewIndex + 1}/${activeList.length})`
              : tab === "difficult"
              ? `Difficult (${reviewIndex + 1}/${activeList.length})`
              : `Starred (${reviewIndex + 1}/${activeList.length})`
          }
          content={activeCard?.content ?? ""}
          translation={activeCard?.translation ?? null}
          characterName={activeCard?.characterName ?? ""}
          audioId={activeCard?.audio ?? null}
          journalSummary={activeCard?.journalSummary ?? null}
          isStarred={!!activeCard?.review?.isStarred}
          showStar
          onPlayAudio={playAudio}
          explanationMd={
            isExplanationVisible && explanationCardId === activeCard?.id
              ? activeCard?.explanationMd ?? null
              : null
          }
          isExplainLoading={isExplainLoading}
          onExplain={(draft) => {
            const active = activeCard;
            if (active) {
              setIsExplanationVisible(true);
              setExplanationCardId(active.id);
              void handleExplain({ cardId: active.id, userTranslation: draft });
            }
          }}
          onToggleStar={() => {
            const active = activeCard;
            if (active) {
              void handleToggleStar(active.id);
            }
          }}
          ratingOptions={
            tab === "difficult" || tab === "starred"
              ? [
                  { value: 1, label: "Kho" },
                  { value: 4, label: "De" }
                ]
              : undefined
          }
          onRate={(rating, draft) => {
            const active = activeCard;
            if (!active) {
              return;
            }

            if (tab === "difficult" || tab === "starred") {
              const action = rating === 1 ? "hard" : "easy";
              handleLocalQueueReview(tab, active.id, action);
              return;
            }

            if (tab === "due") {
              void handleDueReview(active.id, rating, draft);
              return;
            }

            void handleReview(active.id, rating, draft);

            if (reviewIndex < activeList.length - 1) {
              setReviewIndex((prev) => prev + 1);
            } else {
              setReviewIndex(0);
            }
          }}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          transcript={transcript}
          comparison={comparison}
        />
      )}
    </main>
  );
};

export default TranslationView;
