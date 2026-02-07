import { describe, expect, it, vi } from "vitest";
import * as fsPromises from "fs/promises";
import { createCharactersController } from "../../../../server/src/controllers/characters/characters.controller";

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined)
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
  response.send = vi.fn();
  return response;
};

const createRepository = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn((payload) => payload),
  save: vi.fn(async (payload) => ({
    id: 1,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...payload
  })),
  remove: vi.fn()
});

const createController = (repository: ReturnType<typeof createRepository>) => {
  const dataSource = {
    getRepository: vi.fn(() => repository)
  } as any;

  return createCharactersController(dataSource);
};

describe("Characters controller", () => {
  it("lists characters", async () => {
    const repository = createRepository();
    repository.find.mockResolvedValue([
      {
        id: 1,
        name: "Mimi",
        personality: "Warm",
        gender: "female",
        appearance: null,
        avatar: null,
        voiceModel: null,
        voiceName: null,
        pitch: null,
        speakingRate: null,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z")
      }
    ]);

    const controller = createController(repository);
    const response = createMockResponse();

    await controller.listCharacters({} as any, response);

    expect(repository.find).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("creates a character", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.createCharacter({
      body: { name: "Mimi", personality: "Warm", gender: "female" }
    } as any, response);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid create payload", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.createCharacter({ body: { name: "" } } as any, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Name, personality, and gender are required"
    });
  });

  it("updates a character", async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      id: 1,
      name: "Mimi",
      personality: "Warm",
      gender: "female",
      appearance: null,
      avatar: null,
      voiceModel: null,
      voiceName: null,
      pitch: null,
      speakingRate: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z")
    });

    const controller = createController(repository);
    const response = createMockResponse();

    await controller.updateCharacter({
      params: { id: "1" },
      body: { name: "Mimi", personality: "Friendly", gender: "female" }
    } as any, response);

    expect(repository.findOne).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when updating missing character", async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue(null);
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.updateCharacter({
      params: { id: "999" },
      body: { name: "Mimi", personality: "Friendly", gender: "female" }
    } as any, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ message: "Character not found" });
  });

  it("deletes a character", async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({ id: 1 });
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.deleteCharacter({ params: { id: "1" } } as any, response);

    expect(repository.remove).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(204);
    expect(response.send).toHaveBeenCalledTimes(1);
  });

  it("uploads an avatar image", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.uploadAvatar(
      {
        body: {
          image: "data:image/png;base64,aGVsbG8=",
          filename: "avatar.png"
        }
      } as any,
      response
    );

    expect(fsPromises.mkdir).toHaveBeenCalledTimes(1);
    expect(fsPromises.writeFile).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported avatar data", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.uploadAvatar(
      {
        body: {
          image: "not-a-data-url"
        }
      } as any,
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ message: "Unsupported image format" });
  });
});
