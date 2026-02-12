import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../../lib/api";
import { authFetch } from "../../lib/auth";

/** Shadowing review history entry. */
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
interface ShadowingReview {
  id: number;
  shadowingCardId: number;
  stability: number;
  difficulty: number;
  lapses: number;
  currentIntervalDays: number;
  nextReviewDate: string;
  lastReviewDate: string | null;
  isStarred: boolean;
  reviewHistory: ReviewHistoryEntry[];
}

/** Shadowing card with review info. */
interface ShadowingCard {
  id: number;
  messageId: string;
  content: string;
  translation: string | null;
  userTranslation: string | null;
  characterName: string;
  audio?: string | null;
  journalId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  review: ShadowingReview | null;
}

/** Random learn candidate returned by the API. */
interface LearnCandidate {
  messageId: string;
  content: string;
  translation: string | null;
  characterName: string;
  audio?: string | null;
  journalId: number;
  createdAt: string;
}

interface Character {
  id: number;
  name: string;
  pitch?: number | null;
  speakingRate?: number | null;
}

/** Shadowing stats payload. */
interface ShadowingStats {
  totalCards: number;
  withReview: number;
  withoutReview: number;
  dueToday: number;
  starredCount: number;
  difficultCount: number;
}

type TabId = "due" | "difficult" | "starred" | "learn";

interface ShadowingToken {
  text: string;
  match: boolean;
}

interface ShadowingFlashcardProps {
  title: string;
  content: string;
  translation: string | null;
  characterName: string;
  audioId?: string | null;
  isStarred?: boolean;
  showStar?: boolean;
  onPlayAudio?: (audioId: string, characterName?: string) => void;
  onRate: (rating: number) => void;
  onToggleStar?: () => void;
  ratingOptions?: Array<{ value: number; label: string }>;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string | null;
  comparison: ShadowingToken[];
  onRevealMeaning: () => void;
  showMeaning: boolean;
}

/**
 * Renders a shadowing drill flashcard with recording controls.
 *
 * @param props - Component props.
 * @returns The flashcard UI for shadowing drills.
 */
