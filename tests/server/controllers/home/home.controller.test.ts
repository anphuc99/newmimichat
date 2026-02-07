import { describe, expect, it, vi } from "vitest";
import { createHomeController } from "../../../../server/src/controllers/home/home.controller";

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

describe("Home controller", () => {
  it("returns a fallback message when no message exists", async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue(null)
    };

    const dataSource = {
      getRepository: vi.fn(() => repository)
    } as any;

    const controller = createHomeController(dataSource);
    const response = createMockResponse();

    await controller.getMessage({} as any, response);

    expect(dataSource.getRepository).toHaveBeenCalledTimes(1);
    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledTimes(1);

    const payload = response.json.mock.calls[0][0] as any;
    expect(payload.message).toBe("Hello from the Node.js server!");
    expect(typeof payload.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });

  it("returns the latest message when one exists", async () => {
    const createdAt = new Date("2020-01-01T00:00:00.000Z");

    const repository = {
      findOne: vi.fn().mockResolvedValue({
        content: "Hi",
        createdAt
      })
    };

    const dataSource = {
      getRepository: vi.fn(() => repository)
    } as any;

    const controller = createHomeController(dataSource);
    const response = createMockResponse();

    await controller.getMessage({} as any, response);

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).toHaveBeenCalledWith({
      message: "Hi",
      timestamp: createdAt.toISOString()
    });
  });

  it("returns 500 when repository fails", async () => {
    const repository = {
      findOne: vi.fn().mockRejectedValue(new Error("db down"))
    };

    const dataSource = {
      getRepository: vi.fn(() => repository)
    } as any;

    const controller = createHomeController(dataSource);
    const response = createMockResponse();

    await controller.getMessage({} as any, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledTimes(1);

    const payload = response.json.mock.calls[0][0] as any;
    expect(payload.message).toBe("Failed to load message");
    expect(payload.error).toBe("db down");
  });
});
