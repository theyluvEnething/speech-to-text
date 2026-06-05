import type { ProviderName } from "./types";
import { BACKEND_BASE_URL } from "./config";
import { getBackendSecret } from "./env";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** Shape returned by ALL backend key endpoints: `{ api_key, expires_at }`. */
export interface TokenResponse {
  api_key: string;
  expires_at: number; // Unix seconds
}

interface CacheEntry {
  token: string;
  expiresAtMs: number; // Date.now()-compatible milliseconds
}

/** How long before expiry to proactively refresh. */
const REFRESH_BUFFER_MS = 60_000; // 60 seconds

/** Maps provider → backend endpoint path. */
const ENDPOINTS: Record<Exclude<ProviderName, "backend">, string> = {
  deepgram: "/api/get-deepgram-key",
  groq: "/api/get-groq-key",
  openai: "/api/openai-client-secret",
  xai: "/api/xai-client-secret",
};

/** Whether the endpoint uses GET (Deepgram, Groq) or POST (OpenAI, xAI). */
const METHOD: Record<Exclude<ProviderName, "backend">, "GET" | "POST"> = {
  deepgram: "GET",
  groq: "GET",
  openai: "POST",
  xai: "POST",
};

// ═══════════════════════════════════════════════════════════════════════════
// Token Cache
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Unified token cache for all transcription providers.
 *
 * Behaviour:
 *   - `get()` returns a valid token, fetching from the backend if necessary.
 *   - Tokens are proactively refreshed when within REFRESH_BUFFER_MS of expiry.
 *   - A 401 from the provider's API should call `invalidate()` to force a
 *     refresh on the next `get()`.
 *   - Concurrent callers for the same provider share a single in-flight fetch —
 *     no duplicate backend requests.
 *
 * Usage:
 *   ```ts
 *   const cache = getTokenCache();
 *   const key = await cache.get("groq");  // cached or freshly fetched
 *   // ... use key ...
 *   // On 401:
 *   cache.invalidate("groq");
 *   ```
 */
class TokenCache {
  private store = new Map<ProviderName, CacheEntry>();

  /** In-flight fetches keyed by provider — prevents thundering herd. */
  private pending = new Map<ProviderName, Promise<TokenResponse>>();

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Returns a valid API key for `provider`.
   *
   * If a cached token exists and is not within the refresh buffer, it is
   * returned immediately (synchronous hit). Otherwise a backend fetch is
   * initiated and awaited.
   */
  async get(provider: Exclude<ProviderName, "backend">): Promise<string> {
    const cached = this.store.get(provider);

    // Fast path — token is still fresh
    if (cached && Date.now() < cached.expiresAtMs - REFRESH_BUFFER_MS) {
      const remaining = Math.round((cached.expiresAtMs - Date.now()) / 1000);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — REUSING cached key ` +
        `(valid for ${minutes}m ${seconds}s more)`,
      );
      return cached.token;
    }

    // Token missing, expired, or within refresh window
    if (cached) {
      const overdue = Math.round((Date.now() - cached.expiresAtMs) / 1000);
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — key ${overdue > 0 ? `EXPIRED ${overdue}s ago` : "about to expire"}, fetching new one...`,
      );
    } else {
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — no key in cache, fetching from backend...`,
      );
    }

    const fresh = await this.fetch(provider);
    this.store.set(provider, {
      token: fresh.api_key,
      expiresAtMs: fresh.expires_at * 1000,
    });

    const lifetime = Math.round((fresh.expires_at * 1000 - Date.now()) / 1000);
    const minutes = Math.floor(lifetime / 60);
    const seconds = lifetime % 60;
    console.log(
      `[TokenCache] ${provider.toUpperCase()} — KEY STORED ` +
      `(prefix: ${fresh.api_key.slice(0, 12)}..., ` +
      `TTL: ${minutes}m ${seconds}s, ` +
      `expires: ${new Date(fresh.expires_at * 1000).toLocaleTimeString()})`,
    );

    return fresh.api_key;
  }

  /**
   * Force-remove a cached token.
   *
   * Call this when the provider returns a 401 — the current token is
   * invalid (e.g. revoked early) and must be replaced.
   */
  invalidate(provider: ProviderName): void {
    const existed = this.store.delete(provider);
    if (existed) {
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — KEY INVALIDATED (401/unauthorized), ` +
        `will fetch fresh token on next request`,
      );
    } else {
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — invalidate() called but no key was cached`,
      );
    }
  }

  /** Drop ALL cached tokens and pending fetches. Useful for testing. */
  reset(): void {
    this.store.clear();
    this.pending.clear();
    console.log("[TokenCache] Full reset — all caches cleared.");
  }

  // ── Internal ────────────────────────────────────────────────────────

  /**
   * Calls the Wavely backend for a fresh token.
   *
   * Deduplicates concurrent requests: if two callers ask for the same
   * provider simultaneously, only one backend call is made and both
   * callers get the same result.
   */
  private async fetch(
    provider: Exclude<ProviderName, "backend">,
  ): Promise<TokenResponse> {
    // Deduplicate in-flight requests
    const existing = this.pending.get(provider);
    if (existing) {
      console.log(
        `[TokenCache] ${provider.toUpperCase()} — another caller already fetching, waiting...`,
      );
      return existing;
    }

    const url = `${BACKEND_BASE_URL}${ENDPOINTS[provider]}`;
    const method = METHOD[provider];
    const secret = getBackendSecret();

    console.log(
      `[TokenCache] ${provider.toUpperCase()} — REQUESTING key from backend ` +
      `(${method} ${url})`,
    );

    const promise = (async (): Promise<TokenResponse> => {
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": secret,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[TokenCache] ${provider.toUpperCase()} — BACKEND UNREACHABLE: ${msg}`,
        );
        throw new Error(
          `Cannot reach Wavely backend at ${url}: ${msg}`,
        );
      }

      console.log(
        `[TokenCache] ${provider.toUpperCase()} — backend responded HTTP ${response.status} ` +
        `(${response.ok ? "OK" : "ERROR"})`,
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "(unreadable)");
        throw new Error(
          `Backend returned ${response.status} for ${provider} token: ${body}`,
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error(
          `Backend returned invalid JSON for ${provider} token`,
        );
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("api_key" in data) ||
        !("expires_at" in data)
      ) {
        throw new Error(
          `Backend response for ${provider} missing api_key or expires_at: ` +
          JSON.stringify(data),
        );
      }

      const typed = data as { api_key: unknown; expires_at: unknown };

      if (typeof typed.api_key !== "string" || !typed.api_key) {
        throw new Error(
          `Backend returned empty or invalid api_key for ${provider}`,
        );
      }

      if (typeof typed.expires_at !== "number" || typed.expires_at <= 0) {
        throw new Error(
          `Backend returned invalid expires_at for ${provider}: ${typed.expires_at}`,
        );
      }

      return { api_key: typed.api_key, expires_at: typed.expires_at };
    })();

    this.pending.set(provider, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pending.delete(provider);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Singleton
// ═══════════════════════════════════════════════════════════════════════════

let instance: TokenCache | null = null;

/** Returns the process-wide singleton TokenCache. */
export function getTokenCache(): TokenCache {
  if (!instance) {
    instance = new TokenCache();
  }
  return instance;
}
