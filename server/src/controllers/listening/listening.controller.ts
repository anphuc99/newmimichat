import type { Request, Response } from "express";
import type { DataSource, Repository } from "typeorm";
import MessageEntity from "../../models/message.entity.js";
import ListeningCardEntity from "../../models/listening-card.entity.js";
import ListeningReviewEntity from "../../models/listening-review.entity.js";
import {
  createInitialReviewState,
  updateReviewAfterRating,
  type FSRSRating,
  type ReviewHistoryEntry
} from "../../services/fsrs.service.js";

interface ListeningController {
  listCards: (request: Request, response: Response) => Promise<void>;
  getDueCards: (request: Request, response: Response) => Promise<void>;
  getStats: (request: Request, response: Response) => Promise<void>;
  getLearnCandidate: (request: Request, response: Response) => Promise<void>;
  reviewListening: (request: Request, response: Response) => Promise<void>;
  toggleStar: (request: Request, response: Response) => Promise<void>;
}

/**
 * Serialises a listening review entity to a client-facing JSON shape.
 */
const serialiseReview = (entity: ListeningReviewEntity) => {
  let reviewHistory: ReviewHistoryEntry[] = [];

  try {
    reviewHistory = JSON.parse(entity.reviewHistoryJson || "[]") as ReviewHistoryEntry[];
  } catch {
    reviewHistory = [];
  }

  return {
    id: entity.id,
    listeningCardId: entity.listeningCardId,
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
 * Serialises a listening card entity to a client-facing JSON shape.
 */
const serialiseCard = (entity: ListeningCardEntity) => {
  return {
    id: entity.id,
    messageId: entity.messageId,
    content: entity.content,
    translation: entity.translation,
    userTranslation: entity.userTranslation,
    characterName: entity.characterName,
    audio: entity.audio,
    explanationMd: entity.explanationMd,
    journalId: entity.journalId,
    userId: entity.userId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
};

/**
 * Builds the listening controller.
 *
 * @param dataSource - Initialised TypeORM data source.
 * @returns Listening controller handlers.
 */
export const createListeningController = (dataSource: DataSource): ListeningController => {
  const cardRepo: Repository<ListeningCardEntity> = dataSource.getRepository(ListeningCardEntity);
  const reviewRepo: Repository<ListeningReviewEntity> = dataSource.getRepository(ListeningReviewEntity);
  const messageRepo: Repository<MessageEntity> = dataSource.getRepository(MessageEntity);
  const toDateKey = (value: Date | string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

  /**
   * Lists all listening cards for the current user.
   */
  const listCards: ListeningController["listCards"] = async (request, response) => {
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
      const reviewMap = new Map<number, ListeningReviewEntity>(
        reviews.map((review: ListeningReviewEntity) => [review.listeningCardId, review])
      );

      const items = cards.map((card: ListeningCardEntity) => {
        const review = reviewMap.get(card.id);
        return {
          ...serialiseCard(card),
          review: review ? serialiseReview(review) : null
        };
      });

      response.json({ cards: items });
    } catch (error) {
      console.error("Failed to list listening cards.", error);
      response.status(500).json({ message: "Failed to list listening cards" });
    }
  };

  /**
   * Returns listening cards that are due for review.
   */
  const getDueCards: ListeningController["getDueCards"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const reviews = await reviewRepo.find({ where: { userId } });
      const todayKey = toDateKey(new Date());
      const dueReviews = reviews.filter((review: ListeningReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey);
      const cardIds = dueReviews.map((review: ListeningReviewEntity) => review.listeningCardId);

      const cards = cardIds.length
        ? await cardRepo
            .createQueryBuilder("c")
            .where("c.id IN (:...ids)", { ids: cardIds })
            .andWhere("c.user_id = :userId", { userId })
            .getMany()
        : [];

      const cardMap = new Map<number, ListeningCardEntity>(cards.map((card: ListeningCardEntity) => [card.id, card]));
      const items = dueReviews
        .map((review: ListeningReviewEntity) => {
          const card = cardMap.get(review.listeningCardId);
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
      console.error("Failed to get due listening cards.", error);
      response.status(500).json({ message: "Failed to get due listening cards" });
    }
  };

  /**
   * Returns aggregated listening drill stats.
   */
  const getStats: ListeningController["getStats"] = async (request, response) => {
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
      const dueToday = allReviews.filter((review: ListeningReviewEntity) => toDateKey(review.nextReviewDate) <= todayKey).length;
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
      console.error("Failed to get listening stats.", error);
      response.status(500).json({ message: "Failed to get listening stats" });
    }
  };

  /**
   * Returns a random message that has not been turned into a listening card.
   */
  const getLearnCandidate: ListeningController["getLearnCandidate"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const existingCards = await cardRepo.find({ where: { userId } });
      const existingMessageIds = existingCards.map((card: ListeningCardEntity) => card.messageId);
      const orderBy = dataSource.options.type === "mysql" ? "RAND()" : "RANDOM()";

      const query = messageRepo
        .createQueryBuilder("m")
        .where("m.user_id = :userId", { userId })
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
      console.error("Failed to fetch a listening candidate.", error);
      response.status(500).json({ message: "Failed to fetch listening candidate" });
    }
  };

  /**
   * Submits a listening review rating and schedules the next review.
   */
  const reviewListening: ListeningController["reviewListening"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const { rating, messageId, cardId } = request.body as {
      rating?: number;
      messageId?: string;
      cardId?: number;
    };

    if (!rating || rating < 1 || rating > 4) {
      response.status(400).json({ message: "Rating must be 1–4" });
      return;
    }

    try {
      let card: ListeningCardEntity | null = null;

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
          userTranslation: null,
          characterName: message.characterName,
          audio: message.audio ?? null,
          journalId: message.journalId,
          userId
        });

        card = await cardRepo.save(card);
      }

      const reviewEntity = await reviewRepo.findOne({
        where: { listeningCardId: card.id, userId }
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
        listeningCardId: card.id,
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
      console.error("Failed to review listening card.", error);
      response.status(500).json({ message: "Failed to review listening card" });
    }
  };

  /**
   * Toggles the starred state for a listening card.
   */
  const toggleStar: ListeningController["toggleStar"] = async (request, response) => {
    const userId = request.user?.id;
    const cardId = Number(request.params.id);

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!Number.isInteger(cardId)) {
      response.status(400).json({ message: "Invalid listening card ID" });
      return;
    }

    try {
      let reviewEntity = await reviewRepo.findOne({
        where: { listeningCardId: cardId, userId }
      });

      if (!reviewEntity) {
        const state = createInitialReviewState();
        reviewEntity = reviewRepo.create({
          listeningCardId: cardId,
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
      console.error("Failed to toggle listening star.", error);
      response.status(500).json({ message: "Failed to toggle listening star" });
    }
  };

  return {
    listCards,
    getDueCards,
    getStats,
    getLearnCandidate,
    reviewListening,
    toggleStar
  };
};
