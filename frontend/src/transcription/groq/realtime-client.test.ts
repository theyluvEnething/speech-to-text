import { describe, it, expect } from "vitest";

function extractTranscriptFromResponse(response: any): string | null {
  if (response.type !== "response.done") return null;
  if (!response.response?.output) return null;

  for (const item of response.response.output) {
    if (item.role === "assistant" && item.content) {
      for (const part of item.content) {
        if (part.type === "text" && part.text) {
          return part.text;
        }
      }
    }
  }
  return null;
}

describe("extractTranscriptFromResponse", () => {
  it("extracts text from response.done with assistant text", () => {
    const event = {
      type: "response.done",
      response: {
        output: [
          { role: "assistant", content: [{ type: "text", text: "Hello world" }] },
        ],
      },
    };
    expect(extractTranscriptFromResponse(event)).toBe("Hello world");
  });

  it("returns null for non-response.done events", () => {
    expect(extractTranscriptFromResponse({ type: "session.created" })).toBeNull();
  });

  it("returns null when no assistant output", () => {
    expect(
      extractTranscriptFromResponse({
        type: "response.done",
        response: { output: [] },
      }),
    ).toBeNull();
  });

  it("handles multiple output items", () => {
    const event = {
      type: "response.done",
      response: {
        output: [
          { role: "user", content: [{ type: "input_audio" }] },
          { role: "assistant", content: [{ type: "text", text: "Transcript here" }] },
        ],
      },
    };
    expect(extractTranscriptFromResponse(event)).toBe("Transcript here");
  });

  it("returns null for audio-only assistant response", () => {
    const event = {
      type: "response.done",
      response: {
        output: [{ role: "assistant", content: [{ type: "audio" }] }],
      },
    };
    expect(extractTranscriptFromResponse(event)).toBeNull();
  });
});
