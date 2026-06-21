import { getTokenCache } from "./token-cache";

/** Groq's OpenAI-compatible chat-completions endpoint. */
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Fast, high-quality Groq model for the rewrite. `openai/gpt-oss-120b` is
 * Groq's recommended replacement after llama-3.3-70b-versatile was deprecated
 * (2026-06-17). Verify current on console.groq.com if requests start failing.
 */
const POST_PROCESSING_MODEL = "openai/gpt-oss-120b";

const ENFORCER_PROMPT = [
  "You transform the user's dictated text according to the instruction that",
  "follows. Output ONLY the transformed result — no preamble, no explanations,",
  "no markdown code fences, no surrounding quotes. If the instruction asks for a",
  "specific output language, write the result in that language.",
].join(" ");

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatBody {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  stream: false;
}

/** Builds the chat-completions request body. Pure — no I/O. */
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
 * unchanged on any failure (network, auth, bad/empty response, timeout) so the
 * user's dictation is never lost.
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
    console.error(
      `[PostProcess] Failed to get Groq key: ${err instanceof Error ? err.message : String(err)}`,
    );
    return text;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildPostProcessBody(POST_PROCESSING_MODEL, instruction, text)),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(`[PostProcess] Groq error (${response.status}): ${body.slice(0, 300)}`);
      if (response.status === 401 || response.status === 403) {
        getTokenCache().invalidate("groq");
      }
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
      console.error(
        `[PostProcess] Request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return text;
  }
}
