# Prompting Post-Process Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each profile transform a dictation into a polished output (AI prompt / email / notes) via a fast Groq model, defined by an editable per-profile instruction seeded from a preset.

**Architecture:** Two stages. Stage 1 (always on) is the Whisper accuracy prompt, generalized/de-medicalized. Stage 2 (per profile, optional) rewrites the transcript through Groq chat-completions using the profile's instruction, falling back to the raw transcript on any failure. DeepSeek is removed; the existing Groq key path is reused (no backend changes beyond deleting the unused DeepSeek endpoint).

**Tech Stack:** TypeScript (Electron main + React renderer), Groq OpenAI-compatible REST API, vitest.

---

## File structure

- Create `frontend/src/transcription/presets.ts` — preset registry (pure data + lookup).
- Create `frontend/src/transcription/presets.test.ts` — registry tests.
- Create `frontend/src/transcription/post-process.ts` — Groq post-processor (replaces deepseek.ts).
- Create `frontend/src/transcription/post-process.test.ts` — pure-helper + fallback tests.
- Delete `frontend/src/transcription/deepseek.ts`.
- Modify `frontend/src/transcription/index.ts` — re-export from post-process; export presets.
- Modify `frontend/src/transcription/token-cache.ts` — drop `deepseek` from `TokenProvider`/`ENDPOINTS`/`METHOD`.
- Modify `frontend/src/transcription/prompts.ts` — de-medicalize.
- Modify `frontend/src/main/index.ts` — post-process import + pre-fetch use `groq`, not `deepseek`.
- Modify `backend/index.js` — remove `/api/get-deepseek-key`.
- Modify `frontend/src/main/ipc-handlers.ts` + `frontend/src/renderer/global.d.ts` — add `presetId?` to `Profile`.
- Modify `frontend/src/renderer/views/ProfilesView.tsx` — preset picker UI.

---

## Task 1: Preset registry

**Files:**
- Create: `frontend/src/transcription/presets.ts`
- Test: `frontend/src/transcription/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

  it("getPreset returns undefined for unknown ids", () => {
    expect(getPreset("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/transcription/presets.test.ts`
Expected: FAIL — cannot find module `./presets`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Built-in transformation presets. Each `instruction` seeds a profile's
 * editable post-processing instruction; the user can tweak it afterward.
 */
export interface Preset {
  id: string;
  label: string;
  instruction: string;
}

export const PRESETS: Preset[] = [
  {
    id: "ai-prompt",
    label: "AI Prompt",
    instruction: [
      "Rewrite the user's rough, spoken description into a clear, well-structured",
      "prompt for an AI assistant. Include an explicit objective, the key",
      "requirements and constraints, and definitions for any vague terms.",
      "Keep the user's intent exactly; do not invent features they did not ask",
      "for. Output only the finished prompt.",
    ].join(" "),
  },
  {
    id: "email",
    label: "Email",
    instruction: [
      "Turn the user's dictation into a polished email.",
      "Start with a greeting on its own line: if the user named a recipient, use",
      '"Dear <name>,"; otherwise use "Dear [Name]," as a fillable placeholder.',
      'Follow with a brief courtesy line such as "I hope you are well." Then the',
      "body conveying the user's message, and a suitable sign-off.",
      "If the user asks for a specific language (e.g. \"write this in German\"),",
      "write the ENTIRE email in that language and do not include that request",
      "in the output. Output only the email.",
    ].join(" "),
  },
  {
    id: "notes",
    label: "Notes",
    instruction: [
      "Reorganize the user's rambling dictation into clean, structured notes:",
      "concise bullet points grouped logically, with a short heading if helpful.",
      "Preserve all facts and intent; remove filler and repetition.",
      "Output only the notes.",
    ].join(" "),
  },
];

