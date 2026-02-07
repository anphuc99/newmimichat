import { describe, expect, it, vi } from "vitest";
import { createTtsController } from "../../../../server/src/controllers/shared/tts.controller";
import { buildAudioId } from "../../../../server/src/services/tts.service";

vi.mock("fs/promises", () => ({
  __esModule: true,
  default: {
    access: vi.fn(),
    unlink: vi.fn()
  }
}));

vi.mock("../../../../server/src/services/tts.service", () => ({
  __esModule: true,
  buildAudioId: vi.fn(() => "hash"),
  createTtsAudio: vi.fn(async () => "hash"),
  getAudioPath: vi.fn(() => "path")
}));

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

describe("TTS controller", () => {
  it("returns 400 when text is missing", async () => {
    const controller = createTtsController();
    const response = createMockResponse();

    await controller.getTextToSpeech({ query: {} } as any, response);

    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("returns cached audio when it exists", async () => {
    const controller = createTtsController();
    const response = createMockResponse();
    const fs = (await import("fs/promises")) as unknown as { default: { access: ReturnType<typeof vi.fn> } };
    fs.default.access.mockResolvedValue(undefined);

    await controller.getTextToSpeech({ query: { text: "Hello", tone: "neutral", voice: "alloy" } } as any, response);

    expect(buildAudioId).toHaveBeenCalledWith("Hello", "neutral", "alloy");
    expect(response.json).toHaveBeenCalledWith({ success: true, output: "hash", url: "/audio/hash.mp3" });
  });

  it("creates audio when it is missing", async () => {
    const controller = createTtsController();
    const response = createMockResponse();
    const fs = (await import("fs/promises")) as unknown as { default: { access: ReturnType<typeof vi.fn> } };
    fs.default.access.mockRejectedValue({ code: "ENOENT" });

    await controller.getTextToSpeech({ query: { text: "Hello", tone: "neutral", voice: "alloy" } } as any, response);

    expect(buildAudioId).toHaveBeenCalledWith("Hello", "neutral", "alloy");
    expect(response.json).toHaveBeenCalledWith({ success: true, output: "hash", url: "/audio/hash.mp3" });
  });
});
