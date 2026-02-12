import type { Request, Response } from "express";
import type { DataSource, Repository } from "typeorm";
import { toFile, type Uploadable } from "openai/uploads";
import MessageEntity from "../../models/message.entity.js";
import ShadowingCardEntity from "../../models/shadowing-card.entity.js";
import ShadowingReviewEntity from "../../models/shadowing-review.entity.js";
import { createOpenAIClient } from "../../services/openai.service.js";
import {
  createInitialReviewState,
  updateReviewAfterRating,
  type FSRSRating,
  type ReviewHistoryEntry
} from "../../services/fsrs.service.js";

interface ShadowingController {
  listCards: (request: Request, response: Response) => Promise<void>;
  getDueCards: (request: Request, response: Response) => Promise<void>;
  getStats: (request: Request, response: Response) => Promise<void>;
  getLearnCandidate: (request: Request, response: Response) => Promise<void>;
  reviewShadowing: (request: Request, response: Response) => Promise<void>;
  toggleStar: (request: Request, response: Response) => Promise<void>;
  transcribeAudio: (request: Request, response: Response) => Promise<void>;
}

interface ShadowingControllerDeps {
  transcribeWithOpenAI?: (file: Uploadable) => Promise<string>;
}

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * Serialises a shadowing review entity to a client-facing JSON shape.
 */
const serialiseReview = (entity: ShadowingReviewEntity) => {
  let reviewHistory: ReviewHistoryEntry[] = [];

  try {
    reviewHistory = JSON.parse(entity.reviewHistoryJson || "[]") as ReviewHistoryEntry[];
  } catch {
    reviewHistory = [];
  }

  return {
    id: entity.id,
    shadowingCardId: entity.shadowingCardId,
    stability: entity.stability,
    difficulty: entity.difficulty,
    lapses: entity.lapses,
    currentIntervalDays: entity.currentIntervalDays,
    nextReviewDate: entity.nextReviewDate,
    lastReviewDate: entity.lastReviewDate,
    isStarred: entity.isStarred,
    reviewHistory
  };
};

/**
 * Serialises a shadowing card entity to a client-facing JSON shape.
 */
