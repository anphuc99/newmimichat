export interface ChatPromptLevelConfig {
  maxWords: number;
  guideline: string;
}

export interface ChatPromptCharacter {
  name: string;
  gender?: "male" | "female";
  personality?: string | null;
  appearance?: string | null;
}

export interface ChatPromptParams {
  /**
   * CEFR level label (A0-C2). Unknown levels fall back to A1.
   */
  level?: string | null;
  /**
    * Optional guideline coming from the database.
    * Note: today this is stored in the `levels.descript` column.
   */
    levelGuideline?: string | null;
    /**
    * Optional per-level max word limit coming from the database.
    */
    levelMaxWords?: number | null;
  /**
   * Characters available to the user. When omitted/empty, character rules are skipped.
   */
  characters?: ChatPromptCharacter[];
  /**
   * Optional scene/context description. If missing, we default to a generic chat setting.
   */
  context?: string | null;
  /**
   * Optional plot reminder.
   */
  storyPlot?: string | null;
  /**
   * Optional relationship summary.
   */
  relationshipSummary?: string | null;
  /**
   * Optional prior summary.
   */
  contextSummary?: string | null;
  /**
   * Optional related story transcript (previous episodes).
   */
  relatedStoryMessages?: string | null;
  /**
   * Optional pronunciation-check mode. If true, ask the user short clarifying questions.
   */
  checkPronunciation?: boolean;
}

const LEVEL_CONFIG: Record<string, ChatPromptLevelConfig> = {
  A0: {
    maxWords: 3,
    guideline: "Use only simple present tense. Avoid any complex grammar."
  },
  A1: {
    maxWords: 5,
    guideline: "Use simple sentences. Present tense and basic past. Allowed patterns: -고 싶다, -아/어요."
  },
  A2: {
    maxWords: 7,
    guideline: "Basic A2 compound structures are allowed: -고, -지만, -아서/-어서, -(으)면, -(으)려고. Avoid intermediate-level grammar."
  },
  B1: {
    maxWords: 10,
    guideline:
      "Use lower-intermediate (B1) grammar. Keep sentences not too long. Allowed patterns: -(으)ㄹ 수 있다, -아/어서, -(으)니까, -기 때문에, -(으)면, -는데, -(으)려고 하다, -(으)면서, -(으)ㄴ/는 것 같다, -아/어도 되다, -아/어야 하다. Avoid B2+ grammar."
  },
  B2: {
    maxWords: 12,
    guideline: "Use advanced grammar. Express opinions and more abstract ideas, but keep replies concise."
  },
  C1: {
    maxWords: 15,
    guideline: "Use advanced grammar, idiomatic expressions, and nuanced language while staying concise."
  },
  C2: {
    maxWords: 20,
    guideline: "Use natural, native-like language. Keep replies concise and helpful for learning."
  }
};

const normalizeLevel = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim().toUpperCase();
  return trimmed && trimmed in LEVEL_CONFIG ? trimmed : "A1";
};

const buildCharacterSection = (characters: ChatPromptCharacter[]) => {
  const validNames = characters.map((character) => `- ${character.name}`).join("\n");

  const details = characters
    .map((character) => {
      const gender = character.gender ? `Gender: ${character.gender}` : null;
      const personality = character.personality?.trim() ? `Personality: ${character.personality.trim()}` : null;
      const appearance = character.appearance?.trim() ? `Appearance: ${character.appearance.trim()}` : null;
      const lines = [gender, personality, appearance].filter(Boolean);

      return [`Name: ${character.name}`, ...lines].join("\n");
    })
    .join("\n\n");

  return { validNames, details };
};

/**
 * Builds a system instruction string inspired by the legacy `initChat()` prompt.
 *
 * Important: this project currently expects plain-text assistant replies (not JSON arrays).
 * So we keep the same *rules + context structure*, but we do not enforce the old JSON schema.
 *
 * Any optional field that is missing/empty is skipped ("cái nào chưa có bỏ qua").
 */
export const buildChatSystemPrompt = (params: ChatPromptParams): string => {
  const level = normalizeLevel(params.level);
  const levelCfg = LEVEL_CONFIG[level];
  const dbMaxWords = typeof params.levelMaxWords === "number" ? params.levelMaxWords : null;
  const maxWords = Number.isFinite(dbMaxWords) && (dbMaxWords as number) > 0 ? (dbMaxWords as number) : levelCfg.maxWords;
  const dbGuideline = (params.levelGuideline ?? "").trim();
  const guideline = dbGuideline || levelCfg.guideline;
  const context = params.context?.trim() ? params.context.trim() : "A casual Korean practice chat between the user and the assistant.";

  const characters = (params.characters ?? []).filter((character) => character.name?.trim());
  const characterSection = characters.length ? buildCharacterSection(characters) : null;

  const maybe = (label: string, value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed) {
      return "";
    }
    return `\n${label}:\n${trimmed}\n`;
  };

  const levelGuidelineBlock = dbGuideline ? `\nLevel guideline (DB):\n${dbGuideline}\n` : "";

  const relatedStoryMessages = (params.relatedStoryMessages ?? "").trim();
  const relatedStoryBlock = relatedStoryMessages
    ? `\n====================================\nRELATED STORY REFERENCE\n====================================\nThe following transcript is from related story episodes. Use it as context reference only.\n\n${relatedStoryMessages}\n`
    : "";

  const pronunciationBlock = params.checkPronunciation
    ? `\n====================================\nPRONUNCIATION CHECK\n====================================\n- If the user asks for pronunciation help, reply with a short correction and a short example sentence at the current level.\n- Ask one short clarifying question if the user intent is unclear.\n`
    : "";

  const characterRules = characterSection
    ? `\n====================================\nCHARACTERS (VALID NAMES ONLY)\n====================================\n${characterSection.validNames}\n\nCHARACTER DETAILS:\n${characterSection.details}\n\nRules:\n- NEVER invent characters.\n- If you role-play, only use one of the valid names above and keep the same personality.\n`
    : "";

  return `YOU ARE A CONVERSATION PARTNER FOR KOREAN LEARNERS.

====================================
ABSOLUTE RULES (SYSTEM CRITICAL)
====================================
1. Reply in Korean.
2. Keep replies short and friendly.
3. Max ${maxWords} Korean words per sentence when possible.
4. Avoid numerals; write numbers in Korean words.

====================================
LANGUAGE LEVEL: ${level}
====================================
${levelCfg.guideline}
${levelGuidelineBlock}

====================================
SCENE / CONTEXT
====================================
${context}
${maybe("STORY PLOT", params.storyPlot)}${maybe("RELATIONSHIPS", params.relationshipSummary)}${maybe("PREVIOUS SUMMARY", params.contextSummary)}${relatedStoryBlock}${characterRules}${pronunciationBlock}
====================================
DIALOGUE RULES
====================================
- Prefer 1-3 short sentences per reply.
- If the user mixes Vietnamese/Korean, still respond in Korean.
- If the user asks for translation/explanation, keep it short and at the same level.

====================================
FINAL CHECK
====================================
Silently verify all ABSOLUTE RULES before responding.`;
};
