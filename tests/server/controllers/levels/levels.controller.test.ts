import { describe, expect, it } from "vitest";
import { createLevelsController } from "../../../../server/src/controllers/levels/levels.controller";

/**
 * Creates a minimal Express-like response object for unit tests.
 *
 * @returns A mock response with json/status spies.
 */
const createMockResponse = () => {
  const response: any = {};
  response.json = (payload: any) => {
    response.payload = payload;
    return response;
  };
  response.status = (status: number) => {
    response.statusCode = status;
    return response;
  };
  return response;
};

const createRepository = () => ({
  find: async () => [
    { id: 1, level: "A0", descript: "Getting started" },
    { id: 2, level: "A1", descript: "Basic phrases" }
  ]
});

const createController = (repository: ReturnType<typeof createRepository>) => {
  const dataSource = {
    getRepository: () => repository
  } as any;

  return createLevelsController(dataSource);
};

describe("Levels controller", () => {
  it("returns all levels", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.getLevels({} as any, response);

    expect(response.payload.levels).toHaveLength(2);
    expect(response.payload.levels[0].level).toBe("A0");
  });
});
