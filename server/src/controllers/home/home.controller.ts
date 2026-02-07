import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import MessageEntity from "../../models/message.entity";

interface HomeController {
  getMessage: (request: Request, response: Response) => Promise<void>;
}

/**
 * Builds the Home controller with injected data source dependencies.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @returns The Home controller handlers.
 */
export const createHomeController = (dataSource: DataSource): HomeController => {
  const repository = dataSource.getRepository(MessageEntity);

  const getMessage: HomeController["getMessage"] = async (_request, response) => {
    try {
      const latestMessage = await repository.findOne({
        order: {
          createdAt: "DESC"
        }
      });

      if (!latestMessage) {
        response.json({
          message: "Hello from the Node.js server!",
          timestamp: new Date().toISOString()
        });
        return;
      }

      response.json({
        message: latestMessage.content,
        timestamp: latestMessage.createdAt.toISOString()
      });
    } catch (error) {
      response.status(500).json({
        message: "Failed to load message",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return {
    getMessage
  };
};
