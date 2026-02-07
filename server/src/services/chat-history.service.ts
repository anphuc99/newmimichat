import fs from "fs/promises";
import path from "path";

export type ChatHistoryRole = "system" | "developer" | "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatHistoryRole;
  content: string;
}

export interface ChatHistoryStore {
  load: (userId: number, sessionId: string) => Promise<ChatHistoryMessage[]>;
  append: (userId: number, sessionId: string, messages: ChatHistoryMessage[]) => Promise<void>;
  ensureSystemMessage: (userId: number, sessionId: string, content: string) => Promise<void>;
  clear: (userId: number, sessionId: string) => Promise<void>;
}

const DEFAULT_DIR = path.join(process.cwd(), "data", "chat-history");

const sanitizeUserId = (userId: number) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid userId");
  }

  return String(userId);
};

const sanitizeSessionId = (sessionId: string) => {
  const trimmed = (sessionId ?? "").trim();

  if (!trimmed) {
    return "default";
  }

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    throw new Error("Invalid sessionId");
  }

  return trimmed;
};

const toHistoryPath = (dir: string, userId: number, sessionId: string) => {
  const safeUserId = sanitizeUserId(userId);
  const safeSessionId = sanitizeSessionId(sessionId);

  // Backwards-compat: keep the original path for the default session.
  if (safeSessionId === "default") {
    return path.join(dir, `${safeUserId}.history.txt`);
  }

  return path.join(dir, safeUserId, `${safeSessionId}.history.txt`);
};

const parseLine = (line: string): ChatHistoryMessage | null => {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as { role?: unknown; content?: unknown };

    if (
      (parsed.role !== "system" && parsed.role !== "developer" && parsed.role !== "user" && parsed.role !== "assistant") ||
      typeof parsed.content !== "string"
    ) {
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
  const load: ChatHistoryStore["load"] = async (userId, sessionId) => {
    const filePath = toHistoryPath(dir, userId, sessionId);

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

  const append: ChatHistoryStore["append"] = async (userId, sessionId, messages) => {
    if (!messages.length) {
      return;
    }

    const filePath = toHistoryPath(dir, userId, sessionId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const lines = messages
      .map((message) => ({ role: message.role, content: message.content }))
      .map((message) => JSON.stringify(message))
      .join("\n");

    await fs.appendFile(filePath, `${lines}\n`, "utf8");
  };

  /**
   * Ensures the session history starts with the system instruction.
   *
   * @param userId - Authenticated user id.
   * @param sessionId - Session id for the conversation.
   * @param content - System instruction text.
   */
  const ensureSystemMessage: ChatHistoryStore["ensureSystemMessage"] = async (
    userId,
    sessionId,
    content
  ) => {
    const filePath = toHistoryPath(dir, userId, sessionId);
    const systemContent = content.trim();

    if (!systemContent) {
      return;
    }

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const messages = raw
        .split(/\r?\n/g)
        .map(parseLine)
        .filter((value): value is ChatHistoryMessage => Boolean(value));

      if (messages.length && messages[0].role === "system" && messages[0].content === systemContent) {
        return;
      }

      const nextMessages = [{ role: "system", content: systemContent }, ...messages];
      const nextRaw = nextMessages.map((message) => JSON.stringify(message)).join("\n");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${nextRaw}\n`, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        const systemMessage = JSON.stringify({ role: "system", content: systemContent });
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `${systemMessage}\n`, "utf8");
        return;
      }

      throw error;
    }
  };

  /**
   * Clears the stored history for a user/session.
   *
   * @param userId - Authenticated user id.
   * @param sessionId - Session id for the conversation.
   */
  const clear: ChatHistoryStore["clear"] = async (userId, sessionId) => {
    const filePath = toHistoryPath(dir, userId, sessionId);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        return;
      }

      throw error;
    }
  };

  return {
    load,
    append,
    ensureSystemMessage,
    clear
  };
};
