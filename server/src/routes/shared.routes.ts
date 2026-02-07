import { Router } from "express";
import { createHealthController } from "../controllers/shared/health.controller";

/**
 * Registers shared API routes not tied to a view group.
 *
 * @returns An Express router for shared endpoints.
 */
export const createSharedRoutes = () => {
  const router = Router();
  const controller = createHealthController();

  router.get("/health", controller.getHealth);

  return router;
};
