/**
 * Backend API shared secret.
 *
 * Hardcoded to match the backend's default BACKEND_API_SECRET ("0xDEADBEEF").
 * Both sides must agree on this value for the x-api-key header check to pass.
 *
 * FIXME(auth): Replace this entire mechanism with Clerk session tokens.
 * The current shared-secret approach means anyone with the app binary can
 * call the backend — it prevents casual snooping but is not real security.
 * See backend/index.js for the full Clerk migration plan.
 */
const BACKEND_API_SECRET = "0xDEADBEEF";

/**
 * Returns the backend API shared secret for x-api-key header auth.
 *
 * Always returns the hardcoded placeholder. No environment variable lookup
 * so the packaged app works identically on any machine.
 */
export function getBackendSecret(): string {
  return BACKEND_API_SECRET;
}

/**
 * Async variant — same value, returned as a Promise.
 *
 * Use this in renderer-side code that has access to window.audio.
 * The IPC bridge is not used here; the secret is bundled in the app.
 */
export async function getBackendSecretAsync(): Promise<string> {
  return BACKEND_API_SECRET;
}
