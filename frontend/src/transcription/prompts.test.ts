import { describe, it, expect } from "vitest";
import { TRANSCRIPTION_PROMPTS, getTranscriptionPrompt } from "./prompts";

describe("transcription prompts", () => {
  it("contain no domain-specific medical vocabulary", () => {
    const medical = /metformin|amlodipin|hemoglobin|hämoglobin|creatinin|kreatinin/i;
    for (const p of Object.values(TRANSCRIPTION_PROMPTS)) {
      expect(medical.test(p)).toBe(false);
    }
  });

  it("still instruct punctuation conversion and filler removal (en)", () => {
    const en = getTranscriptionPrompt("en");
    expect(en.toLowerCase()).toContain("punctuation");
    expect(en.toLowerCase()).toMatch(/filler/);
  });
});
