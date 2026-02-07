import { Router } from "express";
import type { DataSource } from "typeorm";
import { createHomeRoutes } from "./home.routes";
import { createSharedRoutes } from "./shared.routes";
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
  router.use("/home", createHomeRoutes(dataSource));
  router.use("/", createSharedRoutes());

  return router;
};
