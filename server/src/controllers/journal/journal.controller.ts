import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import JournalEntity from "../../models/journal.entity.js";
import MessageEntity from "../../models/message.entity.js";
import { createOpenAIChatService, type OpenAIChatService } from "../../services/openai.service.js";
import { createChatHistoryStore, type ChatHistoryMessage, type ChatHistoryStore } from "../../services/chat-history.service.js";

interface JournalController {
  listJournals: (request: Request, response: Response) => Promise<void>;
  getJournal: (request: Request, response: Response) => Promise<void>;
  endConversation: (request: Request, response: Response) => Promise<void>;
}

interface JournalControllerDeps {
  openAIService?: OpenAIChatService;
  historyStore?: ChatHistoryStore;
}

interface AssistantTurn {
  CharacterName?: string;
  Text?: string;
  Tone?: string;
  Translation?: string;
}

/**
 * Builds the Journal controller with injected data source dependencies.
 *
 * @param dataSource - Initialized TypeORM data source.
 * @param deps - Optional overrides for external services.
 * @returns The Journal controller handlers.
 */
export const createJournalController = (
  dataSource: DataSource,
  deps: JournalControllerDeps = {}
): JournalController => {
  const journalRepository = dataSource.getRepository(JournalEntity);
  const messageRepository = dataSource.getRepository(MessageEntity);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const systemPromptPath = process.env.OPENAI_SYSTEM_PROMPT_PATH;
  const openAIService =
    deps.openAIService ?? (apiKey ? createOpenAIChatService({ apiKey, model, systemPromptPath }) : null);
  const historyStore = deps.historyStore ?? createChatHistoryStore();

  const getSessionId = (value: unknown) => (typeof value === "string" ? value.trim() : "");

  const parseAssistantReply = (content: string): AssistantTurn[] => {
    const trimmed = content.trim();

    if (!trimmed) {
      return [];
    }

    const tryParse = (input: string) => {
      try {
        const parsed = JSON.parse(input) as unknown;
        if (Array.isArray(parsed)) {
          return parsed as AssistantTurn[];
        }
        if (parsed && typeof parsed === "object") {
          return [parsed as AssistantTurn];
        }
      } catch {
        return null;
      }

      return null;
    };

    const direct = tryParse(trimmed);
    if (direct) {
      return direct;
    }

    const arrayStart = trimmed.indexOf("[");
    const arrayEnd = trimmed.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      const sliced = tryParse(trimmed.slice(arrayStart, arrayEnd + 1));
      if (sliced) {
        return sliced;
      }
    }

    const objectStart = trimmed.indexOf("{");
    const objectEnd = trimmed.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
      const sliced = tryParse(trimmed.slice(objectStart, objectEnd + 1));
      if (sliced) {
        return sliced;
      }
    }

    return [];
  };

  const extractSummary = (reply: string) => {
    const turns = parseAssistantReply(reply);
    if (!turns.length) {
      return reply.trim();
    }

    const first = turns[0] ?? {};
    const translation = typeof first.Translation === "string" ? first.Translation.trim() : "";
    const text = typeof first.Text === "string" ? first.Text.trim() : "";

    return translation || text || reply.trim();
  };

  const buildMessageEntities = (
    history: ChatHistoryMessage[],
    userId: number,
    journalId: number
  ): Array<Pick<MessageEntity, "content" | "characterName" | "translation" | "audio" | "userId" | "journalId">> => {
    const result: Array<Pick<MessageEntity, "content" | "characterName" | "translation" | "audio" | "userId" | "journalId">> = [];

    for (const message of history) {
      if (message.role === "user") {
        const content = message.content.trim();
        if (!content) {
          continue;
        }

        result.push({
          content,
          characterName: "User",
          translation: null,
          audio: null,
          userId,
          journalId
        });
        continue;
      }

      if (message.role !== "assistant") {
        continue;
      }

      const turns = parseAssistantReply(message.content);
      if (!turns.length) {
        const fallback = message.content.trim();
        if (!fallback) {
          continue;
        }

        result.push({
          content: fallback,
          characterName: "Mimi",
          translation: null,
          audio: null,
          userId,
          journalId
        });
        continue;
      }

      for (const turn of turns) {
        const content = typeof turn.Text === "string" ? turn.Text.trim() : "";
        if (!content) {
          continue;
        }

        const characterName = typeof turn.CharacterName === "string" ? turn.CharacterName.trim() : "Mimi";
        const translation = typeof turn.Translation === "string" ? turn.Translation.trim() : "";

        result.push({
          content,
          characterName: characterName || "Mimi",
          translation: translation || null,
          audio: null,
          userId,
          journalId
        });
      }
    }

    return result;
  };

  const listJournals: JournalController["listJournals"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const journals = await journalRepository.find({
        where: { userId: request.user.id },
        order: { createdAt: "DESC" }
      });

      response.json({
        journals: journals.map((journal) => ({
          id: journal.id,
          summary: journal.summary,
          createdAt: journal.createdAt.toISOString()
        }))
      });
    } catch (error) {
      response.status(500).json({
        message: "Failed to load journals",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const getJournal: JournalController["getJournal"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const journalId = Number(request.params?.id);

    if (!Number.isInteger(journalId)) {
      response.status(400).json({ message: "Invalid journal id" });
      return;
    }

    try {
      const journal = await journalRepository.findOne({
        where: { id: journalId, userId: request.user.id }
      });

      if (!journal) {
        response.status(404).json({ message: "Journal not found" });
        return;
      }

      const messages = await messageRepository.find({
        where: { journalId: journal.id, userId: request.user.id },
        order: { id: "ASC" }
      });

      response.json({
        journal: {
          id: journal.id,
          summary: journal.summary,
          createdAt: journal.createdAt.toISOString()
        },
        messages: messages.map((message) => ({
          id: message.id,
          content: message.content,
          characterName: message.characterName,
          translation: message.translation,
          audio: message.audio,
          createdAt: message.createdAt.toISOString()
        }))
      });
    } catch (error) {
      response.status(500).json({
        message: "Failed to load journal",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  const endConversation: JournalController["endConversation"] = async (request, response) => {
    if (!request.user) {
      response.status(401).json({ message: "Unauthorized" });
      return;
    }

    const sessionId = getSessionId(request.body?.sessionId);

    if (!openAIService) {
      response.status(500).json({ message: "OpenAI API key is not configured" });
      return;
    }

    try {
      const history = await historyStore.load(request.user.id, sessionId);
      const hasConversation = history.some((message) => message.role === "user" || message.role === "assistant");

      if (!hasConversation) {
        response.status(400).json({ message: "No conversation history to summarize" });
        return;
      }

      const summaryInstruction = [
        "Conversation ended.",
        "Summarize what the conversation talked about.",
        "Return a JSON array with ONE object that includes CharacterName, Text, Tone, Translation.",
        "Put the Vietnamese summary in Translation.",
        "Keep Text in Korean.",
        "Tone can be \"neutral, medium pitch\".",
        "Return ONLY valid JSON."
      ].join("\n");

      const summaryReply = await openAIService.createReply("Please summarize the conversation.", [
        ...history,
        { role: "developer", content: summaryInstruction }
      ]);

      const summary = extractSummary(summaryReply.reply);

      const journal = journalRepository.create({
        summary,
        userId: request.user.id
      });

      const savedJournal = await journalRepository.save(journal);
      const messageEntities = buildMessageEntities(history, request.user.id, savedJournal.id);

      if (messageEntities.length) {
        await messageRepository.save(messageEntities.map((message) => messageRepository.create(message)));
      }

      await historyStore.clear(request.user.id, sessionId);

      response.json({
        journalId: savedJournal.id,
        summary: savedJournal.summary
      });
    } catch (error) {
      response.status(500).json({
        message: "Failed to finalize journal",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  return {
    listJournals,
    getJournal,
    endConversation
  };
};
