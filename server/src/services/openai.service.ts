import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYSTEM_PROMPT_PATH = path.join(__dirname, "..", "prompts", "chat.system.txt");

export interface OpenAIChatServiceConfig {
  apiKey: string;
  model: string;
  systemPromptPath?: string;
}

export interface OpenAIChatService {
  createReply: (
    message: string,
    history?: Array<{ role: "system" | "user" | "assistant"; content: string }>
  ) => Promise<{ reply: string; model: string }>;
}

/**
 * Creates a lightweight OpenAI chat service that loads system prompts from disk.
 *
 * @param config - OpenAI service configuration.
 * @returns OpenAI chat service helpers.
 */
export const createOpenAIChatService = (config: OpenAIChatServiceConfig): OpenAIChatService => {
  const client = new OpenAI({ apiKey: config.apiKey });
  const model = config.model;
  const systemPromptPath = config.systemPromptPath ?? DEFAULT_SYSTEM_PROMPT_PATH;
  let cachedPrompt: string | null = null;

  const loadSystemPrompt = async () => {
    if (cachedPrompt) {
      return cachedPrompt;
    }

    const contents = await fs.readFile(systemPromptPath, "utf8");
    cachedPrompt = contents.trim();
    return cachedPrompt;
  };

  const createReply: OpenAIChatService["createReply"] = async (message, history = []) => {
    const normalizedHistory = history
      .filter(
        (entry) =>
          entry && (entry.role === "system" || entry.role === "user" || entry.role === "assistant")
      )
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const hasSystemMessage = normalizedHistory.some((entry) => entry.role === "system");
    const systemPrompt = hasSystemMessage ? null : await loadSystemPrompt();
    const systemMessages = systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : [];

    const completion = await client.chat.completions.create({
      model,
      messages: [
        ...systemMessages,
        ...normalizedHistory,
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!reply) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      reply,
      model: completion.model ?? model
    };
  };

  return { createReply };
};
