import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SYSTEM_PROMPT_PATH = path.join(__dirname, "..", "prompts", "chat.system.txt");

export interface OpenAIChatServiceConfig {
  apiKey: string;
  model: string;
  systemPromptPath?: string;
  /**
   * Optional path to a PEM/CRT file containing additional CA certificates.
   * Useful in corporate environments where TLS is intercepted by a proxy.
   */
  tlsCaCertPath?: string;
  /**
   * Optional base64-encoded PEM/CRT content for additional CA certificates.
   * Takes precedence over {@link tlsCaCertPath} when provided.
   */
  tlsCaCertBase64?: string;
  /**
   * When true, disables TLS certificate verification for OpenAI requests.
   * This is insecure and should only be used for local debugging.
   */
  tlsAllowInsecure?: boolean;
}

export interface OpenAIClientTlsOptions {
  /**
   * Optional path to a PEM/CRT file containing additional CA certificates.
   * Useful in corporate environments where TLS is intercepted by a proxy.
   */
  tlsCaCertPath?: string;
  /**
   * Optional base64-encoded PEM/CRT content for additional CA certificates.
   * Takes precedence over {@link tlsCaCertPath} when provided.
   */
  tlsCaCertBase64?: string;
  /**
   * When true, disables TLS certificate verification for OpenAI requests.
   * This is insecure and should only be used for local debugging.
   */
  tlsAllowInsecure?: boolean;
}

/**
 * Parses common boolean-like environment values.
 *
 * @param value - Env var string.
 * @returns true/false when parseable, otherwise null.
 */
const parseEnvBool = (value: string | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

/**
 * Detects whether the server is running in local dev mode.
 *
 * This project uses `npm run dev` which sets `npm_lifecycle_event=dev`.
 * We also treat `NODE_ENV=development` as dev.
 */
const isDevMode = () => {
  const nodeEnv = String(process.env.NODE_ENV ?? "").trim().toLowerCase();
  const lifecycle = String(process.env.npm_lifecycle_event ?? "").trim().toLowerCase();
  return nodeEnv === "development" || lifecycle === "dev";
};

/**
 * Builds an HTTPS agent for the OpenAI SDK with optional custom CA bundle.
 *
 * This is primarily to fix errors like:
 * `SELF_SIGNED_CERT_IN_CHAIN` when a corporate proxy injects a custom root CA.
 *
 * @param config - OpenAI configuration.
 * @returns An HTTPS agent or undefined if no TLS overrides are configured.
 */
const buildOpenAIHttpAgent = (config: {
  tlsCaCertPath?: string;
  tlsCaCertBase64?: string;
  tlsAllowInsecure?: boolean;
}) => {
  const caFromBase64 = typeof config.tlsCaCertBase64 === "string" ? config.tlsCaCertBase64.trim() : "";
  const caFromPath = typeof config.tlsCaCertPath === "string" ? config.tlsCaCertPath.trim() : "";

  const resolvedCa = (() => {
    if (caFromBase64) {
      try {
        return Buffer.from(caFromBase64, "base64").toString("utf8");
      } catch (error) {
        console.error("Failed to decode OPENAI_TLS_CA_CERT_BASE64.", error);
        throw new Error("OPENAI_TLS_CA_CERT_BASE64 is not valid base64");
      }
    }

    if (caFromPath) {
      const resolvedPath = path.isAbsolute(caFromPath) ? caFromPath : path.resolve(process.cwd(), caFromPath);
      if (!fsSync.existsSync(resolvedPath)) {
        throw new Error(`OPENAI_TLS_CA_CERT_PATH not found: ${resolvedPath}`);
      }
      return fsSync.readFileSync(resolvedPath, "utf8");
    }

    return "";
  })();

  const allowInsecure = Boolean(config.tlsAllowInsecure);

  if (!allowInsecure && !resolvedCa) {
    return undefined;
  }

  return new https.Agent({
    keepAlive: true,
    rejectUnauthorized: !allowInsecure,
    ...(resolvedCa ? { ca: resolvedCa } : {})
  });
};

/**
 * Creates an OpenAI SDK client configured for corporate proxy TLS interception.
 *
 * Uses env:
 * - `OPENAI_TLS_INSECURE` (boolean-ish)
 * - `OPENAI_TLS_CA_CERT_PATH`
 * - `OPENAI_TLS_CA_CERT_BASE64`
 *
 * Default behavior:
 * - SSL verification is skipped in dev mode (`npm run dev` or `NODE_ENV=development`)
 * - SSL verification remains enabled otherwise
 *
 * @param apiKey - OpenAI API key.
 * @param options - Optional TLS overrides.
 * @returns A configured OpenAI client.
 */
export const createOpenAIClient = (apiKey: string, options: OpenAIClientTlsOptions = {}) => {
  const envInsecure = parseEnvBool(process.env.OPENAI_TLS_INSECURE);
  const tlsAllowInsecure = options.tlsAllowInsecure ?? envInsecure ?? isDevMode();

  const tlsCaCertPath = options.tlsCaCertPath ?? process.env.OPENAI_TLS_CA_CERT_PATH;
  const tlsCaCertBase64 = options.tlsCaCertBase64 ?? process.env.OPENAI_TLS_CA_CERT_BASE64;

  const httpAgent = buildOpenAIHttpAgent({
    tlsAllowInsecure,
    tlsCaCertPath,
    tlsCaCertBase64
  });

  return new OpenAI({ apiKey, ...(httpAgent ? { httpAgent } : {}) });
};

export interface OpenAIChatService {
  createReply: (
    message: string,
    history?: Array<{ role: "system" | "developer" | "user" | "assistant"; content: string }>,
    modelOverride?: string
  ) => Promise<{ reply: string; model: string }>;
}

/**
 * Creates a lightweight OpenAI chat service that loads system prompts from disk.
 *
 * @param config - OpenAI service configuration.
 * @returns OpenAI chat service helpers.
 */
export const createOpenAIChatService = (config: OpenAIChatServiceConfig): OpenAIChatService => {
  const client = createOpenAIClient(config.apiKey, {
    tlsAllowInsecure: config.tlsAllowInsecure,
    tlsCaCertPath: config.tlsCaCertPath,
    tlsCaCertBase64: config.tlsCaCertBase64
  });
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

  const createReply: OpenAIChatService["createReply"] = async (message, history = [], modelOverride) => {
    const normalizedHistory = history
      .filter(
        (entry) =>
          entry && (entry.role === "system" || entry.role === "developer" || entry.role === "user" || entry.role === "assistant")
      )
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const hasSystemMessage = normalizedHistory.find((entry) => entry.role === "system");
    const systemPrompt = hasSystemMessage ? hasSystemMessage.content : await loadSystemPrompt();
      console.log("System Prompt:", systemPrompt);
    const messages = normalizedHistory.map((entry) => {
      return { role: entry.role as "developer" | "user" | "assistant", content: entry.content };
    });

    const resolvedModel = modelOverride?.trim() || model;

    const response = await client.responses.create({
      model: resolvedModel,
      instructions: systemPrompt,
      input: [
        ...messages,
        { role: "user", content: message }
      ]
    });

    const reply = response.output_text?.trim() ?? "";

    if (!reply) {
      throw new Error("OpenAI returned an empty response");
    }

    return {
      reply,
      model: response.model ?? resolvedModel
    };
  };

  return { createReply };
};
