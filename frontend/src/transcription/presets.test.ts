import { describe, it, expect } from "vitest";
import { PRESETS, getPreset } from "./presets";

describe("presets", () => {
  it("ships ai-prompt, email, and notes with non-empty instructions", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toEqual(["ai-prompt", "email", "notes"]);
    for (const p of PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.instruction.trim().length).toBeGreaterThan(20);
    }
  });

  it("email instruction encodes greeting, name, and language behavior", () => {
    const email = getPreset("email")!;
    expect(email.instruction).toMatch(/Dear/);
    expect(email.instruction.toLowerCase()).toContain("language");
  });

  it("ai-prompt outputs plain text and asks clarifying questions when vague", () => {
    const ai = getPreset("ai-prompt")!.instruction.toLowerCase();
    expect(ai).toMatch(/clarif|question/);
    expect(ai).toMatch(/markdown/);
    expect(ai).toMatch(/vague/);
  });

  it("getPreset returns undefined for unknown ids", () => {
    expect(getPreset("nope")).toBeUndefined();
  });
});
