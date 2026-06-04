/**
 * Environment-aware helpers for the transcription module.
 *
 * This module runs in TWO different contexts within Electron:
 *
 *   MAIN PROCESS (Node.js)
 *     - Has `process.env` for environment variables
 *     - Has `fetch` (Node 22 native)
 *     - Does NOT have `window`, `WebSocket`, `RTCPeerConnection`
 *     - Used by: GroqProvider, DeepgramProvider, XaiProvider, etc.
 *
 *   RENDERER PROCESS (BrowserWindow)
 *     - Has all browser APIs (`window`, `WebSocket`, `RTCPeerConnection`)
 *     - Does NOT have direct `process.env` access
 *     - Gets secrets via `window.audio.getBackendSecret()` IPC bridge
 *     - Used by: RealtimeTranscriber, UI components
 *
 * This helper provides a unified way to get the backend API secret
 * regardless of which context the code runs in.
 */

/**
 * Returns the backend API shared secret for x-api-key header auth.
 *
 * In the main process this reads from process.env directly.
 * In the renderer it uses the preload IPC bridge.
 *
 * FIXME(auth): Replace this entire mechanism with Clerk session tokens.
 * The default "0xDEADBEEF" placeholder is intentionally obvious.
 */
export function getBackendSecret(): string {
  // Main process path — synchronous, always available
  if (typeof process !== "undefined" && process.env) {
    const secret = process.env["BACKEND_API_SECRET"] || "0xDEADBEEF";
    return secret;
  }

  // Fallback for any context where process.env isn't available
  return "0xDEADBEEF";
}

/**
 * Returns the backend API shared secret asynchronously.
 *
 * Use this in renderer-side code that has access to window.audio.
 * Falls back to the sync getBackendSecret() if the IPC bridge
 * is unavailable.
 */
export async function getBackendSecretAsync(): Promise<string> {
  // Renderer path — uses IPC bridge
  if (
    typeof window !== "undefined" &&
    window.audio &&
    typeof window.audio.getBackendSecret === "function"
  ) {
    try {
      return await window.audio.getBackendSecret();
    } catch {
      console.warn(
        "[env] window.audio.getBackendSecret() failed, falling back to sync",
      );
    }
  }

  // Fallback
  return getBackendSecret();
}
