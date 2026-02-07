import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { createUsersController } from "../../../../server/src/controllers/users/users.controller";

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
  findOne: async () => null,
  create: (payload: any) => payload,
  save: async (payload: any) => ({
    id: 1,
    username: payload.username,
    passwordHash: payload.passwordHash,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z")
  })
});

const createController = (repository: ReturnType<typeof createRepository>) => {
  const dataSource = {
    getRepository: () => repository
  } as any;

  return createUsersController(dataSource);
};

describe("Users controller", () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("registers a user", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12" } } as any,
      response
    );

    expect(response.statusCode).toBe(201);
    expect(response.payload.user.username).toBe("mimi");
    expect(typeof response.payload.token).toBe("string");
  });

  it("rejects duplicate usernames", async () => {
    const repository = createRepository();
    repository.findOne = async () => ({ id: 1, username: "mimi" } as any);
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register(
      { body: { username: "mimi", password: "secret12" } } as any,
      response
    );

    expect(response.statusCode).toBe(409);
    expect(response.payload.message).toBe("Username is already taken");
  });

  it("rejects invalid register payload", async () => {
    const repository = createRepository();
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.register({ body: { username: "" } } as any, response);

    expect(response.statusCode).toBe(400);
    expect(response.payload.message).toBe("Username and password are required");
  });

  it("logs in a user", async () => {
    const passwordHash = await bcrypt.hash("secret12", 10);
    const repository = createRepository();
    repository.findOne = async () => ({
      id: 2,
      username: "mimi",
      passwordHash
    } as any);
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
    const repository = createRepository();
    repository.findOne = async () => ({
      id: 2,
      username: "mimi",
      passwordHash
    } as any);
    const controller = createController(repository);
    const response = createMockResponse();

    await controller.login(
      { body: { username: "mimi", password: "wrong" } } as any,
      response
    );

    expect(response.statusCode).toBe(401);
    expect(response.payload.message).toBe("Invalid credentials");
  });
});
