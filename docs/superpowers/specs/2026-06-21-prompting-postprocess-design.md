# Prompting: per-profile transcription post-processing

**Status:** approved (2026-06-21) · **Branch:** `prompting`

## Goal

Let each Wavely profile optionally transform a raw dictation into a polished
output via a fast LLM. Speaking "flappy bird clone in python" under an
"AI Prompt" profile pastes a structured prompt; speaking rough thoughts under an
"Email" profile pastes a formatted email. The transformation is defined by an
editable instruction per profile, seeded from a preset.

## Two-stage pipeline

1. **Stage 1 — transcription accuracy (always on).** Whisper `prompt` parameter
   (`prompts.ts`) normalizes spoken punctuation, numbers/units, and removes
   fillers. Must be **de-medicalized** (drop hemoglobin/metformin term lists)
   so it doesn't bias a general-purpose tool.
2. **Stage 2 — transformation (per profile, optional).** After transcription, if
   the active profile has it enabled, the transcript is rewritten by a fast Groq
   model using the profile's instruction. On any failure, fall back to the raw
   transcript (never lose the user's words).

## Components

### Post-processor — `transcription/post-process.ts` (replaces `deepseek.ts`)
- `postProcessText(text, instruction): Promise<string>`.
- Calls Groq chat completions with the cached Groq key
  (`getTokenCache().get("groq")`). No new backend endpoint.
- Light enforcer: "Apply the instruction to the user's text. Output only the
  result — no commentary, no markdown fences, no preamble."
- Keep: 15s timeout, no streaming, low temperature, raw-text fallback on any
  error, 401 → invalidate cached token.
- Model: a fast, high-quality Groq model, pinned after checking Groq's current
  lineup at implementation time (70B-class for email/prompt quality).

### Presets — `transcription/presets.ts`
Data-driven `{ id, label, instruction }`. Ship three (instruction is editable
per profile once chosen):
- **AI Prompt** — rough idea → structured prompt: objective, requirements /
  constraints, definitions. Output only the prompt.
- **Email** — greeting (`Dear [Name],` with real name if spoken, else a fillable
  placeholder), "I hope you're well," body from dictation, sign-off. Honors an
  explicit language request (e.g. "write this in German" → whole email in
  German, instruction itself not echoed).
- **Notes** — rambling → organized bullets / short summary.

Language handling lives inside the preset instructions; no extra code path.

### Profile data model (reuse existing fields)
- `systemPrompt: string` → the editable instruction.
- `textProcessingEnabled: boolean` → on/off.
- add `presetId?: string` → remembers the chosen preset for UI highlighting.
- Picking a preset fills `systemPrompt` (then editable) and sets enabled = true;
  picking "Raw" sets enabled = false.

### UI — `views/ProfilesView.tsx`
Replace the lone "Text processing prompt" textarea with a preset picker
(Raw / AI Prompt / Email / Notes) above the editable instruction box.

## Removal (we chose Groq)
- Delete `transcription/deepseek.ts`, the `deepseek` entry in `token-cache.ts`
  (`TokenProvider`, `ENDPOINTS`, `METHOD`), and the `/api/get-deepseek-key`
  endpoint in `backend/index.js`.
- Repoint `main/index.ts` post-processing + pre-fetch from `deepseek` to `groq`.

## Testing
- Unit-test the preset registry (presets exist; instructions non-empty).
- Unit-test post-process response parsing + fallback with the Groq HTTP call
  mocked. No live API in tests.

## Out of scope (for now)
- Per-profile model override for post-processing (Groq model is global).
- A dedicated "Clean up" Stage-2 preset (Stage 1 already handles tidiness;
  users can write a custom instruction if they want it).

## Verification
`tsc --noEmit` clean (modulo pre-existing `clerk.ts`), `vitest run` green,
`electron-vite build` succeeds, and a manual run: Raw profile pastes the
transcript; AI Prompt / Email / Notes profiles paste transformed output;
failure (e.g. backend down) falls back to raw text.
