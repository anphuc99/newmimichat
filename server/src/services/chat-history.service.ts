import fs from "fs/promises";
import path from "path";

export type ChatHistoryRole = "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatHistoryRole;
  content: string;
}

export interface ChatHistoryStore {
  load: (userId: number) => Promise<ChatHistoryMessage[]>;
  append: (userId: number, messages: ChatHistoryMessage[]) => Promise<void>;
}

const DEFAULT_DIR = path.join(process.cwd(), "data", "chat-history");

const sanitizeUserId = (userId: number) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid userId");
  }

  return String(userId);
};

const toHistoryPath = (dir: string, userId: number) => {
  const safe = sanitizeUserId(userId);
  return path.join(dir, `${safe}.history.txt`);
};

const parseLine = (line: string): ChatHistoryMessage | null => {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as { role?: unknown; content?: unknown };

    if ((parsed.role !== "user" && parsed.role !== "assistant") || typeof parsed.content !== "string") {
      return null;
    }

    const content = parsed.content.trim();

    if (!content) {
      return null;
    }

    return { role: parsed.role, content };
  } catch {
    return null;
  }
};

/**
 * Creates a file-backed chat history store.
 *
 * History format: newline-delimited JSON objects written to a .txt file.
 * This keeps message ordering stable so the OpenAI prompt prefix is identical
 * across requests and server restarts (which helps prompt caching).
 *
 * @param dir - Directory to store history files in.
 * @returns A chat history store.
 */
export const createChatHistoryStore = (dir: string = process.env.CHAT_HISTORY_DIR ?? DEFAULT_DIR): ChatHistoryStore => {
  const load: ChatHistoryStore["load"] = async (userId) => {
    const filePath = toHistoryPath(dir, userId);

    try {
      const raw = await fs.readFile(filePath, "utf8");
      return raw
        .split(/\r?\n/g)
        .map(parseLine)
        .filter((value): value is ChatHistoryMessage => Boolean(value));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  };

  const append: ChatHistoryStore["append"] = async (userId, messages) => {
    if (!messages.length) {
      return;
    }

    const filePath = toHistoryPath(dir, userId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const lines = messages
      .map((message) => ({ role: message.role, content: message.content }))
      .map((message) => JSON.stringify(message))
      .join("\n");

    await fs.appendFile(filePath, `${lines}\n`, "utf8");
  };

  return {
    load,
    append
  };
};
