import { describe, expect, it, vi } from "vitest";
import { createVocabularyController } from "../../../../server/src/controllers/vocabulary/vocabulary.controller";

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
 * @returns A mock repository with common method spies.
 */
const createRepository = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn((payload: any) => payload),
  save: vi.fn(async (payload: any) => ({
    id: payload.id || "test-uuid-1234",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...payload
  })),
  remove: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
  createQueryBuilder: vi.fn(() => ({
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([])
  }))
});

/**
 * Constructs the vocabulary controller using three mock repositories.
 *
 * @returns The controller and the three mock repos.
 */
const createController = () => {
  const vocabRepo = createRepository();
  const reviewRepo = createRepository();
  const memoryRepo = createRepository();
  let repoIndex = 0;

  const dataSource = {
    getRepository: vi.fn(() => {
      const repos = [vocabRepo, reviewRepo, memoryRepo];
      return repos[repoIndex++];
    })
  } as any;

  const controller = createVocabularyController(dataSource);
  return { controller, vocabRepo, reviewRepo, memoryRepo };
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

describe("Vocabulary controller", () => {
  // ────────────────────────────────────────── AUTH ─────────────────────────
  it("returns 401 when unauthenticated", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.listVocabularies({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  // ────────────────────────────────────────── LIST ─────────────────────────
  it("lists vocabularies with reviews and memories", async () => {
    const { controller, vocabRepo, reviewRepo, memoryRepo } = createController();
    const response = createMockResponse();

    vocabRepo.find.mockResolvedValue([
      { id: "vocab-uuid-1", korean: "안녕", vietnamese: "Xin chào", userId: 1 }
    ]);
    reviewRepo.find.mockResolvedValue([
      {
        id: 1,
        vocabularyId: "vocab-uuid-1",
        stability: 1,
        difficulty: 5,
        lapses: 0,
        currentIntervalDays: 1,
        nextReviewDate: new Date("2025-01-01"),
        lastReviewDate: null,
        cardDirection: "kr-vn",
        isStarred: false,
        reviewHistoryJson: "[]"
      }
    ]);
    memoryRepo.find.mockResolvedValue([]);

    await controller.listVocabularies(authRequest(), response);

    expect(vocabRepo.find).toHaveBeenCalledWith({
      where: { userId: 1 },
      order: { createdAt: "DESC" }
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0][0];
    expect(payload.vocabularies).toHaveLength(1);
    expect(payload.vocabularies[0].review).toBeTruthy();
  });

  // ────────────────────────────────────────── GET ONE ──────────────────────
  it("returns 404 for missing vocabulary", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue(null);

    await controller.getVocabulary(
      authRequest({ params: { id: "999" } }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Vocabulary not found" });
  });

  // ────────────────────────────────────────── COLLECT ──────────────────────
  it("collects a new vocabulary", async () => {
    const { controller, vocabRepo, reviewRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue(null); // no duplicate
    vocabRepo.save.mockResolvedValue({
      id: "vocab-uuid-10",
      korean: "사랑",
      vietnamese: "Tình yêu",
      isManuallyAdded: true,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    reviewRepo.save.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-10",
      stability: 0,
      difficulty: 0,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      cardDirection: "kr-vn",
      isStarred: false,
      reviewHistoryJson: "[]"
    });

    await controller.collectVocabulary(
      authRequest({
        body: { korean: "사랑", vietnamese: "Tình yêu" }
      }),
      response
    );

    expect(vocabRepo.create).toHaveBeenCalledTimes(1);
    expect(vocabRepo.save).toHaveBeenCalledTimes(1);
    expect(reviewRepo.create).toHaveBeenCalledTimes(1);
    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it("rejects duplicate vocabulary", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue({ id: "vocab-uuid-5", korean: "사랑" });

    await controller.collectVocabulary(
      authRequest({
        body: { korean: "사랑", vietnamese: "Tình yêu" }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(409);
  });

  it("rejects empty korean/vietnamese", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.collectVocabulary(
      authRequest({ body: { korean: "", vietnamese: "" } }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Korean and Vietnamese are required"
    });
  });

  // ────────────────────────────────────────── UPDATE ───────────────────────
  it("updates vocabulary text", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue({
      id: "vocab-uuid-1",
      korean: "사랑",
      vietnamese: "Tình yêu",
      userId: 1
    });

    await controller.updateVocabulary(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { korean: "감사", vietnamese: "Cảm ơn" }
      }),
      response
    );

    expect(vocabRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when updating missing vocabulary", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();
    vocabRepo.findOne.mockResolvedValue(null);

    await controller.updateVocabulary(
      authRequest({
        params: { id: "999" },
        body: { korean: "감사" }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  // ────────────────────────────────────────── DELETE ───────────────────────
  it("deletes a vocabulary", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue({ id: "vocab-uuid-1", korean: "사랑", userId: 1 });

    await controller.deleteVocabulary(
      authRequest({ params: { id: "vocab-uuid-1" } }),
      response
    );

    expect(vocabRepo.remove).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith({ message: "Vocabulary deleted" });
  });

  it("returns 404 when deleting missing vocabulary", async () => {
    const { controller, vocabRepo } = createController();
    const response = createMockResponse();
    vocabRepo.findOne.mockResolvedValue(null);

    await controller.deleteVocabulary(
      authRequest({ params: { id: "999" } }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  // ────────────────────────────────────────── REVIEW ───────────────────────
  it("submits a review rating", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.findOne.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      userId: 1,
      stability: 1,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date("2025-01-01"),
      lastReviewDate: null,
      cardDirection: "kr-vn",
      isStarred: false,
      reviewHistoryJson: "[]"
    });

    reviewRepo.save.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      stability: 2,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 3,
      nextReviewDate: new Date("2025-01-04"),
      lastReviewDate: new Date("2025-01-01"),
      cardDirection: "kr-vn",
      isStarred: false,
      reviewHistoryJson: "[]"
    });

    await controller.reviewVocabulary(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { rating: 3 }
      }),
      response
    );

    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid rating", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.reviewVocabulary(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { rating: 5 }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when reviewing missing review", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.findOne.mockResolvedValue(null);

    await controller.reviewVocabulary(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { rating: 3 }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(404);
  });

  // ────────────────────────────────────────── DUE ──────────────────────────
  it("returns due reviews", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.find.mockResolvedValue([
      {
        id: 1,
        vocabularyId: "vocab-uuid-1",
        userId: 1,
        stability: 1,
        difficulty: 5,
        lapses: 0,
        currentIntervalDays: 1,
        nextReviewDate: new Date("2020-01-01"),
        lastReviewDate: null,
        cardDirection: "kr-vn",
        isStarred: false,
        reviewHistoryJson: "[]"
      }
    ]);

    await controller.getDueReviews(authRequest(), response);

    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0][0];
    expect(payload.total).toBeGreaterThanOrEqual(0);
  });

  // ────────────────────────────────────────── STATS ────────────────────────
  it("returns vocabulary stats", async () => {
    const { controller, vocabRepo, reviewRepo } = createController();
    const response = createMockResponse();

    vocabRepo.count.mockResolvedValue(5);
    reviewRepo.count.mockResolvedValue(3);
    reviewRepo.find.mockResolvedValue([]);

    await controller.getStats(authRequest(), response);

    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0][0];
    expect(payload.totalVocabularies).toBe(5);
  });

  // ────────────────────────────────────────── MEMORY ───────────────────────
  it("saves memory for a vocabulary", async () => {
    const { controller, vocabRepo, memoryRepo } = createController();
    const response = createMockResponse();

    vocabRepo.findOne.mockResolvedValue({ id: "vocab-uuid-1", korean: "사랑", userId: 1 });
    memoryRepo.findOne.mockResolvedValue(null);
    memoryRepo.save.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      userMemory: "Love/heart",
      linkedMessageIdsJson: "[]",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await controller.saveMemory(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { userMemory: "Love/heart" }
      }),
      response
    );

    expect(memoryRepo.create).toHaveBeenCalledTimes(1);
    expect(memoryRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("rejects empty memory content", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.saveMemory(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { userMemory: "" }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
  });

  // ────────────────────────────────────────── STAR ─────────────────────────
  it("toggles star on a review", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.findOne.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      userId: 1,
      stability: 1,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      cardDirection: "kr-vn",
      isStarred: false,
      reviewHistoryJson: "[]"
    });

    reviewRepo.save.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      stability: 1,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      cardDirection: "kr-vn",
      isStarred: true,
      reviewHistoryJson: "[]"
    });

    await controller.toggleStar(
      authRequest({ params: { id: "vocab-uuid-1" } }),
      response
    );

    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────── DIRECTION ────────────────────
  it("sets card direction", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.findOne.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      userId: 1,
      cardDirection: "kr-vn",
      reviewHistoryJson: "[]",
      stability: 1,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      isStarred: false
    });

    reviewRepo.save.mockResolvedValue({
      id: 1,
      vocabularyId: "vocab-uuid-1",
      userId: 1,
      cardDirection: "vn-kr",
      reviewHistoryJson: "[]",
      stability: 1,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      isStarred: false
    });

    await controller.setCardDirection(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { direction: "vn-kr" }
      }),
      response
    );

    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid direction", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.setCardDirection(
      authRequest({
        params: { id: "vocab-uuid-1" },
        body: { direction: "invalid" }
      }),
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
  });
});
