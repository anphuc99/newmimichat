import type { Request, Response } from "express";
import type { DataSource, Repository } from "typeorm";
import MessageEntity from "../../models/message.entity.js";
import TranslationCardEntity from "../../models/translation-card.entity.js";
import TranslationReviewEntity from "../../models/translation-review.entity.js";
import {
  createInitialReviewState,
  updateReviewAfterRating,
  type FSRSRating,
  type ReviewHistoryEntry
} from "../../services/fsrs.service.js";

interface TranslationController {
  listCards: (request: Request, response: Response) => Promise<void>;
  getDueCards: (request: Request, response: Response) => Promise<void>;
  getStats: (request: Request, response: Response) => Promise<void>;
  getLearnCandidate: (request: Request, response: Response) => Promise<void>;
  reviewTranslation: (request: Request, response: Response) => Promise<void>;
  toggleStar: (request: Request, response: Response) => Promise<void>;
}

/**
 * Serialises a translation review entity to a client-facing JSON shape.
 */
const serialiseReview = (entity: TranslationReviewEntity) => {
  let reviewHistory: ReviewHistoryEntry[] = [];

  try {
    reviewHistory = JSON.parse(entity.reviewHistoryJson || "[]") as ReviewHistoryEntry[];
  } catch {
    reviewHistory = [];
  }

  return {
    id: entity.id,
    translationCardId: entity.translationCardId,
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
 * Serialises a translation card entity to a client-facing JSON shape.
 */
const serialiseCard = (entity: TranslationCardEntity) => {
  return {
    id: entity.id,
    messageId: entity.messageId,
    content: entity.content,
    translation: entity.translation,
    userTranslation: entity.userTranslation,
    characterName: entity.characterName,
    journalId: entity.journalId,
    userId: entity.userId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};

/**
 * Builds the translation controller.
 *
 * @param dataSource - Initialised TypeORM data source.
 * @returns Translation controller handlers.
 */
export const createTranslationController = (dataSource: DataSource): TranslationController => {
  const cardRepo: Repository<TranslationCardEntity> = dataSource.getRepository(TranslationCardEntity);
  const reviewRepo: Repository<TranslationReviewEntity> = dataSource.getRepository(TranslationReviewEntity);
  const messageRepo: Repository<MessageEntity> = dataSource.getRepository(MessageEntity);
  const toDateKey = (value: Date | string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

  /**
   * Lists all translation cards for the current user.
   */
  const listCards: TranslationController["listCards"] = async (request, response) => {
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
      const reviewMap = new Map<number, TranslationReviewEntity>(
        reviews.map((review: TranslationReviewEntity) => [review.translationCardId, review])
      );

      const items = cards.map((card: TranslationCardEntity) => {
        const review = reviewMap.get(card.id);
        return {
          ...serialiseCard(card),
          review: review ? serialiseReview(review) : null
        };
      });

      response.json({ cards: items });
    } catch (error) {
      console.error("Failed to list translation cards.", error);
      response.status(500).json({ message: "Failed to list translation cards" });
    }
  };

  /**
   * Returns translation cards that are due for review.
   */
  const getDueCards: TranslationController["getDueCards"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const reviews = await reviewRepo.find({ where: { userId } });
      const todayKey = toDateKey(new Date());
      const dueReviews = reviews.filter((review: TranslationReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey);
      const cardIds = dueReviews.map((review: TranslationReviewEntity) => review.translationCardId);

      const cards = cardIds.length
        ? await cardRepo
            .createQueryBuilder("c")
            .where("c.id IN (:...ids)", { ids: cardIds })
            .andWhere("c.user_id = :userId", { userId })
            .getMany()
        : [];

      const cardMap = new Map<number, TranslationCardEntity>(cards.map((card: TranslationCardEntity) => [card.id, card]));
      const items = dueReviews
        .map((review: TranslationReviewEntity) => {
          const card = cardMap.get(review.translationCardId);
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
      console.error("Failed to get due translation cards.", error);
      response.status(500).json({ message: "Failed to get due translation cards" });
    }
  };

  /**
   * Returns aggregated translation drill stats.
   */
  const getStats: TranslationController["getStats"] = async (request, response) => {
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
      const dueToday = allReviews.filter((review: TranslationReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey).length;
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
      console.error("Failed to get translation stats.", error);
      response.status(500).json({ message: "Failed to get translation stats" });
    }
  };

  /**
   * Returns a random message that has not been turned into a translation card.
   */
  const getLearnCandidate: TranslationController["getLearnCandidate"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const existingCards = await cardRepo.find({ where: { userId } });
      const existingMessageIds = existingCards.map((card: TranslationCardEntity) => card.messageId);
      const orderBy = dataSource.options.type === "mysql" ? "RAND()" : "RANDOM()";

      const query = messageRepo
        .createQueryBuilder("m")
        .where("m.user_id = :userId", { userId })
        .andWhere("m.translation IS NOT NULL")
        .andWhere("m.translation != ''");

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
        journalId: message.journalId,
        createdAt: message.createdAt
      });
    } catch (error) {
      console.error("Failed to fetch a translation candidate.", error);
      response.status(500).json({ message: "Failed to fetch translation candidate" });
    }
  };

  /**
   * Submits a translation review rating and schedules the next review.
   */
  const reviewTranslation: TranslationController["reviewTranslation"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { rating, messageId, cardId, userTranslation } = request.body as {
      rating?: number;
      messageId?: string;
      cardId?: number;
      userTranslation?: string;
    };

    if (!rating || rating < 1 || rating > 4) {
      response.status(400).json({ message: "Rating must be 1–4" });
      return;
    }

    try {
      let card: TranslationCardEntity | null = null;

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
          userTranslation: userTranslation?.trim() || null,
          characterName: message.characterName,
          journalId: message.journalId,
          userId
        });

        card = await cardRepo.save(card);
      } else if (userTranslation && userTranslation.trim()) {
        card.userTranslation = userTranslation.trim();
        card = await cardRepo.save(card);
      }

      const reviewEntity = await reviewRepo.findOne({
        where: { translationCardId: card.id, userId }
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
        translationCardId: card.id,
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
      console.error("Failed to review translation card.", error);
      response.status(500).json({ message: "Failed to review translation card" });
    }
  };

  /**
   * Toggles the starred state for a translation card.
   */
  const toggleStar: TranslationController["toggleStar"] = async (request, response) => {
    const userId = request.user?.id;
    const cardId = Number(request.params.id);

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!Number.isInteger(cardId)) {
      response.status(400).json({ message: "Invalid translation card ID" });
      return;
    }

    try {
      let reviewEntity = await reviewRepo.findOne({
        where: { translationCardId: cardId, userId }
      });

      if (!reviewEntity) {
        const state = createInitialReviewState();
        reviewEntity = reviewRepo.create({
          translationCardId: cardId,
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
      console.error("Failed to toggle translation star.", error);
      response.status(500).json({ message: "Failed to toggle translation star" });
    }
  };

  return {
    listCards,
    getDueCards,
    getStats,
    getLearnCandidate,
    reviewTranslation,
    toggleStar
  };
};
