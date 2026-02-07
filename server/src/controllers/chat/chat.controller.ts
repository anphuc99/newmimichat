import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import { createOpenAIChatService, type OpenAIChatService } from "../../services/openai.service.js";
import { buildChatSystemPrompt } from "../../services/chat-prompt.service.js";
import CharacterEntity from "../../models/character.entity.js";
import MessageEntity from "../../models/message.entity.js";
import UserEntity from "../../models/user.entity.js";
import { createChatHistoryStore, type ChatHistoryStore } from "../../services/chat-history.service.js";

interface ChatController {
  sendMessage: (request: Request, response: Response) => Promise<void>;
  getHistory: (request: Request, response: Response) => Promise<void>;
}

interface ChatControllerDeps {
  openAIService?: OpenAIChatService;
  historyStore?: ChatHistoryStore;
  /**
   * Optional override for building the system instruction text.
   * Primarily used by unit tests to avoid database lookups.
   */
  systemPromptBuilder?: (params: { userId: number; body: unknown }) => Promise<string> | string;
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
  const userRepository = dataSource.getRepository(UserEntity);
  const characterRepository = dataSource.getRepository(CharacterEntity);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const systemPromptPath = process.env.OPENAI_SYSTEM_PROMPT_PATH;
  const openAIService =
    deps.openAIService ?? (apiKey ? createOpenAIChatService({ apiKey, model, systemPromptPath }) : null);
  const historyStore = deps.historyStore ?? createChatHistoryStore();

  const getSessionId = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const getOptionalString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  /**
   * Builds a dynamic system instruction string for the current user/session.
   *
   * This mirrors the older MimiChat initChat prompt style (level rules, characters, optional
   * story/context blocks), while skipping any missing fields.
   */
  const buildSystemPrompt = async (userId: number, body: unknown) => {
    if (deps.systemPromptBuilder) {
      const prompt = await deps.systemPromptBuilder({ userId, body });
      return (prompt ?? "").trim();
    }

    const payload = (body ?? {}) as Record<string, unknown>;

    const user = await userRepository.findOne({
      where: { id: userId },
      relations: { level: true }
    });

    const characters = await characterRepository.find({
      where: { userId },
      order: { id: "ASC" }
    });

    return buildChatSystemPrompt({
      level: user?.level?.level ?? null,
      levelMaxWords: user?.level?.maxWords ?? null,
      levelDescription: user?.level?.descript ?? null,
      levelGuideline: user?.level?.guideline ?? null,
      characters: characters.map((character) => ({
        name: character.name,
        gender: character.gender,
        personality: character.personality,
        appearance: character.appearance ?? null
      })),
      context: getOptionalString(payload.context) || null,
      storyPlot: getOptionalString(payload.storyPlot) || null,
      relationshipSummary: getOptionalString(payload.relationshipSummary) || null,
      contextSummary: getOptionalString(payload.contextSummary) || null,
      relatedStoryMessages: getOptionalString(payload.relatedStoryMessages) || null,
      checkPronunciation: Boolean(payload.checkPronunciation)
    });
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
      const systemPrompt = await buildSystemPrompt(request.user.id, request.body);
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
