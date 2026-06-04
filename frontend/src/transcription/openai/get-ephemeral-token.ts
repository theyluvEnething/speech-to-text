import { BACKEND_BASE_URL } from "../config";
import { getBackendSecret } from "../env";

export interface OpenAiEphemeralToken {
  client_secret: string;
  expires_at: number | null;
}

/**
 * Fetches a short-lived OpenAI ephemeral token from the Wavely backend.
 *
 * The backend holds the master OPENAI_API_KEY and calls OpenAI's
 * POST /v1/realtime/client_secrets to mint a scoped realtime token.
 * The master key never reaches the client.
 *
 * @returns {client_secret, expires_at} — use client_secret as the
 *   Authorization: Bearer header for OpenAI realtime API calls.
 */
export async function getOpenAiEphemeralToken(): Promise<OpenAiEphemeralToken> {
  const secret = getBackendSecret();
  const url = `${BACKEND_BASE_URL}/api/openai-client-secret`;

  console.log(`[OpenAI] getOpenAiEphemeralToken() — calling backend: POST ${url}`);
  console.log(`[OpenAI] Using backend secret: ${secret === "0xDEADBEEF" ? "⚠ PLACEHOLDER (0xDEADBEEF)" : "✓ custom"}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": secret,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[OpenAI] Backend fetch failed: ${msg}`);
    throw new Error(`Cannot reach Wavely backend at ${url}: ${msg}`);
  }

  console.log(`[OpenAI] Backend response: HTTP ${response.status} ${response.statusText}`);

  if (!response.ok) {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(unable to read response body)";
    }
    console.error(`[OpenAI] Backend returned error: ${body}`);
    throw new Error(
      `Failed to fetch OpenAI ephemeral token (${response.status}): ${body}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    console.error("[OpenAI] Backend response was not valid JSON.");
    throw new Error(
      "Backend returned invalid JSON when fetching OpenAI ephemeral token",
    );
  }

  console.log("[OpenAI] Backend response data:", JSON.stringify(data));

  if (
    typeof data !== "object" ||
    data === null ||
    !("client_secret" in data)
  ) {
    console.error("[OpenAI] Backend response missing 'client_secret':", JSON.stringify(data));
    throw new Error(
      "Backend response for OpenAI ephemeral token missing 'client_secret' field",
    );
  }

  const typed = data as { client_secret: unknown; expires_at: unknown };
  const clientSecret = String(typed.client_secret);

  if (!clientSecret) {
    throw new Error("Backend returned empty OpenAI client_secret");
  }

  const expiresAt =
    typeof typed.expires_at === "number" ? typed.expires_at : null;

  console.log(
    `[OpenAI] Ephemeral token received — ` +
    `secret: ${clientSecret.slice(0, 10)}... (${clientSecret.length} chars), ` +
    `expires_at: ${expiresAt ?? "unknown"}`,
  );

  return {
    client_secret: clientSecret,
    expires_at: expiresAt,
  };
}
