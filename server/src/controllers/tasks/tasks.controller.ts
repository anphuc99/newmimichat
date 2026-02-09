import type { Request, Response } from "express";
import type { DataSource, Repository } from "typeorm";
import ListeningCardEntity from "../../models/listening-card.entity.js";
import ListeningReviewEntity from "../../models/listening-review.entity.js";
import ShadowingCardEntity from "../../models/shadowing-card.entity.js";
import ShadowingReviewEntity from "../../models/shadowing-review.entity.js";
import TranslationCardEntity from "../../models/translation-card.entity.js";
import TranslationReviewEntity from "../../models/translation-review.entity.js";
import VocabularyEntity from "../../models/vocabulary.entity.js";
import VocabularyReviewEntity from "../../models/vocabulary-review.entity.js";

interface TaskItem {
  id: string;
  label: string;
  type: "count" | "clear_due";
  progress: number;
  target: number;
  remaining: number;
  completed: boolean;
}

interface TasksResponse {
  date: string;
  tasks: TaskItem[];
  completedCount: number;
  totalCount: number;
}

interface TasksController {
  getTodayTasks: (request: Request, response: Response) => Promise<void>;
}

/**
 * Builds the Tasks controller.
 *
 * @param dataSource - Initialised TypeORM data source.
 * @returns Tasks controller handlers.
 */
export const createTasksController = (dataSource: DataSource): TasksController => {
  const vocabularyRepo: Repository<VocabularyEntity> = dataSource.getRepository(VocabularyEntity);
  const vocabularyReviewRepo: Repository<VocabularyReviewEntity> = dataSource.getRepository(VocabularyReviewEntity);
  const translationRepo: Repository<TranslationCardEntity> = dataSource.getRepository(TranslationCardEntity);
  const translationReviewRepo: Repository<TranslationReviewEntity> = dataSource.getRepository(TranslationReviewEntity);
  const listeningRepo: Repository<ListeningCardEntity> = dataSource.getRepository(ListeningCardEntity);
  const listeningReviewRepo: Repository<ListeningReviewEntity> = dataSource.getRepository(ListeningReviewEntity);
  const shadowingRepo: Repository<ShadowingCardEntity> = dataSource.getRepository(ShadowingCardEntity);
  const shadowingReviewRepo: Repository<ShadowingReviewEntity> = dataSource.getRepository(ShadowingReviewEntity);

  const toDateKey = (value: Date | string) =>
    new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

  /**
   * Counts entries created on the provided date key.
   */
  const countCreatedOn = (items: Array<{ createdAt: Date }>, dateKey: string) =>
    items.filter((item) => toDateKey(item.createdAt) === dateKey).length;

  /**
   * Counts reviews that are due on or before the provided date key.
   */
  const countDueOnOrBefore = (items: Array<{ nextReviewDate: Date }>, dateKey: string) =>
    items.filter((item) => toDateKey(item.nextReviewDate) <= dateKey).length;

  /**
   * Returns daily task progress for the authenticated user.
   */
  const getTodayTasks: TasksController["getTodayTasks"] = async (request, response) => {
    const userId = request.user?.id;

    if (!userId) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const todayKey = toDateKey(new Date());

    try {
      const [
        vocabularies,
        vocabularyReviews,
        translationCards,
        translationReviews,
        listeningCards,
        listeningReviews,
        shadowingCards,
        shadowingReviews
      ] = await Promise.all([
        vocabularyRepo.find({ where: { userId } }),
        vocabularyReviewRepo.find({ where: { userId } }),
        translationRepo.find({ where: { userId } }),
        translationReviewRepo.find({ where: { userId } }),
        listeningRepo.find({ where: { userId } }),
        listeningReviewRepo.find({ where: { userId } }),
        shadowingRepo.find({ where: { userId } }),
        shadowingReviewRepo.find({ where: { userId } })
      ]);

      const vocabLearned = countCreatedOn(vocabularies, todayKey);
      const vocabDueRemaining = countDueOnOrBefore(vocabularyReviews, todayKey);
      const translationLearned = countCreatedOn(translationCards, todayKey);
      const translationDueRemaining = countDueOnOrBefore(translationReviews, todayKey);
      const listeningLearned = countCreatedOn(listeningCards, todayKey);
      const listeningDueRemaining = countDueOnOrBefore(listeningReviews, todayKey);
      const shadowingLearned = countCreatedOn(shadowingCards, todayKey);
      const shadowingDueRemaining = countDueOnOrBefore(shadowingReviews, todayKey);

      const tasks: TaskItem[] = [
        {
          id: "vocab_new",
          label: "Hoc 20 tu moi",
          type: "count",
          progress: vocabLearned,
          target: 20,
          remaining: Math.max(20 - vocabLearned, 0),
          completed: vocabLearned >= 20
        },
        {
          id: "vocab_due",
          label: "On tap het tu den han",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: vocabDueRemaining,
          completed: vocabDueRemaining === 0
        },
        {
          id: "translation_new",
          label: "Luyen dich 5 cau moi",
          type: "count",
          progress: translationLearned,
          target: 5,
          remaining: Math.max(5 - translationLearned, 0),
          completed: translationLearned >= 5
        },
        {
          id: "translation_due",
          label: "On tap het cau dich den han",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: translationDueRemaining,
          completed: translationDueRemaining === 0
        },
        {
          id: "listening_new",
          label: "Luyen nghe 5 cau moi",
          type: "count",
          progress: listeningLearned,
          target: 5,
          remaining: Math.max(5 - listeningLearned, 0),
          completed: listeningLearned >= 5
        },
        {
          id: "listening_due",
          label: "On tap het cau nghe den han",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: listeningDueRemaining,
          completed: listeningDueRemaining === 0
        },
        {
          id: "shadowing_new",
          label: "Luyen shadowing 5 cau moi",
          type: "count",
          progress: shadowingLearned,
          target: 5,
          remaining: Math.max(5 - shadowingLearned, 0),
          completed: shadowingLearned >= 5
        },
        {
          id: "shadowing_due",
          label: "On tap het shadowing den han",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: shadowingDueRemaining,
          completed: shadowingDueRemaining === 0
        }
      ];

      const completedCount = tasks.filter((task) => task.completed).length;
      const payload: TasksResponse = {
        date: todayKey,
        tasks,
        completedCount,
        totalCount: tasks.length
      };

      response.json(payload);
    } catch (error) {
      console.error("Failed to load tasks.", error);
      response.status(500).json({ message: "Failed to load tasks" });
    }
  };

  return {
    getTodayTasks
  };
};
