import { Router } from "express";
import type { DataSource } from "typeorm";
import { createChatRoutes } from "./chat.routes.js";
import { createHomeRoutes } from "./home.routes.js";
import { createSharedRoutes } from "./shared.routes.js";
// mvc-gen:imports

/**
 * Creates the root API router with all route groups.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns The configured API router.
 */
export const createApiRouter = (dataSource: DataSource) => {
  const router = Router();

  // mvc-gen:routes
  router.use("/chat", createChatRoutes(dataSource));
  router.use("/home", createHomeRoutes(dataSource));
  router.use("/", createSharedRoutes());

  return router;
};
