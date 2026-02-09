import { describe, expect, it, vi } from "vitest";
import { createStreakController } from "../../../../server/src/controllers/streak/streak.controller";

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
 * Creates a mock streak repository.
 *
 * @param streak - Streak record to return from findOne.
 * @returns A mock repository with common method spies.
 */
const createRepository = (streak: any = null) => ({
  findOne: vi.fn().mockResolvedValue(streak),
  create: vi.fn((payload: any) => payload),
  save: vi.fn(async (payload: any) => payload)
});

/**
 * Constructs the streak controller using a mock repository.
 *
 * @param repository - Mock repository to return.
 * @returns The controller and repository.
 */
const createController = (repository: any) => {
  const dataSource = {
    getRepository: vi.fn(() => repository)
  } as any;

  const controller = createStreakController(dataSource);
  return { controller, repository };
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

describe("Streak controller", () => {
  it("returns 401 when unauthenticated", async () => {
    const { controller } = createController(createRepository());
    const response = createMockResponse();

    await controller.getStreak({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("creates a default streak when missing", async () => {
    const repo = createRepository(null);
    const { controller } = createController(repo);
    const response = createMockResponse();

    await controller.getStreak(authRequest(), response);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith({
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null
    });
  });

  it("resets streak when last completion is older than yesterday", async () => {
    const staleDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const repo = createRepository({
      id: 1,
      userId: 1,
      currentStreak: 4,
      longestStreak: 6,
      lastCompletedDate: staleDate
    });
    const { controller } = createController(repo);
    const response = createMockResponse();

    await controller.getStreak(authRequest(), response);

    expect(repo.save).toHaveBeenCalledTimes(1);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.currentStreak).toBe(0);
    expect(saved.longestStreak).toBe(6);
  });
});
