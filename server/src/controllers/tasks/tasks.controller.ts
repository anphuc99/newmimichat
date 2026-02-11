import type { Request, Response } from "express";
import type { DataSource, Repository } from "typeorm";
import ListeningCardEntity from "../../models/listening-card.entity.js";
import ListeningReviewEntity from "../../models/listening-review.entity.js";
import ShadowingCardEntity from "../../models/shadowing-card.entity.js";
import ShadowingReviewEntity from "../../models/shadowing-review.entity.js";
import StreakEntity from "../../models/streak.entity.js";
import TranslationCardEntity from "../../models/translation-card.entity.js";
import TranslationReviewEntity from "../../models/translation-review.entity.js";

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
  const translationRepo: Repository<TranslationCardEntity> = dataSource.getRepository(TranslationCardEntity);
  const translationReviewRepo: Repository<TranslationReviewEntity> = dataSource.getRepository(TranslationReviewEntity);
  const listeningRepo: Repository<ListeningCardEntity> = dataSource.getRepository(ListeningCardEntity);
  const listeningReviewRepo: Repository<ListeningReviewEntity> = dataSource.getRepository(ListeningReviewEntity);
  const shadowingRepo: Repository<ShadowingCardEntity> = dataSource.getRepository(ShadowingCardEntity);
  const shadowingReviewRepo: Repository<ShadowingReviewEntity> = dataSource.getRepository(ShadowingReviewEntity);
  const streakRepo: Repository<StreakEntity> = dataSource.getRepository(StreakEntity);

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
   * Updates the user's streak when all tasks are completed for the day.
   *
   * @param userId - Current user ID.
   * @param completedAll - Whether all daily tasks are complete.
   */
  const updateStreakOnCompletion = async (userId: number, completedAll: boolean) => {
    if (!completedAll) {
      return;
    }

    const today = new Date();
    const todayKey = toDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toDateKey(yesterday);

    let streak = await streakRepo.findOne({ where: { userId } });

    if (!streak) {
      streak = streakRepo.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null
      });
    }

    if (streak.lastCompletedDate) {
      const lastKey = toDateKey(streak.lastCompletedDate);
      if (lastKey === todayKey) {
        return;
      }

      streak.currentStreak = lastKey === yesterdayKey ? streak.currentStreak + 1 : 1;
    } else {
      streak.currentStreak = 1;
    }

    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastCompletedDate = today;
    await streakRepo.save(streak);
  };

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
        translationCards,
        translationReviews,
        listeningCards,
        listeningReviews,
        shadowingCards,
        shadowingReviews
      ] = await Promise.all([
        translationRepo.find({ where: { userId } }),
        translationReviewRepo.find({ where: { userId } }),
        listeningRepo.find({ where: { userId } }),
        listeningReviewRepo.find({ where: { userId } }),
        shadowingRepo.find({ where: { userId } }),
        shadowingReviewRepo.find({ where: { userId } })
      ]);

      const translationLearned = countCreatedOn(translationCards, todayKey);
      const translationDueRemaining = countDueOnOrBefore(translationReviews, todayKey);
      const listeningLearned = countCreatedOn(listeningCards, todayKey);
      const listeningDueRemaining = countDueOnOrBefore(listeningReviews, todayKey);
      const shadowingLearned = countCreatedOn(shadowingCards, todayKey);
      const shadowingDueRemaining = countDueOnOrBefore(shadowingReviews, todayKey);

      const tasks: TaskItem[] = [
        {
          id: "translation_new",
          label: "Luyện dịch 5 câu mới",
          type: "count",
          progress: translationLearned,
          target: 5,
          remaining: Math.max(5 - translationLearned, 0),
          completed: translationLearned >= 5
        },
        {
          id: "translation_due",
          label: "Ôn tập hết câu dịch đến hạn",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: translationDueRemaining,
          completed: translationDueRemaining === 0
        },
        {
          id: "listening_new",
          label: "Luyện nghe 5 câu mới",
          type: "count",
          progress: listeningLearned,
          target: 5,
          remaining: Math.max(5 - listeningLearned, 0),
          completed: listeningLearned >= 5
        },
        {
          id: "listening_due",
          label: "Ôn tập hết câu nghe đến hạn",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: listeningDueRemaining,
          completed: listeningDueRemaining === 0
        },
        {
          id: "shadowing_new",
          label: "Luyện shadowing 5 câu mới",
          type: "count",
          progress: shadowingLearned,
          target: 5,
          remaining: Math.max(5 - shadowingLearned, 0),
          completed: shadowingLearned >= 5
        },
        {
          id: "shadowing_due",
          label: "Ôn tập hết shadowing đến hạn",
          type: "clear_due",
          progress: 0,
          target: 0,
          remaining: shadowingDueRemaining,
          completed: shadowingDueRemaining === 0
        }
      ];

      const completedCount = tasks.filter((task) => task.completed).length;
      await updateStreakOnCompletion(userId, completedCount === tasks.length);
      const payload: TasksResponse = {
        date: todayKey,
        tasks,
        completedCount,
        totalCount: tasks.length
      };

      response.json(payload);
    } catch (error) {
      console.error("Failed to load tasks.", error);
      response.status(500).json({ message: "Không thể tải nhiệm vụ" });
    }
  };

  return {
    getTodayTasks
  };
};
