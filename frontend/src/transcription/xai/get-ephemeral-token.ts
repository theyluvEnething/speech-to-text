import { BACKEND_BASE_URL } from "../config";
import { getBackendSecret } from "../env";

export interface EphemeralToken {
  client_secret: string;
  expires_at: number | null;
}

/**
 * Fetches a short-lived xAI ephemeral token from the Wavely backend.
 *
 * The backend holds the master XAI_API_KEY and calls xAI's
 * POST /v1/realtime/client_secrets to mint a scoped token valid for
 * 15 minutes. The master key never reaches the client.
 *
 * @returns {client_secret, expires_at} — pass client_secret to the
 *   WebSocket as a sub-protocol parameter.
 */
export async function getXaiEphemeralToken(): Promise<EphemeralToken> {
  const secret = getBackendSecret();
  const url = `${BACKEND_BASE_URL}/api/xai-client-secret`;

  console.log(`[xAI] getXaiEphemeralToken() — calling backend: POST ${url}`);
  console.log(`[xAI] Using backend secret: ${secret === "0xDEADBEEF" ? "⚠ PLACEHOLDER (0xDEADBEEF)" : "✓ custom"}`);

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
    console.error(`[xAI] Backend fetch failed: ${msg}`);
    throw new Error(`Cannot reach Wavely backend at ${url}: ${msg}`);
  }

  console.log(`[xAI] Backend response: HTTP ${response.status} ${response.statusText}`);

  if (!response.ok) {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = "(unable to read response body)";
    }
    console.error(`[xAI] Backend returned error: ${body}`);
    throw new Error(
      `Failed to fetch xAI ephemeral token (${response.status}): ${body}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    console.error("[xAI] Backend response was not valid JSON.");
    throw new Error(
      "Backend returned invalid JSON when fetching xAI ephemeral token",
    );
  }

  console.log("[xAI] Backend response data:", JSON.stringify(data));

  // Check for upstream error from the xAI API (passed through by backend)
  if (
    typeof data === "object" &&
    data !== null &&
    "upstream_error" in data
  ) {
    const errData = data as {
      error: string;
      upstream_status: number;
      upstream_error: unknown;
    };
    const upstreamMsg =
      typeof errData.upstream_error === "string"
        ? errData.upstream_error
        : JSON.stringify(errData.upstream_error);
    console.error(
      `[xAI] Upstream xAI API error (HTTP ${errData.upstream_status}): ${upstreamMsg}`,
    );
    throw new Error(
      `xAI API error (${errData.upstream_status}): ${upstreamMsg}`,
    );
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("client_secret" in data)
  ) {
    console.error(
      "[xAI] Backend response missing 'client_secret':",
      JSON.stringify(data),
    );
    throw new Error(
      "Backend response for xAI ephemeral token missing 'client_secret' field",
    );
  }

  const typed = data as { client_secret: unknown; expires_at: unknown };
  const clientSecret = String(typed.client_secret);

  if (!clientSecret) {
    throw new Error("Backend returned empty xAI client_secret");
  }

  const expiresAt =
    typeof typed.expires_at === "number" ? typed.expires_at : null;

  console.log(
    `[xAI] Ephemeral token received — ` +
    `secret: ${clientSecret.slice(0, 20)}... (${clientSecret.length} chars), ` +
    `expires_at: ${expiresAt ?? "unknown"}`,
  );

  return {
    client_secret: clientSecret,
    expires_at: expiresAt,
  };
}
