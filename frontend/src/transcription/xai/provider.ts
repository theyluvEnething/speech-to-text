import type {
  TranscriptionProvider,
  TranscribeOptions,
  ProviderName,
} from "../types";
import { getXaiEphemeralToken } from "./get-ephemeral-token";
import { getTokenCache } from "../token-cache";

// ═══════════════════════════════════════════════════════════════════════════
// WebSocket abstraction
// ═══════════════════════════════════════════════════════════════════════════
//
// The xAI provider runs in two different runtimes:
//   - Electron MAIN PROCESS (Node.js): uses the `ws` npm package
//   - Browser RENDERER (BrowserWindow): uses the native `WebSocket` global
//
// These have different construction and event-binding APIs. This tiny
// adapter normalizes both behind a common interface.

interface XaiSocket {
  send(data: string): void;
  close(): void;
  readonly readyState: number;
}

interface XaiSocketCallbacks {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onError: (err: Error) => void;
  onClose: (code: number, reason: string) => void;
  onUnexpectedResponse?: (statusCode: number) => void;
}

/** Create a WebSocket using the appropriate runtime implementation. */
function createSocket(
  url: string,
  protocol: string,
  cb: XaiSocketCallbacks,
): XaiSocket {
  // Browser context — native WebSocket
  if (typeof WebSocket !== "undefined") {
    console.log("[xAI] Using native browser WebSocket.");
    const sock = new WebSocket(url, [protocol]);

    sock.addEventListener("open", () => cb.onOpen());
    sock.addEventListener("message", (e) => cb.onMessage(e.data as string));
    sock.addEventListener("error", () =>
      cb.onError(new Error("WebSocket connection failed")),
    );
    sock.addEventListener("close", (e) => cb.onClose(e.code, e.reason));

    return {
      send: (data) => sock.send(data),
      close: () => sock.close(),
      get readyState() {
        return sock.readyState;
      },
    };
  }

  // Node.js main process — use `ws` package
  console.log("[xAI] Using 'ws' package for Node.js WebSocket.");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS: new (
    url: string,
    opts?: { protocol?: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any = require("ws");

  const sock = new WS(url, { protocol });

  sock.on("open", () => cb.onOpen());
  sock.on("message", (data: Buffer | string) => {
    cb.onMessage(typeof data === "string" ? data : data.toString());
  });
  sock.on("error", (err: Error) => cb.onError(err));
  sock.on("close", (code: number, reason: Buffer) => {
    cb.onClose(code, typeof reason === "string" ? reason : reason.toString());
  });
  sock.on("unexpected-response", (_req: unknown, res: { statusCode: number }) => {
    cb.onUnexpectedResponse?.(res.statusCode);
  });

  return {
    send: (data: string) => sock.send(data),
    close: () => sock.close(),
    get readyState() {
      return sock.readyState;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Language mapping
// ═══════════════════════════════════════════════════════════════════════════

const LANGUAGE_MAP: Record<string, string> = {
  en: "en",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es-ES",
};

// ═══════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transcription provider that connects directly to xAI's realtime API.
 *
 * Flow:
 *   1. Fetches an ephemeral token from the Wavely backend (the master
 *      XAI_API_KEY never leaves the server).
 *   2. Opens a WebSocket to xAI's realtime endpoint, authenticating via
 *      the `Sec-WebSocket-Protocol` header. The token is prefixed with
 *      "xai-client-secret." — the xAI server strips the prefix and uses
 *      the remainder as the auth token.
 *   3. Sends a `session.update` frame with language config and server-
 *      side VAD.
 *   4. Streams the audio buffer as base64 chunks, then waits for
 *      transcript deltas.
 *
 * Works in both Electron main process (via `ws` package) and browser
 * renderer (via native `WebSocket`).
 */
export class XaiProvider implements TranscriptionProvider {
  readonly name: ProviderName = "xai";

  async transcribe(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    console.log(
      `[xAI] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, language: ${options.language}, ` +
      `model: ${options.model}`,
    );

    if (audio.byteLength === 0) {
      throw new Error("No audio data provided to xAI provider");
    }

    console.log("[xAI] Step 1: Fetching ephemeral token from backend...");
    const token = await getXaiEphemeralToken();

    const wsUrl = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";
    const protocol = `xai-client-secret.${token.client_secret}`;
    console.log(`[xAI] Step 2: Connecting WebSocket to ${wsUrl}`);

    const languageTag =
      options.language !== "auto"
        ? (LANGUAGE_MAP[options.language] ?? options.language)
        : undefined;

    return new Promise<string>((resolve, reject) => {
      const transcriptParts: string[] = [];
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        console.error(`[xAI] Failing: ${err.message}`);
        socket.close();
        reject(err);
      };

      const succeed = (text: string) => {
        if (settled) return;
        settled = true;
        console.log(`[xAI] Final transcript: "${text}" (${text.length} chars)`);
        socket.close();
        resolve(text);
      };

      const timeout = setTimeout(() => {
        fail(new Error("xAI transcription timed out (30s)"));
      }, 30_000);

      const socket = createSocket(wsUrl, protocol, {
        onOpen: () => {
          console.log("[xAI] WebSocket connected.");

          const transcriptionConfig: Record<string, unknown> = {
            model: "grok-voice-latest",
          };
          if (languageTag) {
            transcriptionConfig["language"] = languageTag;
          }

          const sessionUpdate = {
            type: "session.update" as const,
            session: {
              turn_detection: { type: "server_vad" as const },
              input_audio_transcription: transcriptionConfig,
            },
          };

          console.log(
            "[xAI] Step 3: Sending session.update —",
            JSON.stringify(sessionUpdate),
          );
          socket.send(JSON.stringify(sessionUpdate));

          // Small delay to let session.update propagate before audio
          setTimeout(() => {
            console.log(
              `[xAI] Step 4: Streaming audio buffer (${audio.byteLength} bytes)...`,
            );

            const chunkSize = 9600;
            const bytes = new Uint8Array(audio);
            let chunksSent = 0;

            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.slice(i, i + chunkSize);
              let binary = "";
              for (let j = 0; j < chunk.length; j++) {
                binary += String.fromCharCode(chunk[j]!);
              }
              const b64 = btoa(binary);

              socket.send(
                JSON.stringify({
                  type: "input_audio_buffer.append",
                  audio: b64,
                }),
              );
              chunksSent++;
            }

            console.log(`[xAI] Sent ${chunksSent} audio chunks.`);
            socket.send(
              JSON.stringify({ type: "input_audio_buffer.commit" }),
            );
            socket.send(
              JSON.stringify({ type: "response.create" }),
            );
            console.log("[xAI] Commit + response.create sent — waiting...");
          }, 200);
        },

        onMessage: (raw: string) => {
          console.log(
            `[xAI] ← ${raw.slice(0, 250)}${raw.length > 250 ? "..." : ""}`,
          );

          let msg: { type?: string; delta?: unknown; transcript?: unknown; error?: { message?: string } };
          try {
            msg = JSON.parse(raw);
          } catch {
            console.error("[xAI] Failed to parse server message:", raw.slice(0, 100));
            return;
          }

          switch (msg.type) {
            case "session.created":
            case "session.updated":
              console.log(`[xAI] ${msg.type}`);
              break;

            case "response.audio_transcript.delta":
              if (msg.delta) {
                const delta = String(msg.delta);
                console.log(`[xAI] Transcript delta: "${delta}"`);
                transcriptParts.push(delta);
              }
              break;

            case "response.text.delta":
              if (msg.delta) {
                transcriptParts.push(String(msg.delta));
              }
              break;

            case "response.audio_transcript.done":
              if (msg.transcript) {
                transcriptParts.length = 0;
                transcriptParts.push(String(msg.transcript));
              }
              break;

            case "response.done":
              clearTimeout(timeout);
              succeed(transcriptParts.join("").trim());
              break;

            case "error":
              clearTimeout(timeout);
              fail(
                new Error(
                  `xAI error: ${msg.error?.message ?? JSON.stringify(msg)}`,
                ),
              );
              break;

            default:
              console.log(`[xAI] Unhandled event: ${msg.type ?? "unknown"}`);
              break;
          }
        },

        onError: (err: Error) => {
          clearTimeout(timeout);
          fail(new Error(`xAI WebSocket error: ${err.message}`));
        },

        onClose: (code: number, reason: string) => {
          console.log(
            `[xAI] WebSocket closed — code: ${code}, reason: "${reason}", ` +
            `parts: ${transcriptParts.length}`,
          );
          if (!settled && transcriptParts.length > 0) {
            succeed(transcriptParts.join("").trim());
          }
        },

        onUnexpectedResponse: (statusCode: number) => {
          console.error(
            `[xAI] Server returned HTTP ${statusCode} — ` +
            `ephemeral token may be invalid or expired.`,
          );

          // 401 / 403 → token rejected, invalidate cache for next attempt
          if (statusCode === 401 || statusCode === 403) {
            getTokenCache().invalidate("xai");
          }

          clearTimeout(timeout);
          fail(
            new Error(
              `xAI WebSocket upgrade failed (HTTP ${statusCode}). ` +
              `Check that XAI_API_KEY is valid and the backend can reach api.x.ai.`,
            ),
          );
        },
      });
    });
  }
}
