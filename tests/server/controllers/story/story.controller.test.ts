import { describe, expect, it, vi } from "vitest";
import { createStoryController } from "../../../../server/src/controllers/story/story.controller";

/**
 * Creates a minimal Express-like response object for unit tests.
 *
 * @returns A mock response with json/status spies.
 */
const createMockResponse = () => {
  const response: any = {};
  response.json = vi.fn();
  response.status = vi.fn(() => response);
  return response;
};

const createRepository = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn((payload) => payload),
  save: vi.fn(async (payload) => ({
    id: 1,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...payload
  })),
  remove: vi.fn()
});

const createController = (repository: ReturnType<typeof createRepository>) => {
  const dataSource = {
    getRepository: vi.fn(() => repository)
  } as any;

  return createStoryController(dataSource);
};

describe("Story controller", () => {
  it("returns 401 when unauthenticated", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.listStories({} as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("lists stories", async () => {
    const repository = createRepository();
    repository.find.mockResolvedValue([
      {
        id: 1,
        name: "Story One",
        description: "Desc",
        currentProgress: "Progress",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z")
      }
    ]);

    const controller = createController(repository);
    const response = createMockResponse();

    await controller.listStories({ user: { id: 1 } } as any, response);

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 1 },
      order: { createdAt: "DESC" }
    });
    expect(response.json).toHaveBeenCalledWith({
      stories: [
        {
          id: 1,
          name: "Story One",
          description: "Desc",
          currentProgress: "Progress",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z"
        }
      ]
    });
  });

  it("creates a story", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.createStory(
      {
        body: { name: "Story", description: "Desc", currentProgress: "Progress" },
        user: { id: 1, username: "mimi" }
      } as any,
      response
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Story",
        description: "Desc",
        currentProgress: "Progress",
        userId: 1
      })
    );
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it("rejects empty create payload", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.createStory(
      { body: { name: "" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Name and description are required" });
  });

  it("updates a story", async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      id: 1,
      name: "Story",
      description: "Desc",
      currentProgress: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
      userId: 1
    });

    const controller = createController(repository);
    const response = createMockResponse();

    await controller.updateStory(
      {
        params: { id: "1" },
        body: { name: "Story", description: "New", currentProgress: "Progress" },
        user: { id: 1, username: "mimi" }
      } as any,
      response
    );

    expect(repository.save).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalled();
  });

  it("deletes a story", async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({ id: 1, userId: 1 });

    const controller = createController(repository);
    const response = createMockResponse();

    await controller.deleteStory(
      { params: { id: "1" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(repository.remove).toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ ok: true });
  });
});