/** Returns the preset with the given id, or undefined. */
export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/transcription/presets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/transcription/presets.ts frontend/src/transcription/presets.test.ts
git commit -m "Add transformation preset registry"
```

---

## Task 2: Groq post-processor

**Files:**
- Create: `frontend/src/transcription/post-process.ts`
- Test: `frontend/src/transcription/post-process.test.ts`

Note: confirm the model id is current on Groq's console before relying on it; the plan pins `llama-3.3-70b-versatile` (fast, 70B-class, OpenAI-compatible chat completions).

- [ ] **Step 1: Write the failing test** (pure helpers + fallback; fetch is mocked)

```ts
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
    expect(body.messages[1].content).toBe("INSTR");
    expect(body.messages[2].content).toBe("TEXT");
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/transcription/post-process.test.ts`
Expected: FAIL — cannot find module `./post-process`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { getTokenCache } from "./token-cache";

/** Groq's OpenAI-compatible chat-completions endpoint. */
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Fast, high-quality Groq model for the rewrite. Verify current on console.groq.com. */
const POST_PROCESSING_MODEL = "llama-3.3-70b-versatile";

const ENFORCER_PROMPT = [
  "You transform the user's dictated text according to the instruction that",
  "follows. Output ONLY the transformed result — no preamble, no explanations,",
  "no markdown code fences, no surrounding quotes. If the instruction asks for a",
  "specific output language, write the result in that language.",
].join(" ");

interface ChatMessage { role: "system" | "user"; content: string; }
interface ChatBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  stream: false;
}

/** Builds the request body. Pure — no I/O. */
export function buildPostProcessBody(
  model: string,
  instruction: string,
  text: string,
): ChatBody {
  return {
    model,
    messages: [
      { role: "system", content: ENFORCER_PROMPT },
      { role: "user", content: instruction },
      { role: "user", content: text },
    ],
    temperature: 0.3,
    max_tokens: 2048,
    stream: false,
  };
}

/** Extracts the assistant message content, or null. Pure. */
export function extractContent(json: unknown): string | null {
  const data = json as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  return content ? content : null;
}

/**
 * Rewrites `text` per `instruction` using Groq. Returns the original `text`
 * unchanged on any failure (network, auth, bad/empty response, timeout).
 */
export async function postProcessText(
  text: string,
  instruction: string,
): Promise<string> {
  if (!text || !instruction) return text;

  let apiKey: string;
  try {
    apiKey = await getTokenCache().get("groq");
  } catch (err) {
    console.error(`[PostProcess] Failed to get Groq key: ${err instanceof Error ? err.message : String(err)}`);
    return text;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildPostProcessBody(POST_PROCESSING_MODEL, instruction, text)),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(`[PostProcess] Groq error (${response.status}): ${body.slice(0, 300)}`);
      if (response.status === 401 || response.status === 403) getTokenCache().invalidate("groq");
      return text;
    }

    const corrected = extractContent(await response.json());
    if (!corrected) {
      console.warn("[PostProcess] Empty response — falling back to raw text.");
      return text;
    }
    console.log(`[PostProcess] ${text.length}→${corrected.length} chars`);
    return corrected;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[PostProcess] Timed out — falling back to raw text.");
    } else {
      console.error(`[PostProcess] Request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return text;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/transcription/post-process.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/transcription/post-process.ts frontend/src/transcription/post-process.test.ts
git commit -m "Add Groq post-processor with raw-text fallback"
```

---

## Task 3: Remove DeepSeek; repoint to post-process

**Files:**
- Delete: `frontend/src/transcription/deepseek.ts`
- Modify: `frontend/src/transcription/index.ts` (line 36: `export { postProcessText } from "./deepseek";`)
- Modify: `frontend/src/transcription/token-cache.ts` (`TokenProvider`, `ENDPOINTS`, `METHOD`)
- Modify: `frontend/src/main/index.ts` (import on line ~11; pre-fetch block ~212-219)
- Modify: `backend/index.js` (delete the `/api/get-deepseek-key` handler block)

- [ ] **Step 1: Delete the module and repoint the re-export**

```bash
git rm frontend/src/transcription/deepseek.ts
```

In `frontend/src/transcription/index.ts`, change:
`export { postProcessText } from "./deepseek";`
to:
`export { postProcessText } from "./post-process";`

- [ ] **Step 2: Drop deepseek from the token cache**

In `frontend/src/transcription/token-cache.ts`:
- `export type TokenProvider = Exclude<ProviderName, "backend"> | "deepseek";` → `export type TokenProvider = Exclude<ProviderName, "backend">;`
- remove `deepseek: "/api/get-deepseek-key",` from `ENDPOINTS`
- remove `deepseek: "GET",` from `METHOD`

- [ ] **Step 3: Repoint main/index.ts**

In `frontend/src/main/index.ts`:
- import: `import { postProcessText } from "../transcription/deepseek";` → `from "../transcription/post-process";`
- In the pre-fetch block that calls `getTokenCache().get("deepseek")` for text processing, change `"deepseek"` to `"groq"` and update the log text from "DeepSeek" to "Groq post-process".

- [ ] **Step 4: Remove the backend endpoint**

In `backend/index.js`, delete the entire `PROVIDER 4: DeepSeek` block (the `app.get("/api/get-deepseek-key", ...)` handler and its comment header).

- [ ] **Step 5: Verify typecheck + tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: only the pre-existing `src/renderer/lib/clerk.ts` error; nothing referencing `deepseek`.
Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove DeepSeek; post-processing uses Groq"
```

---

## Task 4: De-medicalize Stage-1 transcription prompts

**Files:**
- Modify: `frontend/src/transcription/prompts.ts`
- Test: `frontend/src/transcription/prompts.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/transcription/prompts.test.ts`
Expected: FAIL — the medical-term assertion fails on current prompts.

