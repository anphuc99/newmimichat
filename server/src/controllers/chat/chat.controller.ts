import type { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { DataSource } from "typeorm";
import { createOpenAIChatService, type OpenAIChatService } from "../../services/openai.service.js";
import MessageEntity from "../../models/message.entity.js";
import { createChatHistoryStore, type ChatHistoryStore } from "../../services/chat-history.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYSTEM_PROMPT_PATH = path.join(__dirname, "..", "..", "prompts", "chat.system.txt");

interface ChatController {
  sendMessage: (request: Request, response: Response) => Promise<void>;
  getHistory: (request: Request, response: Response) => Promise<void>;
}

interface ChatControllerDeps {
  openAIService?: OpenAIChatService;
  historyStore?: ChatHistoryStore;
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
  const dataSource = _dataSource;
  const repository = dataSource.getRepository(MessageEntity);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const systemPromptPath = process.env.OPENAI_SYSTEM_PROMPT_PATH;
  const openAIService =
    deps.openAIService ?? (apiKey ? createOpenAIChatService({ apiKey, model, systemPromptPath }) : null);
  const historyStore = deps.historyStore ?? createChatHistoryStore();
  let cachedSystemPrompt: string | null = null;

  const getSessionId = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  /**
   * Loads the system instruction text used for the chat history.
   *
   * @returns The system prompt contents.
   */
  const loadSystemPrompt = async () => {
    if (cachedSystemPrompt) {
      return cachedSystemPrompt;
    }

    const promptPath = systemPromptPath ?? DEFAULT_SYSTEM_PROMPT_PATH;
    const contents = await fs.readFile(promptPath, "utf8");
    cachedSystemPrompt = contents.trim();
    return cachedSystemPrompt;
  };

  const sendMessage: ChatController["sendMessage"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
    const sessionId = getSessionId(request.body?.sessionId);

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
      const systemPrompt = await loadSystemPrompt();
      await historyStore.ensureSystemMessage(request.user.id, sessionId, systemPrompt);
      const history = await historyStore.load(request.user.id, sessionId);
      const result = await openAIService.createReply(message, history);

      const userMessage = repository.create({
        content: message,
        role: "user",
        userId: request.user.id
      });
      const assistantMessage = repository.create({
        content: result.reply,
        role: "assistant",
        userId: request.user.id
      });

      await repository.save([userMessage, assistantMessage]);

      await historyStore.append(request.user.id, sessionId, [
        { role: "user", content: message },
        { role: "assistant", content: result.reply }
      ]);

      response.json({
        reply: result.reply,
        model: result.model
      });
    } catch (error) {
      console.error("Error in sendMessage:", error);
      response.status(500).json({
        message: "Failed to generate reply",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const getHistory: ChatController["getHistory"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const sessionId = getSessionId(request.query?.sessionId);

    try {
      const messages = await historyStore.load(request.user.id, sessionId);
      response.json({ messages: messages.filter((message) => message.role !== "system") });
    } catch (error) {
      response.status(500).json({
        message: "Failed to load chat history",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return {
    sendMessage,
    getHistory
  };
};
