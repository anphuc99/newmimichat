import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import { createOpenAIChatService, type OpenAIChatService } from "../../services/openai.service.js";

interface ChatController {
  sendMessage: (request: Request, response: Response) => Promise<void>;
}

interface ChatControllerDeps {
  openAIService?: OpenAIChatService;
}

/**
 * Builds the Chat controller with injected data source dependencies.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @param deps - Optional overrides for external services.
 * @returns The Chat controller handlers.
 */
export const createChatController = (
  _dataSource: DataSource,
  deps: ChatControllerDeps = {}
): ChatController => {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const systemPromptPath = process.env.OPENAI_SYSTEM_PROMPT_PATH;
  const openAIService =
    deps.openAIService ?? (apiKey ? createOpenAIChatService({ apiKey, model, systemPromptPath }) : null);

  const sendMessage: ChatController["sendMessage"] = async (request, response) => {
    const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";

    if (!message) {
      response.status(400).json({
        message: "Message is required"
      });
      return;
    }

    if (!openAIService) {
      response.status(500).json({
        message: "OpenAI API key is not configured"
      });
      return;
    }

    try {
      const result = await openAIService.createReply(message);

      response.json({
        reply: result.reply,
        model: result.model
      });
    } catch (error) {
      response.status(500).json({
        message: "Failed to generate reply",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return {
    sendMessage
  };
};
