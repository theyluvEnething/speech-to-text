import { getTokenCache } from "../token-cache";

export interface EphemeralToken {
  client_secret: string;
  expires_at: number | null;
}

/**
 * Returns a valid xAI ephemeral token for WebSocket authentication.
 *
 * Delegates to the unified TokenCache, which handles:
 *   - Proactive refresh before expiry (60s buffer)
 *   - Deduplication of concurrent requests
 *   - 401-powered invalidation (caller calls cache.invalidate("xai"))
 *
 * The master XAI_API_KEY never leaves the backend server.
 */
export async function getXaiEphemeralToken(): Promise<EphemeralToken> {
  const token = await getTokenCache().get("xai");

  // TokenCache returns the raw api_key string. The callers
  // (XaiProvider, etc.) wrap it in the EphemeralToken shape.
  return {
    client_secret: token,
    expires_at: null, // Callers don't need this — cache handles expiry
  };
}
