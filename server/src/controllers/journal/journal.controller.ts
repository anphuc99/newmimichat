import type { Request, Response } from "express";
import type { DataSource } from "typeorm";
import JournalEntity from "../../models/journal.entity.js";
import MessageEntity from "../../models/message.entity.js";
import CharacterEntity from "../../models/character.entity.js";
import StoryEntity from "../../models/story.entity.js";
import { createOpenAIChatService, type OpenAIChatService } from "../../services/openai.service.js";
import { createChatHistoryStore, type ChatHistoryMessage, type ChatHistoryStore } from "../../services/chat-history.service.js";
import { buildAudioId } from "../../services/tts.service.js";

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
  MessageId?: string;
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
  const characterRepository = dataSource.getRepository(CharacterEntity);
  const storyRepository = dataSource.getRepository(StoryEntity);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const systemPromptPath = process.env.OPENAI_SYSTEM_PROMPT_PATH;
  const openAIService =
    deps.openAIService ?? (apiKey ? createOpenAIChatService({ apiKey, model, systemPromptPath }) : null);
  const historyStore = deps.historyStore ?? createChatHistoryStore();

  let hasLoggedAssistantReplyParseFailure = false;
  let hasLoggedStoryProgressUpdateFailure = false;

  const getSessionId = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const normalizeName = (value: string) => value.trim().toLowerCase();

  /**
   * Parses a numeric story id from user input.
   *
   * @param value - Input value from the request body.
   * @returns Story id or null when invalid.
   */
  const parseStoryId = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  };

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
      } catch (error) {
        if (!hasLoggedAssistantReplyParseFailure) {
          console.warn("Failed to parse assistant reply as JSON; attempting fallback extraction.", error);
          hasLoggedAssistantReplyParseFailure = true;
        }
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

  const parseAssistantEditNote = (content: string) => {
    const englishMatch = content.match(/^Assistant\s+message\s+edited:\s+([^\.\n]+)\./i);
    const vietnameseMatch = content.match(/^Chat\s+co\s+messageID\s+duoc\s+sua\s+thanh\s+([^\.\n]+)\./i);
    const idMatch = englishMatch ?? vietnameseMatch;

    if (!idMatch) {
      return null;
    }

    const messageId = idMatch[1].trim();
    if (!messageId) {
      return null;
    }

    const englishContentMatch = content.match(/New\s+content:\s*([\s\S]+)/i);
    const vietnameseContentMatch = content.match(/Noi\s+dung\s+moi:\s*([\s\S]+)/i);
    const contentMatch = englishContentMatch ?? vietnameseContentMatch;
    const updatedText = contentMatch ? contentMatch[1].trim() : "";
    if (!updatedText) {
      return null;
    }

    return { messageId, updatedText };
  };

  const applyAssistantEdits = (history: ChatHistoryMessage[]) => {
    const edits = new Map<string, string>();

    for (const message of history) {
      if (message.role !== "developer") {
        continue;
      }

      const edit = parseAssistantEditNote(message.content);
      if (edit) {
        edits.set(edit.messageId, edit.updatedText);
      }
    }

    if (!edits.size) {
      return history;
    }

    return history.map((message) => {
      if (message.role !== "assistant") {
        return message;
      }

      const turns = parseAssistantReply(message.content);
      if (!turns.length) {
        return message;
      }

      let didUpdate = false;
      const nextTurns = turns.map((turn) => {
        const turnId = typeof turn.MessageId === "string" ? turn.MessageId.trim() : "";
        const updatedText = turnId ? edits.get(turnId) : null;

        if (updatedText) {
          didUpdate = true;
          return { ...turn, Text: updatedText };
        }

        return turn;
      });

      if (!didUpdate) {
        return message;
      }

      return {
        ...message,
        content: JSON.stringify(nextTurns)
      };
    });
  };

  /**
   * Requests an updated story progress from OpenAI using the summary.
   *
   * @param story - Story entity to update.
   * @param summary - Vietnamese summary of the conversation.
   * @returns The updated progress text or null when unavailable.
   */
  const requestStoryProgressUpdate = async (story: StoryEntity, summary: string) => {
    const trimmedSummary = summary.trim();
    if (!trimmedSummary) {
      return null;
    }

    const systemInstruction = [
      "You are a story progress editor.",
      "Update the current story progress based on the latest conversation summary.",
      "Return updated story progress in Vietnamese only.",
      "Keep it concise (1-3 sentences).",
      "Return plain text only. No JSON, no labels."
    ].join("\n");

    const message = [
      `Story description: ${story.description.trim() || "(none)"}`,
      `Current progress: ${(story.currentProgress ?? "").trim() || "(none)"}`,
      `Conversation summary: ${trimmedSummary}`
    ].join("\n");

    const reply = await openAIService?.createReply(message, [
      { role: "system", content: systemInstruction }
    ]);

    const updatedProgress = reply?.reply?.trim() ?? "";
    return updatedProgress || null;
  };

  const buildMessageEntities = (
    history: ChatHistoryMessage[],
    userId: number,
    journalId: number,
    voiceByCharacter: Map<string, string>
  ): Array<Pick<MessageEntity, "content" | "characterName" | "translation" | "tone" | "audio" | "userId" | "journalId">> => {
    const result: Array<Pick<MessageEntity, "content" | "characterName" | "translation" | "tone" | "audio" | "userId" | "journalId">> = [];

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
          tone: null,
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
          tone: null,
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
        const tone = typeof turn.Tone === "string" ? turn.Tone.trim() : "";
        const voiceKey = normalizeName(characterName || "Mimi");
        const voiceName = voiceByCharacter.get(voiceKey) ?? "";
        const audio = tone ? buildAudioId(content, tone, voiceName || undefined) : null;

        result.push({
          content,
          characterName: characterName || "Mimi",
          translation: translation || null,
          tone: tone || null,
          audio,
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

    const rawStoryId = request.query?.storyId;
    const storyId = rawStoryId === undefined ? null : parseStoryId(rawStoryId);

    if (rawStoryId !== undefined && !storyId) {
      response.status(400).json({ message: "Invalid story id" });
      return;
    }

    try {
      const journals = await journalRepository.find({
        where: {
          userId: request.user.id,
          ...(storyId ? { storyId } : {})
        },
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
      console.error("Error in listJournals:", error);
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
          tone: message.tone,
          audio: message.audio,
          createdAt: message.createdAt.toISOString()
        }))
      });
    } catch (error) {
      console.error("Error in getJournal:", error);
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
    const storyId = parseStoryId(request.body?.storyId);

    if (!openAIService) {
      response.status(500).json({ message: "OpenAI API key is not configured" });
      return;
    }

    try {
      let story: StoryEntity | null = null;

      if (storyId) {
        story = await storyRepository.findOne({
          where: { id: storyId, userId: request.user.id }
        });

        if (!story) {
          response.status(404).json({ message: "Story not found" });
          return;
        }
      }

      const history = await historyStore.load(request.user.id, sessionId);
      const adjustedHistory = applyAssistantEdits(history);
      const hasConversation = adjustedHistory.some((message) => message.role === "user" || message.role === "assistant");

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
        ...adjustedHistory,
        { role: "developer", content: summaryInstruction }
      ]);

      const summary = extractSummary(summaryReply.reply);

      const journal = journalRepository.create({
        summary,
        userId: request.user.id,
        storyId: story?.id ?? null
      });

      const savedJournal = await journalRepository.save(journal);
      const characters = await characterRepository.find({ where: { userId: request.user.id } });
      const voiceByCharacter = new Map(
        characters
          .filter((character) => character.voiceName)
          .map((character) => [normalizeName(character.name), character.voiceName as string])
      );

      const messageEntities = buildMessageEntities(adjustedHistory, request.user.id, savedJournal.id, voiceByCharacter);

      if (messageEntities.length) {
        await messageRepository.save(messageEntities.map((message) => messageRepository.create(message)));
      }

      if (story) {
        try {
          const updatedProgress = await requestStoryProgressUpdate(story, summary);
          if (updatedProgress) {
            story.currentProgress = updatedProgress;
            await storyRepository.save(story);
          }
        } catch (error) {
          if (!hasLoggedStoryProgressUpdateFailure) {
            console.warn("Story progress update failed; continuing without updating story progress.", error);
            hasLoggedStoryProgressUpdateFailure = true;
          }
        }
      }

      await historyStore.clear(request.user.id, sessionId);

      response.json({
        journalId: savedJournal.id,
        summary: savedJournal.summary
      });
    } catch (error) {
      console.error("Error in endConversation:", error);
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
