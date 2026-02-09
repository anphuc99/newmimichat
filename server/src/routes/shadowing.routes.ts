import { Router } from "express";
import type { DataSource } from "typeorm";
import { createShadowingController } from "../controllers/shadowing/shadowing.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

/**
 * Registers routes for the Shadowing view group.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns An Express router for Shadowing.
 */
export const createShadowingRoutes = (dataSource: DataSource) => {
  const router = Router();
  const controller = createShadowingController(dataSource);

  router.use(requireAuth);

  router.get("/stats", controller.getStats);
  router.get("/due", controller.getDueCards);
  router.get("/learn", controller.getLearnCandidate);
  router.get("/", controller.listCards);
  router.post("/review", controller.reviewShadowing);
  router.put("/:id/star", controller.toggleStar);
  router.post("/transcribe", controller.transcribeAudio);

  return router;
};
