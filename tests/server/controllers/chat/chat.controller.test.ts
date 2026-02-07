import { describe, expect, it, vi } from "vitest";
import { createChatController } from "../../../../server/src/controllers/chat/chat.controller";

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
  create: vi.fn((payload) => payload),
  save: vi.fn()
});

const createController = (repository: ReturnType<typeof createRepository>, openAIService?: any) => {
  const dataSource = {
    getRepository: vi.fn(() => repository)
  } as any;

  const historyStore = {
    load: vi.fn().mockResolvedValue([{ role: "user", content: "previous" }]),
    append: vi.fn().mockResolvedValue(undefined)
  };

  const controller = createChatController(dataSource, {
    ...(openAIService ? { openAIService } : {}),
    historyStore
  });

  return { controller, historyStore };
};

describe("Chat controller", () => {
  it("returns 400 when the message is missing", async () => {
    const repository = createRepository();
    const { controller } = createController(repository, {
      createReply: vi.fn()
    });
    const response = createMockResponse();

    await controller.sendMessage({ body: {}, user: { id: 1, username: "mimi" } } as any, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Message is required" });
  });

  it("returns 401 when unauthenticated", async () => {
    const repository = createRepository();
    const { controller } = createController(repository, {
      createReply: vi.fn()
    });

    const response = createMockResponse();

    await controller.sendMessage({ body: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("returns 500 when OpenAI is not configured", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";

    const repository = createRepository();
    const { controller } = createController(repository);
    const response = createMockResponse();

    await controller.sendMessage(
      { body: { message: "Hi" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: "OpenAI API key is not configured" });

    process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns the assistant reply", async () => {
    const openAIService = {
      createReply: vi.fn().mockResolvedValue({ reply: "Hello there", model: "test-model" })
    };

    const repository = createRepository();
    const { controller, historyStore } = createController(repository, openAIService);
    const response = createMockResponse();

    await controller.sendMessage(
      { body: { message: "Hi", sessionId: "s1" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(historyStore.load).toHaveBeenCalledWith(1, "s1");
    expect(openAIService.createReply).toHaveBeenCalledWith("Hi", [{ role: "user", content: "previous" }]);
    expect(historyStore.append).toHaveBeenCalledWith(1, "s1", [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello there" }
    ]);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ reply: "Hello there", model: "test-model" });
  });

  it("returns 500 when OpenAI fails", async () => {
    const openAIService = {
      createReply: vi.fn().mockRejectedValue(new Error("rate limited"))
    };

    const repository = createRepository();
    const { controller } = createController(repository, openAIService);
    const response = createMockResponse();

    await controller.sendMessage(
      { body: { message: "Hi", sessionId: "s1" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(500);
    const payload = response.json.mock.calls[0][0] as any;
    expect(payload.message).toBe("Failed to generate reply");
    expect(payload.error).toBe("rate limited");
  });

  it("returns history for a session", async () => {
    const openAIService = {
      createReply: vi.fn()
    };

    const repository = createRepository();
    const { controller, historyStore } = createController(repository, openAIService);
    const response = createMockResponse();

    await controller.getHistory(
      { query: { sessionId: "s1" }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(historyStore.load).toHaveBeenCalledWith(1, "s1");
    expect(response.json).toHaveBeenCalledWith({ messages: [{ role: "user", content: "previous" }] });
  });
});
