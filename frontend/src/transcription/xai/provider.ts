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
  /** Send a JSON text frame (for control messages). */
  sendJson(data: unknown): void;
  /** Send a binary frame (for raw PCM audio). */
  sendBinary(data: Uint8Array): void;
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

/**
 * Create a WebSocket using the appropriate runtime implementation.
 *
 * Authentication strategy per runtime (both documented by xAI):
 *   - Browser:  Sec-WebSocket-Protocol header with xai-client-secret.<TOKEN>
 *               (browsers can't set custom headers on WebSocket upgrade)
 *   - Node.js:  Authorization: Bearer <TOKEN> header via ws package
 *               (cleaner approach when custom headers are available)
 *
 * @param authToken - Raw ephemeral token from xAI (no prefix).
 */
function createSocket(
  url: string,
  authToken: string,
  cb: XaiSocketCallbacks,
): XaiSocket {
  // Browser context — native WebSocket
  if (typeof WebSocket !== "undefined") {
    console.log("[xAI] Using native browser WebSocket.");
    const protocol = `xai-client-secret.${authToken}`;
    const sock = new WebSocket(url, [protocol]);

    sock.addEventListener("open", () => cb.onOpen());
    sock.addEventListener("message", (e) => cb.onMessage(e.data as string));
    sock.addEventListener("error", () =>
      cb.onError(new Error("WebSocket connection failed")),
    );
    sock.addEventListener("close", (e) => cb.onClose(e.code, e.reason));

    return {
      sendJson: (data) => sock.send(JSON.stringify(data)),
      sendBinary: (data) => sock.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)),
      close: () => sock.close(),
      get readyState() {
        return sock.readyState;
      },
    };
  }

  // Node.js main process — use `ws` package with Authorization header.
  console.log("[xAI] Using 'ws' package for Node.js WebSocket.");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS: new (
    url: string,
    opts?: { headers?: Record<string, string> },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any = require("ws");

  const sock = new WS(url, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  sock.on("open", () => cb.onOpen());
  sock.on("message", (data: Buffer | string) => {
    cb.onMessage(typeof data === "string" ? data : data.toString());
  });
  sock.on("error", (err: Error) => cb.onError(err));
  sock.on("close", (code: number, reason: Buffer) => {
    cb.onClose(code, typeof reason === "string" ? reason : reason.toString());
  });
  sock.on("unexpected-response", (_req: unknown, res: { statusCode: number; statusMessage: string; on(event: "data", cb: (chunk: Buffer) => void): void; on(event: "end", cb: () => void): void }) => {
    let body = "";
    res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    res.on("end", () => {
      console.error(
        `[xAI] Server returned HTTP ${res.statusCode} ${res.statusMessage}` +
        (body ? ` — body: ${body.slice(0, 500)}` : ""),
      );
      cb.onUnexpectedResponse?.(res.statusCode);
    });
  });

  return {
    sendJson: (data) => sock.send(JSON.stringify(data)),
    sendBinary: (data) => sock.send(Buffer.from(data)),
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
 * Stream raw PCM audio to the STT WebSocket as binary frames.
 *
 * Sends 100ms chunks (3200 bytes at 16kHz/16-bit/mono) as raw binary
 * WebSocket frames — no JSON wrapping, no base64. After all chunks,
 * sends the `audio.done` control message to trigger final transcription.
 */
function streamPcm(socket: XaiSocket, pcm: ArrayBuffer): void {
  const bytes = new Uint8Array(pcm);
  // 100ms at 16kHz, 16-bit mono = 16000 * 2 / 10 = 3200 bytes
  const chunkSize = 3200;
  const totalChunks = Math.ceil(bytes.length / chunkSize);

  console.log(
    `[xAI-STT] Streaming ${totalChunks} PCM chunks ` +
    `(${bytes.length} bytes total)...`,
  );

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    socket.sendBinary(chunk);
  }

  console.log(`[xAI-STT] All ${totalChunks} chunks sent — sending audio.done.`);
  socket.sendJson({ type: "audio.done" });
}

/**
 * Transcription provider using xAI's Speech-to-Text WebSocket API.
 *
 * Flow (per https://docs.x.ai/developers/model-capabilities/audio/speech-to-text):
 *   1. Fetches an ephemeral token from the Wavely backend (master
 *      XAI_API_KEY never leaves the server).
 *   2. Connects to wss://api.x.ai/v1/stt with sample_rate, encoding,
 *      and language as URL query parameters.
 *   3. Waits for `transcript.created` (server ready signal).
 *   4. Streams raw 16-bit PCM as binary WebSocket frames (no JSON
 *      wrapping, no base64 — raw bytes on the wire).
 *   5. Sends `audio.done` to trigger final transcription.
 *   6. Collects `transcript.partial` events, resolves on
 *      `transcript.done`.
 *
 * Uses the /v1/stt endpoint (NOT /v1/realtime). The /v1/realtime API
 * is a voice-agent (speech↔speech) designed for conversational AI with
 * Grok. The /v1/stt API is purpose-built for transcription.
 *
 * Works in both Electron main process (via `ws` package) and browser
 * renderer (via native `WebSocket`).
 */
export class XaiProvider implements TranscriptionProvider {
  readonly name: ProviderName = "xai";

  /**
   * Transcribe audio using xAI's Speech-to-Text WebSocket API.
   *
   * Protocol (per https://docs.x.ai/developers/model-capabilities/audio/speech-to-text):
   *   1. Connect to wss://api.x.ai/v1/stt with query params for config
   *   2. Wait for `transcript.created` (server ready)
   *   3. Stream raw 16-bit PCM as binary WebSocket frames
   *   4. Send `audio.done` to signal end of audio
   *   5. Receive `transcript.done` with the final text
   *
   * Unlike the /v1/realtime API, this is a single-purpose transcription
   * endpoint — no session management, no modalities config, no voice agent
   * responses. Each connection handles one utterance.
   */
  async transcribe(
    _audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    // xAI STT requires raw 16-bit PCM — the caller MUST pass pcmBuffer.
    const pcm = options.pcmBuffer;
    if (!pcm || pcm.byteLength === 0) {
      throw new Error(
        "xAI provider requires raw PCM audio (pcmBuffer). " +
        "The audio capture pipeline must decode WebM → PCM before calling.",
      );
    }

    console.log(
      `[xAI-STT] PCM: ${pcm.byteLength} bytes ` +
      `(${(pcm.byteLength / 32000).toFixed(2)}s), language: ${options.language}`,
    );

    console.log("[xAI-STT] Step 1: Fetching ephemeral token...");
    const token = await getXaiEphemeralToken();

    // Build STT WebSocket URL with query parameters.
    // Config is via URL, not a session.update message.
    const params = new URLSearchParams();
    params.set("sample_rate", "16000");
    params.set("encoding", "pcm");
    // interim_results gives partial transcripts during speech — useful for
    // long recordings, negligible overhead for push-to-talk.
    params.set("interim_results", "true");
    if (options.language !== "auto" && LANGUAGE_MAP[options.language]) {
      params.set("language", LANGUAGE_MAP[options.language]!);
    }

    const wsUrl = `wss://api.x.ai/v1/stt?${params.toString()}`;
    console.log(`[xAI-STT] Step 2: Connecting to ${wsUrl}`);

    return new Promise<string>((resolve, reject) => {
      const transcriptParts: string[] = [];
      let settled = false;
      let serverReady = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        console.error(`[xAI-STT] Failing: ${err.message}`);
        socket.close();
        reject(err);
      };

      const succeed = (text: string) => {
        if (settled) return;
        settled = true;
        console.log(`[xAI-STT] Final transcript: "${text}" (${text.length} chars)`);
        socket.close();
        resolve(text);
      };

      const timeout = setTimeout(() => {
        fail(new Error("xAI transcription timed out (30s)"));
      }, 30_000);

      const socket = createSocket(wsUrl, token.client_secret, {
        onOpen: () => {
          console.log("[xAI-STT] WebSocket connected — waiting for transcript.created...");
          // Don't send audio yet — server sends transcript.created when ready.
        },

        onMessage: (raw: string) => {
          console.log(
            `[xAI-STT] ← ${raw.slice(0, 200)}${raw.length > 200 ? "..." : ""}`,
          );

          let msg: {
            type?: string;
            text?: string;
            is_final?: boolean;
            speech_final?: boolean;
            error?: { message?: string };
          };
          try {
            msg = JSON.parse(raw);
          } catch {
            console.error("[xAI-STT] Failed to parse:", raw.slice(0, 100));
            return;
          }

          switch (msg.type) {
            case "transcript.created":
              // Server is ready — start streaming PCM
              console.log("[xAI-STT] Server ready — streaming PCM...");
              serverReady = true;
              streamPcm(socket, pcm);
              break;

            case "transcript.partial": {
              const label = msg.is_final
                ? (msg.speech_final ? "utterance-final" : "chunk-final")
                : "interim";
              console.log(`[xAI-STT] [${label}] "${msg.text ?? ""}"`);
              // Accumulate final transcripts, replace on complete utterances
              if (msg.text) {
                if (msg.speech_final) {
                  transcriptParts.length = 0;
                  transcriptParts.push(msg.text);
                } else if (msg.is_final && transcriptParts.length === 0) {
                  transcriptParts.push(msg.text);
                }
              }
              break;
            }

            case "transcript.done":
              clearTimeout(timeout);
              if (msg.text) {
                succeed(msg.text.trim());
              } else {
                succeed(transcriptParts.join("").trim());
              }
              break;

            case "error":
              clearTimeout(timeout);
              fail(
                new Error(
                  `xAI STT error: ${msg.error?.message ?? JSON.stringify(msg)}`,
                ),
              );
              break;

            default:
              console.log(`[xAI-STT] Unhandled: ${msg.type ?? "unknown"}`);
              break;
          }
        },

        onError: (err: Error) => {
          clearTimeout(timeout);
          fail(new Error(`xAI WebSocket error: ${err.message}`));
        },

        onClose: (code: number, reason: string) => {
          console.log(
            `[xAI-STT] WebSocket closed — code: ${code}, reason: "${reason}", ` +
            `parts: ${transcriptParts.length}`,
          );
          if (!settled && transcriptParts.length > 0) {
            succeed(transcriptParts.join("").trim());
          }
        },

        onUnexpectedResponse: (statusCode: number) => {
          console.error(
            `[xAI-STT] Server returned HTTP ${statusCode} — ` +
            `ephemeral token may be invalid or expired.`,
          );

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
