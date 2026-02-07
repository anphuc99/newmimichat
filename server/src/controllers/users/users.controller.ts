import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import UserEntity from "../../models/user.entity.js";
import { signAuthToken } from "../../services/auth.service.js";
import type { AuthUser } from "../../types/user.js";

interface UserPayload {
  username: string;
  password: string;
}

interface UserResponse {
  user: AuthUser;
  token: string;
}

interface UsersController {
  register: (request: Request, response: Response) => Promise<void>;
  login: (request: Request, response: Response) => Promise<void>;
  getMe: (request: Request, response: Response) => Promise<void>;
}

const normalizeUsername = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

const isValidPassword = (password: string) => password.length >= 6;

const toAuthResponse = (user: UserEntity): UserResponse => {
  const authUser: AuthUser = { id: user.id, username: user.username };

  return {
    user: authUser,
    token: signAuthToken(authUser)
  };
};

/**
 * Builds the Users controller with injected data source dependencies.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns The Users controller handlers.
 */
export const createUsersController = (dataSource: DataSource): UsersController => {
  const repository = dataSource.getRepository(UserEntity);

  const register: UsersController["register"] = async (request, response) => {
    const payload = request.body as UserPayload;
    const username = normalizeUsername(payload?.username);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!username || !isValidPassword(password)) {
      response.status(400).json({
        message: "Username and password are required"
      });
      return;
    }

    try {
      const existing = await repository.findOne({ where: { username } });

      if (existing) {
        response.status(409).json({ message: "Username is already taken" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = repository.create({ username, passwordHash });
      const saved = await repository.save(user);

      response.status(201).json(toAuthResponse(saved));
    } catch (error) {
      response.status(500).json({
        message: "Failed to register user",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const login: UsersController["login"] = async (request, response) => {
    const payload = request.body as UserPayload;
    const username = normalizeUsername(payload?.username);
    const password = typeof payload?.password === "string" ? payload.password : "";

    if (!username || !password) {
      response.status(400).json({ message: "Username and password are required" });
      return;
    }

    try {
      const user = await repository.findOne({ where: { username } });

      if (!user) {
        response.status(401).json({ message: "Invalid credentials" });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        response.status(401).json({ message: "Invalid credentials" });
        return;
      }

      response.json(toAuthResponse(user));
    } catch (error) {
      response.status(500).json({
        message: "Failed to login",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const getMe: UsersController["getMe"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    response.json({ user: request.user });
  };

  return {
    register,
    login,
    getMe
  };
};
