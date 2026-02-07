import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../services/auth.service.js";

/**
 * Ensures an authenticated user exists on the request.
 *
 * @param request - Express request.
 * @param response - Express response.
 * @param next - Express next middleware.
 */
export const requireAuth = (request: Request, response: Response, next: NextFunction) => {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    response.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    request.user = verifyAuthToken(token);
    next();
  } catch (error) {
    response.status(401).json({
      message: "Invalid token",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
