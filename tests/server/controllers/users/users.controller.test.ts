import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createUsersController } from "../../../../server/src/controllers/users/users.controller";
import LevelEntity from "../../../../server/src/models/level.entity";
import UserEntity from "../../../../server/src/models/user.entity";

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

const createUserRepository = () => ({
  findOne: async (options?: { where?: { id?: number; username?: string }; relations?: { level?: boolean } }) => {
    if (options?.where?.id) {
      const level = options?.relations?.level ? { id: 1, level: "A1", descript: "Basic phrases" } : null;
      return {
        id: options.where.id,
        username: "mimi",
        passwordHash: "hashed",
        levelId: level?.id ?? null,
        level
      } as any;
    }

    return null;
  },
  create: (payload: any) => payload,
  save: async (payload: any) => ({
    id: 1,
    username: payload.username,
    passwordHash: payload.passwordHash,
    levelId: payload.levelId ?? null,
    level: payload.level ?? null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z")
  })
});

const createLevelRepository = () => ({
  findOne: async (options?: { where?: { id?: number } }) => {
    if (options?.where?.id === 1) {
      return { id: 1, level: "A1", descript: "Basic phrases" } as any;
    }

    return null;
  }
});

const createController = (
  userRepository: ReturnType<typeof createUserRepository>,
  levelRepository: ReturnType<typeof createLevelRepository> = createLevelRepository()
) => {
  const dataSource = {
    getRepository: (entity: unknown) => {
      if (entity === UserEntity) {
        return userRepository;
      }

      if (entity === LevelEntity) {
        return levelRepository;
      }

      throw new Error("Unknown repository");
    }
  } as any;

  return createUsersController(dataSource);
};

describe("Users controller", () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalRegistrationToken = process.env.REGISTRATION_TOKEN;
  process.env.JWT_SECRET = "test-secret";
  process.env.REGISTRATION_TOKEN = "invite-123";

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.REGISTRATION_TOKEN = originalRegistrationToken;
  });

  it("registers a user", async () => {
    const repository = createUserRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12", registerToken: "invite-123" } } as any,
      response
    );

    expect(response.statusCode).toBe(201);
    expect(response.payload.user.username).toBe("mimi");
    expect(typeof response.payload.token).toBe("string");
  });

  it("rejects duplicate usernames", async () => {
    const repository = createUserRepository();
    repository.findOne = async (options?: { where?: { username?: string } }) =>
      options?.where?.username ? ({ id: 1, username: "mimi" } as any) : null;
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12", registerToken: "invite-123" } } as any,
      response
    );

    expect(response.statusCode).toBe(409);
    expect(response.payload.message).toBe("Username is already taken");
  });

  it("rejects invalid register payload", async () => {
    const repository = createUserRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register({ body: { username: "" } } as any, response);

    expect(response.statusCode).toBe(400);
    expect(response.payload.message).toBe("Username and password are required");
  });

  it("rejects missing registration token", async () => {
    const repository = createUserRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12" } } as any,
      response
    );

    expect(response.statusCode).toBe(403);
    expect(response.payload.message).toBe("Invalid registration token");
  });

  it("rejects invalid registration token", async () => {
    const repository = createUserRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12", registerToken: "wrong" } } as any,
      response
    );

    expect(response.statusCode).toBe(403);
    expect(response.payload.message).toBe("Invalid registration token");
  });

  it("logs in a user", async () => {
    const passwordHash = await bcrypt.hash("secret12", 10);
    const repository = createUserRepository();
    repository.findOne = async (options?: { where?: { username?: string } }) =>
      options?.where?.username
        ? ({
      id: 2,
      username: "mimi",
        passwordHash,
        levelId: 1,
        level: { id: 1, level: "A1", descript: "Basic phrases" }
          } as any)
        : null;
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.login(
      { body: { username: "mimi", password: "secret12" } } as any,
      response
    );

    expect(response.payload.user.username).toBe("mimi");
    expect(typeof response.payload.token).toBe("string");
  });

  it("rejects invalid credentials", async () => {
    const passwordHash = await bcrypt.hash("secret12", 10);
    const repository = createUserRepository();
    repository.findOne = async (options?: { where?: { username?: string } }) =>
      options?.where?.username
        ? ({
      id: 2,
      username: "mimi",
        passwordHash
          } as any)
        : null;
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.login(
      { body: { username: "mimi", password: "wrong" } } as any,
      response
    );

    expect(response.statusCode).toBe(401);
    expect(response.payload.message).toBe("Invalid credentials");
  });

  it("updates user level", async () => {
    const repository = createUserRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.updateLevel(
      { body: { levelId: 1 }, user: { id: 1, username: "mimi" } } as any,
      response
    );

    expect(response.payload.user.levelId).toBe(1);
    expect(response.payload.user.level).toBe("A1");
  });
});
