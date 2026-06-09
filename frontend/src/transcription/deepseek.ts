import { getTokenCache } from "./token-cache";

/**
 * DeepSeek API base URL. Compatible with OpenAI SDK format.
 * @see https://api-docs.deepseek.com/
 */
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * Model used for post-processing. deepseek-v4-flash is the fastest and
 * cheapest model — ideal for text correction with minimal latency.
 */
const POST_PROCESSING_MODEL = "deepseek-v4-flash";

/**
 * Strict system prompt that forces the model to output ONLY corrected text
 * with zero conversational filler. This prompt is sent in English regardless
 * of the text language — the user prompt and correction instructions
 * (systemPrompt from profile) provide the language context.
 */
const ENFORCER_PROMPT = [
  "You are a text correction engine. Your ONLY job is to output the corrected",
  "version of the provided text, following the correction instructions below.",
  "",
  "CRITICAL OUTPUT RULES — you MUST follow these exactly:",
  "1. Output ONLY the corrected text. Nothing else.",
  "2. No greetings, no explanations, no questions, no commentary.",
  '3. No prefixes like "Corrected:" or "Here is the corrected text:".',
  "4. No quotation marks around the output.",
  "5. Do not add any sentences. Do not remove any sentences.",
  "6. If no correction is needed, output the input exactly as-is.",
  "7. Do NOT end with a newline unless the original text ends with one.",
  "",
  "The user will provide correction instructions followed by the text to",
  "correct. Respond with the raw corrected text and nothing else.",
].join("\n");

/**
 * Post-process transcribed text through DeepSeek using the profile's
 * system prompt as correction instructions.
 *
 * Optimized for speed:
 *   - deepseek-v4-flash (fastest model)
 *   - temperature: 0 (deterministic, no sampling overhead)
 *   - max_tokens capped to prevent runaway generation
 *   - No streaming (adds latency for short corrections)
 *   - No thinking/reasoning (not needed for text correction)
 *
 * On ANY failure (network, auth, bad response, empty output), returns
 * the original text unchanged — the user's transcription is never lost.
 *
 * @param text - Raw transcribed text to correct
 * @param correctionPrompt - Profile's systemPrompt with language-specific
 *   correction instructions (e.g. "Correct this German text, fix English
 *   words that should be German, etc.")
 * @returns Corrected text, or the original text on any failure
 */
export async function postProcessText(
  text: string,
  correctionPrompt: string,
): Promise<string> {
  if (!text || !correctionPrompt) return text;

  console.log(
    `[DeepSeek] Post-processing ${text.length} chars of text...`,
  );

  let apiKey: string;
  try {
    apiKey = await getTokenCache().get("deepseek");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[DeepSeek] Failed to get API key: ${msg}`);
    return text; // Fall back to raw text
  }

  try {
    // 15-second timeout — post-processing should complete in under 2s.
    // If it takes longer, something is wrong; fall back to raw text.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(
      `${DEEPSEEK_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: POST_PROCESSING_MODEL,
          messages: [
            { role: "system", content: ENFORCER_PROMPT },
            { role: "user", content: correctionPrompt },
            { role: "user", content: text },
          ],
          temperature: 0,
          max_tokens: Math.min(Math.ceil(text.length * 1.5), 4096),
          stream: false,
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "(unreadable)");
      console.error(
        `[DeepSeek] API error (${response.status}): ${errorBody.slice(0, 300)}`,
      );
      // On auth errors, invalidate the cached token so the next call
      // fetches a fresh one.
      if (response.status === 401 || response.status === 403) {
        getTokenCache().invalidate("deepseek");
      }
      return text; // Fall back to raw text
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const corrected = data.choices?.[0]?.message?.content?.trim();

    if (!corrected) {
      console.warn(
        "[DeepSeek] Empty response from API — falling back to raw text.",
      );
      return text;
    }

    console.log(
      `[DeepSeek] Post-processing complete — ${text.length}→${corrected.length} chars`,
    );
    return corrected;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[DeepSeek] Request timed out — falling back to raw text.");
    } else {
      console.error(`[DeepSeek] Request failed: ${msg}`);
    }
    return text; // Fall back to raw text
  }
}
