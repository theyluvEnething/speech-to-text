import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPostProcessBody, extractContent, postProcessText } from "./post-process";

vi.mock("./token-cache", () => ({
  getTokenCache: () => ({ get: async () => "test-key", invalidate: () => {} }),
}));

afterEach(() => vi.restoreAllMocks());

describe("buildPostProcessBody", () => {
  it("sends enforcer + instruction + text as three messages", () => {
    const body = buildPostProcessBody("m", "INSTR", "TEXT");
    expect(body.model).toBe("m");
    expect(body.stream).toBe(false);
    expect(body.messages.map((x) => x.role)).toEqual(["system", "user", "user"]);
    expect(body.messages[1]!.content).toBe("INSTR");
    expect(body.messages[2]!.content).toBe("TEXT");
  });
});

describe("extractContent", () => {
  it("pulls the trimmed assistant message", () => {
    expect(extractContent({ choices: [{ message: { content: "  hi  " } }] })).toBe("hi");
  });
  it("returns null when missing", () => {
    expect(extractContent({})).toBeNull();
    expect(extractContent({ choices: [] })).toBeNull();
  });
});

describe("postProcessText", () => {
  it("returns transformed text on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: "DONE" } }] }),
      { status: 200 },
    )));
    expect(await postProcessText("raw", "instr")).toBe("DONE");
  });
  it("falls back to raw text on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await postProcessText("raw", "instr")).toBe("raw");
  });
  it("falls back to raw text when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("net"); }));
    expect(await postProcessText("raw", "instr")).toBe("raw");
  });
  it("returns input unchanged when text or instruction is empty", async () => {
    expect(await postProcessText("", "instr")).toBe("");
    expect(await postProcessText("raw", "")).toBe("raw");
  });
});
