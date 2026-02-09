import { Router } from "express";
import type { DataSource } from "typeorm";
import { createListeningController } from "../controllers/listening/listening.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

/**
 * Registers routes for the Listening view group.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns An Express router for Listening.
 */
export const createListeningRoutes = (dataSource: DataSource) => {
  const router = Router();
  const controller = createListeningController(dataSource);

  router.use(requireAuth);

  router.get("/stats", controller.getStats);
  router.get("/due", controller.getDueCards);
  router.get("/learn", controller.getLearnCandidate);
  router.get("/", controller.listCards);
  router.post("/review", controller.reviewListening);
  router.put("/:id/star", controller.toggleStar);

  return router;
};
