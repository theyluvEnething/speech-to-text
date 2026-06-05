import { getTokenCache } from "../token-cache";

export interface OpenAiEphemeralToken {
  client_secret: string;
  expires_at: number | null;
}

/**
 * Returns a valid OpenAI ephemeral token for realtime WebRTC authentication.
 *
 * Delegates to the unified TokenCache, which handles:
 *   - Proactive refresh before expiry (60s buffer)
 *   - Deduplication of concurrent requests
 *   - 401-powered invalidation (caller calls cache.invalidate("openai"))
 *
 * The master OPENAI_API_KEY never leaves the backend server.
 */
export async function getOpenAiEphemeralToken(): Promise<OpenAiEphemeralToken> {
  const token = await getTokenCache().get("openai");

  return {
    client_secret: token,
    expires_at: null,
  };
}
