import { describe, expect, it, vi } from "vitest";
import { createTasksController } from "../../../../server/src/controllers/tasks/tasks.controller";

/**
 * Creates a minimal Express-like response object for unit tests.
 *
 * @returns A mock response with json/status spies.
 */
const createMockResponse = () => {
  const response: any = {};
  response.json = vi.fn();
  response.status = vi.fn(() => response);
  response.send = vi.fn();
  return response;
};

/**
 * Creates a mock repository that mimics TypeORM's Repository API.
 *
 * @param items - Items to return from find().
 * @returns A mock repository with common method spies.
 */
const createRepository = (items: any[] = []) => ({
  find: vi.fn().mockResolvedValue(items)
});

/**
 * Creates a mock streak repository.
 *
 * @param streak - Streak record to return from findOne.
 * @returns A mock streak repository.
 */
const createStreakRepository = (streak: any = null) => ({
  findOne: vi.fn().mockResolvedValue(streak),
  create: vi.fn((payload: any) => payload),
  save: vi.fn(async (payload: any) => payload)
});

/**
 * Constructs the tasks controller using mock repositories.
 *
 * @param repositories - Mock repositories to return in order.
 * @returns The controller.
 */
const createController = (repositories: any[]) => {
  let repoIndex = 0;
  const dataSource = {
    getRepository: vi.fn(() => repositories[repoIndex++])
  } as any;

  return createTasksController(dataSource);
};

/**
 * Creates a mock request with authenticated user.
 *
 * @param overrides - Additional request properties (body, params, etc.).
 * @returns A mock Express Request.
 */
const authRequest = (overrides: Record<string, unknown> = {}): any => ({
  user: { id: 1, username: "mimi" },
  params: {},
  body: {},
  ...overrides
});

/**
 * Task item shape returned by the tasks controller.
 */
interface TaskItem {
  id: string;
  progress: number;
  target: number;
  remaining: number;
  completed: boolean;
}

/**
 * Finds a task by identifier within a task list.
 *
 * @param tasks - Task list returned from the controller.
 * @param id - Task identifier to locate.
 * @returns The matching task if present.
 */
const findTask = (tasks: TaskItem[], id: string) => tasks.find((task) => task.id === id);

describe("Tasks controller", () => {
  it("returns 401 when unauthenticated", async () => {
    const controller = createController([
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createRepository(),
      createStreakRepository()
    ]);
    const response = createMockResponse();

    await controller.getTodayTasks({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("returns daily task progress", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const streakRepo = createStreakRepository();
    const controller = createController([
      createRepository([
        { id: "v1", createdAt: now },
        { id: "v2", createdAt: now },
        { id: "v3", createdAt: yesterday }
      ]),
      createRepository([
        { id: 1, nextReviewDate: now },
        { id: 2, nextReviewDate: tomorrow }
      ]),
      createRepository([
        { id: 1, createdAt: now },
        { id: 2, createdAt: now },
        { id: 3, createdAt: now }
      ]),
      createRepository([
        { id: 1, nextReviewDate: tomorrow }
      ]),
      createRepository([
        { id: 1, createdAt: now },
        { id: 2, createdAt: now },
        { id: 3, createdAt: now },
        { id: 4, createdAt: now },
        { id: 5, createdAt: now }
      ]),
      createRepository([
        { id: 1, nextReviewDate: now },
        { id: 2, nextReviewDate: now }
      ]),
      createRepository([
        { id: 1, createdAt: now },
        { id: 2, createdAt: now },
        { id: 3, createdAt: now },
        { id: 4, createdAt: now },
        { id: 5, createdAt: now },
        { id: 6, createdAt: now }
      ]),
      createRepository([]),
      streakRepo
    ]);

    const response = createMockResponse();

    await controller.getTodayTasks(authRequest(), response);

    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0][0];
    expect(payload.tasks).toHaveLength(8);

    const vocabNew = findTask(payload.tasks, "vocab_new");
    expect(vocabNew?.progress).toBe(2);

    const vocabDue = findTask(payload.tasks, "vocab_due");
    expect(vocabDue?.remaining).toBe(1);

    const translationNew = findTask(payload.tasks, "translation_new");
    expect(translationNew?.progress).toBe(3);

    const translationDue = findTask(payload.tasks, "translation_due");
    expect(translationDue?.remaining).toBe(0);

    const listeningNew = findTask(payload.tasks, "listening_new");
    expect(listeningNew?.progress).toBe(5);
    expect(listeningNew?.completed).toBe(true);

    const listeningDue = findTask(payload.tasks, "listening_due");
    expect(listeningDue?.remaining).toBe(2);

    const shadowingNew = findTask(payload.tasks, "shadowing_new");
    expect(shadowingNew?.progress).toBe(6);

    const shadowingDue = findTask(payload.tasks, "shadowing_due");
    expect(shadowingDue?.remaining).toBe(0);
    expect(streakRepo.save).not.toHaveBeenCalled();
  });

  it("increments streak when all tasks are complete", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const streakRepo = createStreakRepository({
      id: 1,
      userId: 1,
      currentStreak: 2,
      longestStreak: 2,
      lastCompletedDate: yesterday
    });

    const controller = createController([
      createRepository(Array.from({ length: 20 }, (_, index) => ({ id: `v${index}`, createdAt: now }))),
      createRepository([]),
      createRepository(Array.from({ length: 5 }, (_, index) => ({ id: index, createdAt: now }))),
      createRepository([]),
      createRepository(Array.from({ length: 5 }, (_, index) => ({ id: index, createdAt: now }))),
      createRepository([]),
      createRepository(Array.from({ length: 5 }, (_, index) => ({ id: index, createdAt: now }))),
      createRepository([]),
      streakRepo
    ]);

    const response = createMockResponse();

    await controller.getTodayTasks(authRequest(), response);

    expect(streakRepo.save).toHaveBeenCalledTimes(1);
    const saved = streakRepo.save.mock.calls[0][0];
    expect(saved.currentStreak).toBe(3);
    expect(saved.longestStreak).toBe(3);
  });
});
