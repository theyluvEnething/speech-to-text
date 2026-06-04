import { BACKEND_BASE_URL } from "../config";

export interface OpenAiEphemeralToken {
  client_secret: string;
  expires_at: number | null;
}

/**
 * Fetches a short-lived OpenAI ephemeral token from the Wavely backend.
 *
 * The backend holds the master OPENAI_API_KEY and calls OpenAI's
 * POST /v1/realtime/client_secrets to mint a scoped token. The master
 * key never reaches the client.
 *
 * @returns {client_secret, expires_at} — use client_secret as the
 *   Authorization: Bearer header for OpenAI realtime API calls.
 */
export async function getOpenAiEphemeralToken(): Promise<OpenAiEphemeralToken> {
  const secret = await window.audio.getBackendSecret();

  const response = await fetch(`${BACKEND_BASE_URL}/api/openai-client-secret`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": secret,
    },
  });

  if (!response.ok) {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(unable to read response body)";
    }
    throw new Error(
      `Failed to fetch OpenAI ephemeral token (${response.status}): ${body}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Backend returned invalid JSON when fetching OpenAI ephemeral token",
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("client_secret" in data)
  ) {
    throw new Error(
      "Backend response for OpenAI ephemeral token missing 'client_secret' field",
    );
  }

  const typed = data as { client_secret: unknown; expires_at: unknown };
  const clientSecret = String(typed.client_secret);

  if (!clientSecret) {
    throw new Error("Backend returned empty OpenAI client_secret");
  }

  return {
    client_secret: clientSecret,
    expires_at:
      typeof typed.expires_at === "number" ? typed.expires_at : null,
  };
}
