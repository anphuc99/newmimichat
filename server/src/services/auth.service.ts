import jwt from "jsonwebtoken";
import type { AuthUser } from "../types/user.js";

const DEFAULT_EXPIRY = "7d";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET ?? "";

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
};

/**
 * Signs a JWT for the given user.
 *
 * @param user - Authenticated user to include in the token.
 * @returns A signed JWT string.
 */
export const signAuthToken = (user: AuthUser) => {
  const secret = getJwtSecret();
  return jwt.sign(user, secret, { expiresIn: DEFAULT_EXPIRY });
};

/**
 * Verifies a JWT and returns the user payload.
 *
 * @param token - Bearer token without the prefix.
 * @returns The decoded user payload.
 */
export const verifyAuthToken = (token: string) => {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as AuthUser;
};
