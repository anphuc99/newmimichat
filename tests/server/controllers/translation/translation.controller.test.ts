import { describe, expect, it, vi } from "vitest";
import { createTranslationController } from "../../../../server/src/controllers/translation/translation.controller";

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
  find: vi.fn().mockResolvedValue([]),
  findOne: vi.fn().mockResolvedValue(null),
  create: vi.fn((payload: any) => payload),
  save: vi.fn(async (payload: any) => ({
    id: payload.id ?? 1,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...payload
  })),
  count: vi.fn().mockResolvedValue(0),
  createQueryBuilder: vi.fn(() => {
    const qb: any = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
      getOne: vi.fn().mockResolvedValue(null)
    };
    qb.clone = vi.fn().mockReturnValue(qb);
    return qb;
  })
});

/**
 * Constructs the translation controller using four mock repositories.
 *
 * @returns The controller and the mock repos.
 */
const createController = (deps: { explainWithOpenAI?: (payload: any) => Promise<string> } = {}) => {
  const cardRepo = createRepository();
  const reviewRepo = createRepository();
  const messageRepo = createRepository();
  const journalRepo = createRepository();
  let repoIndex = 0;

  const dataSource = {
    options: { type: "mysql" },
    getRepository: vi.fn(() => {
      const repos = [cardRepo, reviewRepo, messageRepo, journalRepo];
      return repos[repoIndex++];
    })
  } as any;

  const controller = createTranslationController(dataSource, deps);
  return { controller, cardRepo, reviewRepo, messageRepo, journalRepo };
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

describe("Translation controller", () => {
  it("returns 401 when unauthenticated", async () => {
    const { controller } = createController();
    const response = createMockResponse();

    await controller.listCards({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("lists cards with reviews", async () => {
    const { controller, cardRepo, reviewRepo } = createController();
    const response = createMockResponse();

    cardRepo.find.mockResolvedValue([
      {
        id: 1,
        messageId: "msg-1",
        content: "Xin chao",
        translation: "Hello",
        userTranslation: null,
        characterName: "Mimi",
        audio: "audio-1",
        journalId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    reviewRepo.find.mockResolvedValue([
      {
        id: 9,
        translationCardId: 1,
        stability: 2,
        difficulty: 5,
        lapses: 0,
        currentIntervalDays: 1,
        nextReviewDate: new Date("2025-01-01"),
        lastReviewDate: null,
        isStarred: false,
        reviewHistoryJson: "[]"
      }
    ]);

    await controller.listCards(authRequest(), response);

    expect(response.json).toHaveBeenCalledTimes(1);
    const payload = response.json.mock.calls[0][0];
    expect(payload.cards).toHaveLength(1);
    expect(payload.cards[0].review).toBeTruthy();
  });

  it("returns empty candidates when no learn candidate exists", async () => {
    const { controller, messageRepo } = createController();
    const response = createMockResponse();

    const query = messageRepo.createQueryBuilder();
    query.getMany.mockResolvedValue([]);

    await controller.getLearnCandidate(authRequest(), response);

    expect(response.json).toHaveBeenCalledWith({ candidates: [] });
  });

  it("creates a new card when reviewing a new message", async () => {
    const { controller, cardRepo, messageRepo, reviewRepo } = createController();
    const response = createMockResponse();

    cardRepo.findOne.mockResolvedValue(null);
    messageRepo.findOne.mockResolvedValue({
      id: "msg-1",
      content: "Chao em",
      translation: "Hello",
      characterName: "Mimi",
      audio: "audio-1",
      journalId: 1,
      userId: 1
    });

    await controller.reviewTranslation(
      authRequest({ body: { rating: 3, messageId: "msg-1", userTranslation: "Hello" } }),
      response
    );

    expect(cardRepo.save).toHaveBeenCalledTimes(1);
    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("toggles star status", async () => {
    const { controller, reviewRepo } = createController();
    const response = createMockResponse();

    reviewRepo.findOne.mockResolvedValue({
      id: 1,
      translationCardId: 1,
      userId: 1,
      isStarred: false,
      stability: 0,
      difficulty: 5,
      lapses: 0,
      currentIntervalDays: 1,
      nextReviewDate: new Date(),
      lastReviewDate: null,
      reviewHistoryJson: "[]"
    });

    await controller.toggleStar(authRequest({ params: { id: "1" } }), response);

    expect(reviewRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("returns cached explanation when available", async () => {
    const explainWithOpenAI = vi.fn().mockResolvedValue("**cached**");
    const { controller, cardRepo } = createController({ explainWithOpenAI });
    const response = createMockResponse();

    cardRepo.findOne.mockResolvedValue({
      id: 1,
      messageId: "msg-1",
      content: "Xin chao",
      translation: "Hello",
      userTranslation: null,
      characterName: "Mimi",
      audio: null,
      explanationMd: "**cached**",
      journalId: 1,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await controller.explainTranslation(authRequest({ body: { cardId: 1 } }), response);

    expect(explainWithOpenAI).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      explanation: "**cached**",
      card: expect.objectContaining({ explanationMd: "**cached**" })
    });
  });

  it("generates explanation when missing", async () => {
    const explainWithOpenAI = vi.fn().mockResolvedValue("**fresh**");
    const { controller, cardRepo } = createController({ explainWithOpenAI });
    const response = createMockResponse();

    cardRepo.findOne.mockResolvedValue({
      id: 1,
      messageId: "msg-1",
      content: "Xin chao",
      translation: "Hello",
      userTranslation: null,
      characterName: "Mimi",
      audio: null,
      explanationMd: null,
      journalId: 1,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await controller.explainTranslation(authRequest({ body: { cardId: 1 } }), response);

    expect(explainWithOpenAI).toHaveBeenCalledTimes(1);
    expect(cardRepo.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledWith({
      explanation: "**fresh**",
      card: expect.objectContaining({ explanationMd: "**fresh**" })
    });
  });
});
