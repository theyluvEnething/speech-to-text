import { describe, it, expect } from "vitest";
import { GENERAL_PROMPTS, MEDICAL_PROMPTS, getTranscriptionPrompt } from "./prompts";

describe("general prompts", () => {
  it("contain no domain-specific medical vocabulary", () => {
    const medical = /metformin|amlodipin|hemoglobin|troponin|creatinin/i;
    for (const p of Object.values(GENERAL_PROMPTS)) {
      expect(medical.test(p)).toBe(false);
    }
  });

  it("still instruct punctuation conversion and filler removal (en)", () => {
    const en = getTranscriptionPrompt("en");
    expect(en.toLowerCase()).toContain("punctuation");
    expect(en.toLowerCase()).toMatch(/filler/);
  });
});

describe("medical prompts", () => {
  it("are the general primer plus the medical vocabulary block", () => {
    for (const lang of Object.keys(GENERAL_PROMPTS)) {
      expect(MEDICAL_PROMPTS[lang]!.startsWith(GENERAL_PROMPTS[lang]!)).toBe(true);
      expect(MEDICAL_PROMPTS[lang]!).toMatch(/metformin/);
      expect(MEDICAL_PROMPTS[lang]!).toMatch(/troponin/);
    }
  });

  it("place the vocabulary at the end (highest-weight position)", () => {
    const en = MEDICAL_PROMPTS["en"]!;
    expect(en.lastIndexOf("metformin")).toBeGreaterThan(en.length / 2);
  });
});

describe("getTranscriptionPrompt", () => {
  it("returns the requested variant", () => {
    expect(getTranscriptionPrompt("en", "general")).not.toMatch(/metformin/);
    expect(getTranscriptionPrompt("en", "medical")).toMatch(/metformin/);
  });

  it("falls back to English for auto and unknown languages", () => {
    expect(getTranscriptionPrompt("auto")).toBe(GENERAL_PROMPTS["en"]);
    expect(getTranscriptionPrompt("xx", "medical")).toBe(MEDICAL_PROMPTS["en"]);
  });
});
