import { Router } from "express";
import type { DataSource } from "typeorm";
import { createTranslationController } from "../controllers/translation/translation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

/**
 * Registers routes for the Translation view group.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns An Express router for Translation.
 */
export const createTranslationRoutes = (dataSource: DataSource) => {
  const router = Router();
  const controller = createTranslationController(dataSource);

  router.use(requireAuth);

  router.get("/stats", controller.getStats);
  router.get("/due", controller.getDueCards);
  router.get("/learn", controller.getLearnCandidate);
  router.get("/", controller.listCards);
  router.post("/review", controller.reviewTranslation);
  router.put("/:id/star", controller.toggleStar);

  return router;
};
