import { describe, expect, it } from "vitest";
import { isGeminiModel, GEMINI_MODELS } from "../../../server/src/services/gemini.service";

describe("Gemini service", () => {
  describe("isGeminiModel", () => {
    it("returns true for supported Gemini models", () => {
      expect(isGeminiModel("gemini-2.5-flash")).toBe(true);
      expect(isGeminiModel("gemini-2.5-pro")).toBe(true);
      expect(isGeminiModel("gemini-3-flash-preview")).toBe(true);
      expect(isGeminiModel("gemini-3-pro-preview")).toBe(true);
    });

    it("returns false for OpenAI models", () => {
      expect(isGeminiModel("gpt-4o")).toBe(false);
      expect(isGeminiModel("gpt-4o-mini")).toBe(false);
      expect(isGeminiModel("gpt-4.1-mini")).toBe(false);
      expect(isGeminiModel("gpt-5")).toBe(false);
    });

    it("returns false for empty or unknown models", () => {
      expect(isGeminiModel("")).toBe(false);
      expect(isGeminiModel("unknown-model")).toBe(false);
      expect(isGeminiModel("gemini")).toBe(false);
    });
  });

  describe("GEMINI_MODELS", () => {
    it("contains all supported Gemini models", () => {
      expect(GEMINI_MODELS).toContain("gemini-2.5-flash");
      expect(GEMINI_MODELS).toContain("gemini-2.5-pro");
      expect(GEMINI_MODELS).toContain("gemini-3-flash-preview");
      expect(GEMINI_MODELS).toContain("gemini-3-pro-preview");
    });

    it("has exactly 4 models", () => {
      expect(GEMINI_MODELS.length).toBe(4);
    });
  });
});
