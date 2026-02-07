import { describe, expect, it, vi } from "vitest";
import { createHealthController } from "../../../../server/src/controllers/shared/health.controller";

/**
 * Creates a minimal Express-like response object for unit tests.
 *
 * @returns A mock response with a json spy.
 */
const createMockResponse = () => {
  return {
    json: vi.fn()
  } as any;
};

describe("Health controller", () => {
  it("returns status ok", () => {
    const controller = createHealthController();
    const response = createMockResponse();

    controller.getHealth({} as any, response);

    expect(response.json).toHaveBeenCalledWith({ status: "ok" });
  });
});
