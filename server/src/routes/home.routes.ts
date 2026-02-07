import { Router } from "express";
import type { DataSource } from "typeorm";
import { createHomeController } from "../controllers/home/home.controller";

/**
 * Registers routes for the Home view group.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns An Express router for the Home group.
 */
export const createHomeRoutes = (dataSource: DataSource) => {
  const router = Router();
  const controller = createHomeController(dataSource);

  router.get("/message", controller.getMessage);

  return router;
};