const ShadowingFlashcard = ({
  title,
  content,
  translation,
  characterName,
  audioId,
  isStarred,
  showStar,
  onPlayAudio,
  onRate,
  onToggleStar,
  ratingOptions,
  onStartRecording,
  onStopRecording,
  isRecording,
  isTranscribing,
  transcript,
  comparison,
  onRevealMeaning,
  showMeaning
}: ShadowingFlashcardProps) => {
  const resolvedRatings =
    ratingOptions ??
    [
      { value: 1, label: "Again" },
      { value: 2, label: "Hard" },
      { value: 3, label: "Good" },
      { value: 4, label: "Easy" }
    ];

  return (
    <div className="translation-card shadowing-card">
      <div className="translation-card__header">
        <div>
          <p className="translation-card__title">{title}</p>
          <p className="translation-card__subtitle">{characterName}</p>
        </div>
        <div className="translation-card__header-actions">
          {audioId && onPlayAudio ? (
            <button
              type="button"
              className="translation-card__audio"
              onClick={() => onPlayAudio(audioId, characterName)}
              title="Play audio"
            >
              Audio
            </button>
          ) : null}
          {showStar ? (
            <button type="button" className="translation-card__star" onClick={onToggleStar}>
              {isStarred ? "Starred" : "Star"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="translation-card__prompt">{content}</div>

      <div className="shadowing-controls">
        <button type="button" className="translation-card__primary" onClick={onRevealMeaning}>
          {showMeaning ? "An nghia" : "Xem nghia"}
        </button>
        <button
          type="button"
          className={`translation-card__primary ${isRecording ? "shadowing-recording" : ""}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
        >
          {isRecording ? "Dung ghi am" : "Ghi am"}
        </button>
        {isTranscribing ? <span className="shadowing-status">Dang chuyen doi...</span> : null}
      </div>

      {showMeaning ? (
        <div className="translation-card__answer">
          <span>Dap an goi y:</span>
          <strong>{translation || "(Chua co ban dich mau)"}</strong>
        </div>
      ) : null}

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

      <div className="translation-card__actions">
        <div className="translation-card__ratings">
          {resolvedRatings.map((rating) => (
            <button
              key={rating.value}
              type="button"
              className="translation-card__rating"
              onClick={() => onRate(rating.value)}
            >
              {rating.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const tokenize = (value: string) => value.trim().split(/\s+/).filter(Boolean);

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

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

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });

/**
 * Renders the Shadowing Drill view.
 *
 * @returns The Shadowing view React component.
 */
const ShadowingView = () => {
  const [tab, setTab] = useState<TabId>("learn");
  const [allCards, setAllCards] = useState<ShadowingCard[]>([]);
  const [dueCards, setDueCards] = useState<ShadowingCard[]>([]);
  const [stats, setStats] = useState<ShadowingStats | null>(null);
  const [learnCandidate, setLearnCandidate] = useState<LearnCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLearnLoading, setIsLearnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const [practiceQueues, setPracticeQueues] = useState<{ difficult: number[]; starred: number[] }>({
    difficult: [],
    starred: []
  });
  const [dueQueueIds, setDueQueueIds] = useState<number[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ShadowingToken[]>([]);
  const [showMeaning, setShowMeaning] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTargetRef = useRef<{ content: string; translation: string | null } | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [cardsRes, dueRes, statsRes] = await Promise.all([
        authFetch(apiUrl("/api/shadowing")),
        authFetch(apiUrl("/api/shadowing/due")),
        authFetch(apiUrl("/api/shadowing/stats"))
      ]);

      if (!cardsRes.ok || !dueRes.ok || !statsRes.ok) {
        throw new Error("Failed to load shadowing data");
      }

      const cardsPayload = (await cardsRes.json()) as { cards: ShadowingCard[] };
      const duePayload = (await dueRes.json()) as { cards: ShadowingCard[]; total: number };
      const statsPayload = (await statsRes.json()) as ShadowingStats;

      setAllCards(cardsPayload.cards ?? []);
      setDueCards(duePayload.cards ?? []);
      setStats(statsPayload);
    } catch (caught) {
      console.error("Failed to load shadowing data.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchLearnCandidate = useCallback(async () => {
    setIsLearnLoading(true);
    setError(null);

    try {
      const response = await authFetch(apiUrl("/api/shadowing/learn"));

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
        console.warn("Failed to load characters for shadowing audio.", caught);
      }
    };

    void loadCharacters();

    return () => {
      isActive = false;
    };
  }, []);

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
    () => practiceQueues.difficult.map((id) => cardById.get(id)).filter(Boolean) as ShadowingCard[],
    [practiceQueues.difficult, cardById]
  );

  const starredQueue = useMemo(
    () => practiceQueues.starred.map((id) => cardById.get(id)).filter(Boolean) as ShadowingCard[],
    [practiceQueues.starred, cardById]
  );

  const dueQueue = useMemo(
    () => dueQueueIds.map((id) => cardById.get(id)).filter(Boolean) as ShadowingCard[],
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
    return [] as ShadowingCard[];
  }, [tab, dueQueue, difficultQueue, starredQueue]);

  const activeCard = activeList[reviewIndex] ?? null;
  const learnText = learnCandidate?.content ?? "";
  const learnTranslation = learnCandidate?.translation ?? null;

  useEffect(() => {
    setTranscript(null);
    setComparison([]);
    setShowMeaning(false);
  }, [tab, activeCard?.id, learnCandidate?.messageId]);

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
      console.error("Failed to play shadowing audio.", caught);
    }
  };

  const handleReview = async (cardId: number, rating: number, skipRefresh = false) => {
    try {
      const response = await authFetch(apiUrl("/api/shadowing/review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, cardId, userTranscript: transcript ?? undefined })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      if (!skipRefresh) {
        await fetchAll();
      }
    } catch (caught) {
      console.error("Failed to review shadowing card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  const handleDueReview = async (cardId: number, rating: number) => {
    await handleReview(cardId, rating, true);

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

  const handleLearnReview = async (messageId: string, rating: number) => {
    try {
      const response = await authFetch(apiUrl("/api/shadowing/review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, messageId, userTranscript: transcript ?? undefined })
      });

      if (!response.ok) {
        throw new Error("Review failed");
      }

      await fetchAll();
      await fetchLearnCandidate();
    } catch (caught) {
      console.error("Failed to review shadowing learn card.", caught);
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  };

  const handleToggleStar = async (cardId: number) => {
    try {
      const response = await authFetch(apiUrl(`/api/shadowing/${cardId}/star`), {
        method: "PUT"
      });

      if (!response.ok) {
        throw new Error("Toggle star failed");
      }

      await fetchAll();
    } catch (caught) {
      console.error("Failed to toggle shadowing star.", caught);
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

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const startRecording = async () => {
    if (isRecording) {
      return;
    }

    const targetContent = tab === "learn" ? learnText : activeCard?.content;
    const targetTranslation = tab === "learn" ? learnTranslation : activeCard?.translation ?? null;

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
          const response = await authFetch(apiUrl("/api/shadowing/transcribe"), {
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
    { id: "learn", label: "Learn", count: learnCandidate ? 1 : 0 }
  ];

  return (
    <main className="translation-shell">
      <header className="translation-header">
        <h1>Shadowing Drill</h1>
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
          <ShadowingFlashcard
            title="Learn"
            content={learnCandidate.content}
            translation={learnCandidate.translation}
            characterName={learnCandidate.characterName}
            audioId={learnCandidate.audio ?? null}
            onPlayAudio={playAudio}
            onRate={(rating) => handleLearnReview(learnCandidate.messageId, rating)}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            transcript={transcript}
            comparison={comparison}
            onRevealMeaning={() => setShowMeaning((prev) => !prev)}
            showMeaning={showMeaning}
          />
        ) : (
          <p className="translation-empty">No new messages available for learning.</p>
        )
      ) : activeList.length === 0 ? (
        <p className="translation-empty">No cards in this tab.</p>
      ) : activeCard ? (
        <ShadowingFlashcard
          title={tab === "due" ? "Due" : tab === "difficult" ? "Difficult" : "Starred"}
          content={activeCard.content}
          translation={activeCard.translation}
          characterName={activeCard.characterName}
          audioId={activeCard.audio ?? null}
          isStarred={!!activeCard.review?.isStarred}
          showStar
          onPlayAudio={playAudio}
          onToggleStar={() => handleToggleStar(activeCard.id)}
          ratingOptions={
            tab === "difficult" || tab === "starred"
              ? [
                  { value: 1, label: "Kho" },
                  { value: 4, label: "De" }
                ]
              : undefined
          }
          onRate={(rating) => {
            if (tab === "difficult" || tab === "starred") {
              const action = rating === 1 ? "hard" : "easy";
              handleLocalQueueReview(tab, activeCard.id, action);
              return;
            }

            if (tab === "due") {
              void handleDueReview(activeCard.id, rating);
              return;
            }

            void handleReview(activeCard.id, rating);

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
          onRevealMeaning={() => setShowMeaning((prev) => !prev)}
          showMeaning={showMeaning}
        />
      ) : null}
    </main>
  );
};

export default ShadowingView;