- [ ] **Step 3: Edit prompts.ts**

For each language entry in `TRANSCRIPTION_PROMPTS`, remove the final "Terms: …"/"Begriffe: …"/equivalent line listing medical terms. Keep the punctuation-conversion, number/unit-normalization, filler-removal, and proper-noun lines. Update the file's top doc comment to drop the medical framing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/transcription/prompts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/transcription/prompts.ts frontend/src/transcription/prompts.test.ts
git commit -m "Generalize transcription prompts (drop medical bias)"
```

---

## Task 5: Add `presetId` to the Profile model

**Files:**
- Modify: `frontend/src/main/ipc-handlers.ts` (Profile interface ~line 7-16)
- Modify: `frontend/src/renderer/global.d.ts` (Profile interface ~line 4-13)

- [ ] **Step 1: Add the optional field in both Profile interfaces**

In `frontend/src/main/ipc-handlers.ts` and `frontend/src/renderer/global.d.ts`, add to `interface Profile` after `textProcessingEnabled: boolean;`:
```ts
  presetId?: string;
```
No default-profile changes needed (the field is optional).

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: only the pre-existing `clerk.ts` error.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/main/ipc-handlers.ts frontend/src/renderer/global.d.ts
git commit -m "Add presetId to Profile model"
```

---

## Task 6: Preset picker in the profile editor

**Files:**
- Modify: `frontend/src/renderer/views/ProfilesView.tsx` (the "Text processing prompt" block ~190-211; imports; EMPTY)

- [ ] **Step 1: Import presets and a chip row**

At the top, add: `import { PRESETS, getPreset } from "@/transcription/presets";` (verify the `@/` alias resolves to `src/renderer`; if transcription is outside that alias, use a relative import `../../transcription/presets`). Add `presetId: ""` to the `EMPTY` profile object.

- [ ] **Step 2: Replace the textarea block with picker + editable instruction**

Replace the existing `<div className="space-y-2">` that contains the "Text processing prompt" label + textarea with:
```tsx
<div className="space-y-2">
  <Label>Post-processing</Label>
  <div className="flex flex-wrap gap-1.5">
    {[{ id: "", label: "Raw" }, ...PRESETS].map((opt) => {
      const active = opt.id
        ? editing.presetId === opt.id
        : !editing.textProcessingEnabled;
      return (
        <button
          key={opt.id || "raw"}
          type="button"
          onClick={() =>
            setEditing((p) =>
              opt.id
                ? { ...p, presetId: opt.id, textProcessingEnabled: true, systemPrompt: getPreset(opt.id)!.instruction }
                : { ...p, presetId: "", textProcessingEnabled: false })
          }
          className={cn(
            "px-3 py-1.5 rounded-[9px] border text-[12.5px] font-semibold transition-colors",
            active ? "bg-acc-faint border-acc text-acc-strong"
                   : "bg-raised border-line text-ink-3 hover:bg-hover hover:text-ink",
          )}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
  <Textarea
    value={editing.systemPrompt}
    onChange={(e) => setEditing((p) => ({ ...p, systemPrompt: e.target.value }))}
    placeholder="Pick a preset above, then tweak the instruction the AI follows after transcription."
    rows={5}
    disabled={!editing.textProcessingEnabled}
    className={!editing.textProcessingEnabled ? "opacity-50" : ""}
  />
</div>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `cd frontend && npx tsc --noEmit && npx electron-vite build`
Expected: tsc only the pre-existing `clerk.ts` error; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/renderer/views/ProfilesView.tsx
git commit -m "Add preset picker to profile editor"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Full check**

Run: `cd frontend && npx tsc --noEmit && npx vitest run && npx electron-vite build`
Expected: tsc clean (modulo clerk.ts), all tests pass, build succeeds.

- [ ] **Step 2: Manual run (`npm run dev`)**
- Raw profile → speak → transcript pastes unchanged.
- AI Prompt profile → speak a rough idea → a structured prompt pastes.
- Email profile → speak rough thoughts incl. "write this in German" → a German email pastes with greeting + sign-off.
- Notes profile → speak rambling → bullet points paste.
- Simulate failure (stop backend) → raw transcript still pastes.

- [ ] **Step 3: Commit any fixes, then push**

```bash
git push origin prompting
```

---

## Self-review notes
- Spec coverage: Stage-1 de-medicalize (T4), Groq post-processor (T2), presets AI Prompt/Email/Notes (T1), profile model presetId (T5), UI picker (T6), DeepSeek removal incl. backend endpoint (T3). All covered.
- Language switching is handled inside preset instructions (T1) + enforcer (T2) — no separate code path.
- Fallback-to-raw verified in T2 tests and T7 manual step.
