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

describe("Chat controller", () => {
  it("returns 400 when the message is missing", async () => {
    const controller = createChatController({} as any, {
      openAIService: {
        createReply: vi.fn()
      }
    });

    const response = createMockResponse();

    await controller.sendMessage({ body: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Message is required" });
  });

  it("returns 500 when OpenAI is not configured", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";

    const controller = createChatController({} as any);
    const response = createMockResponse();

    await controller.sendMessage({ body: { message: "Hi" } } as any, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({ message: "OpenAI API key is not configured" });

    process.env.OPENAI_API_KEY = originalKey;
  });

  it("returns the assistant reply", async () => {
    const openAIService = {
      createReply: vi.fn().mockResolvedValue({ reply: "Hello there", model: "test-model" })
    };

    const controller = createChatController({} as any, { openAIService });
    const response = createMockResponse();

    await controller.sendMessage({ body: { message: "Hi" } } as any, response);

    expect(openAIService.createReply).toHaveBeenCalledWith("Hi");
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({ reply: "Hello there", model: "test-model" });
  });

  it("returns 500 when OpenAI fails", async () => {
    const openAIService = {
      createReply: vi.fn().mockRejectedValue(new Error("rate limited"))
    };

    const controller = createChatController({} as any, { openAIService });
    const response = createMockResponse();

    await controller.sendMessage({ body: { message: "Hi" } } as any, response);

    expect(response.status).toHaveBeenCalledWith(500);
    const payload = response.json.mock.calls[0][0] as any;
    expect(payload.message).toBe("Failed to generate reply");
    expect(payload.error).toBe("rate limited");
  });
});
