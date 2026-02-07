import { Router } from "express";
import type { DataSource } from "typeorm";
import { createChatController } from "../controllers/chat/chat.controller.js";

/**
 * Registers routes for the Chat view group.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns An Express router for the Chat group.
 */
export const createChatRoutes = (dataSource: DataSource) => {
  const router = Router();
  const controller = createChatController(dataSource);

  router.post("/send", controller.sendMessage);

  return router;
};