const serialiseCard = (entity: ShadowingCardEntity) => {
  return {
    id: entity.id,
    messageId: entity.messageId,
    content: entity.content,
    translation: entity.translation,
    userTranslation: entity.userTranslation,
    characterName: entity.characterName,
    audio: entity.audio,
    journalId: entity.journalId,
    userId: entity.userId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};

const parseAudioDataUrl = (dataUrl: string) => {
  const match = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/i.exec(dataUrl.trim());

  if (!match) {
    return null;
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");

  return { mime, buffer };
};

const resolveAudioExtension = (mime: string) => {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
};

/**
 * Builds the shadowing controller.
 *
 * @param dataSource - Initialised TypeORM data source.
 * @param deps - Optional overrides for external services.
 * @returns Shadowing controller handlers.
 */
export const createShadowingController = (
  dataSource: DataSource,
  deps: ShadowingControllerDeps = {}
): ShadowingController => {
  const cardRepo: Repository<ShadowingCardEntity> = dataSource.getRepository(ShadowingCardEntity);
  const reviewRepo: Repository<ShadowingReviewEntity> = dataSource.getRepository(ShadowingReviewEntity);
  const messageRepo: Repository<MessageEntity> = dataSource.getRepository(MessageEntity);
  const toDateKey = (value: Date | string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const openAIClient = apiKey ? createOpenAIClient(apiKey) : null;
  const transcribeWithOpenAI =
    deps.transcribeWithOpenAI ??
    (async (file) => {
      if (!openAIClient) {
        throw new Error("OpenAI API key is not configured");
      }

      const response = await openAIClient.audio.transcriptions.create({
        file,
        model: "gpt-4o-transcribe",
        language: "ko"
      });

      const transcript = response.text?.trim() ?? "";

      if (!transcript) {
        throw new Error("OpenAI returned an empty transcript");
      }

      return transcript;
    });

  /**
   * Lists all shadowing cards for the current user.
   */
  const listCards: ShadowingController["listCards"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const cards = await cardRepo.find({
        where: { userId },
        order: { createdAt: "DESC" }
      });
      const reviews = await reviewRepo.find({ where: { userId } });
      const reviewMap = new Map<number, ShadowingReviewEntity>(
        reviews.map((review: ShadowingReviewEntity) => [review.shadowingCardId, review])
      );

      const items = cards.map((card: ShadowingCardEntity) => {
        const review = reviewMap.get(card.id);
        return {
          ...serialiseCard(card),
          review: review ? serialiseReview(review) : null
        };
      });

      response.json({ cards: items });
    } catch (error) {
      console.error("Failed to list shadowing cards.", error);
      response.status(500).json({ message: "Failed to list shadowing cards" });
    }
  };

  /**
   * Returns shadowing cards that are due for review.
   */
  const getDueCards: ShadowingController["getDueCards"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const reviews = await reviewRepo.find({ where: { userId } });
      const todayKey = toDateKey(new Date());
      const dueReviews = reviews.filter((review: ShadowingReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey);
      const cardIds = dueReviews.map((review: ShadowingReviewEntity) => review.shadowingCardId);

      const cards = cardIds.length
        ? await cardRepo
            .createQueryBuilder("c")
            .where("c.id IN (:...ids)", { ids: cardIds })
            .andWhere("c.user_id = :userId", { userId })
            .getMany()
        : [];

      const cardMap = new Map<number, ShadowingCardEntity>(cards.map((card: ShadowingCardEntity) => [card.id, card]));
      const items = dueReviews
        .map((review: ShadowingReviewEntity) => {
          const card = cardMap.get(review.shadowingCardId);
          if (!card) {
            return null;
          }

          return {
            ...serialiseCard(card),
            review: serialiseReview(review)
          };
        })
        .filter(Boolean);

      response.json({ cards: items, total: items.length });
    } catch (error) {
      console.error("Failed to get due shadowing cards.", error);
      response.status(500).json({ message: "Failed to get due shadowing cards" });
    }
  };

  /**
   * Returns aggregated shadowing drill stats.
   */
  const getStats: ShadowingController["getStats"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const totalCards = await cardRepo.count({ where: { userId } });
      const totalReviews = await reviewRepo.count({ where: { userId } });
      const starredCount = await reviewRepo.count({ where: { userId, isStarred: true } });
      const allReviews = await reviewRepo.find({ where: { userId } });
      const now = new Date();
      const todayKey = toDateKey(now);
      const dueToday = allReviews.filter((review: ShadowingReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey).length;
      const withoutReview = totalCards - totalReviews;

      const todayStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
      let difficultCount = 0;

      for (const review of allReviews) {
        let history: ReviewHistoryEntry[] = [];

        try {
          history = JSON.parse(review.reviewHistoryJson || "[]") as ReviewHistoryEntry[];
        } catch {
          continue;
        }

        const hasTodayDifficult = history.some((entry) => {
          const reviewDate = new Date(entry.date).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
          return reviewDate === todayStr && (entry.rating === 1 || entry.rating === 2);
        });

        if (hasTodayDifficult) {
          difficultCount++;
        }
      }

      response.json({
        totalCards,
        withReview: totalReviews,
        withoutReview,
        dueToday,
        starredCount,
        difficultCount
      });
    } catch (error) {
      console.error("Failed to get shadowing stats.", error);
      response.status(500).json({ message: "Failed to get shadowing stats" });
    }
  };

  /**
   * Returns a random message that has not been turned into a shadowing card.
   */
  const getLearnCandidate: ShadowingController["getLearnCandidate"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const existingCards = await cardRepo.find({ where: { userId } });
      const existingMessageIds = existingCards.map((card: ShadowingCardEntity) => card.messageId);
      const orderBy = dataSource.options.type === "mysql" ? "RAND()" : "RANDOM()";

      // Get the last 1000 message IDs for this user to limit the candidate pool
      const recentMessages = await messageRepo.find({
        where: { userId },
        order: { createdAt: "DESC" },
        take: 1000,
        select: ["id"]
      });

      const recentIds = recentMessages.map(m => m.id);

      if (recentIds.length === 0) {
        response.status(404).json({ message: "No new messages available" });
        return;
      }

      const query = messageRepo
        .createQueryBuilder("m")
        .where("m.id IN (:...recentIds)", { recentIds })
        .andWhere("m.translation IS NOT NULL")
        .andWhere("m.translation != ''")
        .andWhere("m.audio IS NOT NULL")
        .andWhere("m.audio != ''");

      if (existingMessageIds.length > 0) {
        query.andWhere("m.id NOT IN (:...ids)", { ids: existingMessageIds });
      }

      const message = await query.orderBy(orderBy).limit(1).getOne();

      if (!message) {
        response.status(404).json({ message: "No new messages available" });
        return;
      }

      response.json({
        messageId: message.id,
        content: message.content,
        translation: message.translation,
        characterName: message.characterName,
        audio: message.audio ?? null,
        journalId: message.journalId,
        createdAt: message.createdAt
      });
    } catch (error) {
      console.error("Failed to fetch a shadowing candidate.", error);
      response.status(500).json({ message: "Failed to fetch shadowing candidate" });
    }
  };

  /**
   * Submits a shadowing review rating and schedules the next review.
   */
  const reviewShadowing: ShadowingController["reviewShadowing"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { rating, messageId, cardId, userTranscript } = request.body as {
      rating?: number;
      messageId?: string;
      cardId?: number;
      userTranscript?: string;
    };

    if (!rating || rating < 1 || rating > 4) {
      response.status(400).json({ message: "Rating must be 1–4" });
      return;
    }

    try {
      let card: ShadowingCardEntity | null = null;

      if (cardId) {
        card = await cardRepo.findOne({ where: { id: cardId, userId } });
      } else if (messageId) {
        card = await cardRepo.findOne({ where: { messageId, userId } });
      }

      if (!card) {
        if (!messageId) {
          response.status(400).json({ message: "messageId is required for new cards" });
          return;
        }

        const message = await messageRepo.findOne({ where: { id: messageId, userId } });

        if (!message) {
          response.status(404).json({ message: "Message not found" });
          return;
        }

        card = cardRepo.create({
          messageId: message.id,
          content: message.content,
          translation: message.translation ?? null,
          userTranslation: userTranscript?.trim() || null,
          characterName: message.characterName,
          audio: message.audio ?? null,
          journalId: message.journalId,
          userId
        });

        card = await cardRepo.save(card);
      } else if (userTranscript && userTranscript.trim()) {
        card.userTranslation = userTranscript.trim();
        card = await cardRepo.save(card);
      }

      const reviewEntity = await reviewRepo.findOne({
        where: { shadowingCardId: card.id, userId }
      });

      const currentState = reviewEntity
        ? {
            stability: reviewEntity.stability,
            difficulty: reviewEntity.difficulty,
            lapses: reviewEntity.lapses,
            currentIntervalDays: reviewEntity.currentIntervalDays,
            nextReviewDate: reviewEntity.nextReviewDate instanceof Date
              ? reviewEntity.nextReviewDate.toISOString()
              : String(reviewEntity.nextReviewDate),
            lastReviewDate: reviewEntity.lastReviewDate
              ? reviewEntity.lastReviewDate instanceof Date
                ? reviewEntity.lastReviewDate.toISOString()
                : String(reviewEntity.lastReviewDate)
              : null,
            reviewHistory: (() => {
              try {
                return JSON.parse(reviewEntity.reviewHistoryJson || "[]") as ReviewHistoryEntry[];
              } catch {
                return [];
              }
            })()
          }
        : createInitialReviewState();

      const updated = updateReviewAfterRating(currentState, rating as FSRSRating);
      const nextReview = {
        shadowingCardId: card.id,
        userId,
        stability: updated.stability,
        difficulty: updated.difficulty,
        lapses: updated.lapses,
        currentIntervalDays: updated.currentIntervalDays,
        nextReviewDate: new Date(updated.nextReviewDate),
        lastReviewDate: updated.lastReviewDate ? new Date(updated.lastReviewDate) : null,
        reviewHistoryJson: JSON.stringify(updated.reviewHistory),
        isStarred: reviewEntity?.isStarred ?? false
      };

      const saved = await reviewRepo.save(reviewEntity ? { ...reviewEntity, ...nextReview } : reviewRepo.create(nextReview));

      response.json({
        card: serialiseCard(card),
        review: serialiseReview(saved)
      });
    } catch (error) {
      console.error("Failed to review shadowing card.", error);
      response.status(500).json({ message: "Failed to review shadowing card" });
    }
  };

  /**
   * Toggles the starred state for a shadowing card.
   */
  const toggleStar: ShadowingController["toggleStar"] = async (request, response) => {
    const userId = request.user?.id;
    const cardId = Number(request.params.id);

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!Number.isInteger(cardId)) {
      response.status(400).json({ message: "Invalid shadowing card ID" });
      return;
    }

    try {
      let reviewEntity = await reviewRepo.findOne({
        where: { shadowingCardId: cardId, userId }
      });

      if (!reviewEntity) {
        const state = createInitialReviewState();
        reviewEntity = reviewRepo.create({
          shadowingCardId: cardId,
          userId,
          stability: state.stability,
          difficulty: state.difficulty,
          lapses: state.lapses,
          currentIntervalDays: state.currentIntervalDays,
          nextReviewDate: new Date(state.nextReviewDate),
          lastReviewDate: null,
          reviewHistoryJson: JSON.stringify(state.reviewHistory),
          isStarred: true
        });
      } else {
        reviewEntity.isStarred = !reviewEntity.isStarred;
      }

      const saved = await reviewRepo.save(reviewEntity);
      response.json(serialiseReview(saved));
    } catch (error) {
      console.error("Failed to toggle shadowing star.", error);
      response.status(500).json({ message: "Failed to toggle shadowing star" });
    }
  };

  /**
   * Transcribes user audio using OpenAI.
   */
  const transcribeAudio: ShadowingController["transcribeAudio"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { audio } = request.body as { audio?: string };

    if (!audio || typeof audio !== "string") {
      response.status(400).json({ message: "audio is required" });
      return;
    }

    const parsed = parseAudioDataUrl(audio);

    if (!parsed) {
      response.status(400).json({ message: "Invalid audio data URL" });
      return;
    }

    if (parsed.buffer.byteLength > MAX_AUDIO_BYTES) {
      response.status(413).json({ message: "Audio payload is too large" });
      return;
    }

    try {
      const extension = resolveAudioExtension(parsed.mime);
      const file = await toFile(parsed.buffer, `shadowing.${extension}`, { type: parsed.mime });
      const transcript = await transcribeWithOpenAI(file);
      response.json({ transcript });
    } catch (error) {
      console.error("Failed to transcribe audio.", error);
      response.status(500).json({ message: "Failed to transcribe audio" });
    }
  };

  return {
    listCards,
    getDueCards,
    getStats,
    getLearnCandidate,
    reviewShadowing,
    toggleStar,
    transcribeAudio
  };
};
