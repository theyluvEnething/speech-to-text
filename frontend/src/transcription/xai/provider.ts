import type {
  TranscriptionProvider,
  TranscribeOptions,
  ProviderName,
} from "../types";
import { getXaiEphemeralToken } from "./get-ephemeral-token";

/** Maps Wavely language codes to xAI-compatible language tags. */
const LANGUAGE_MAP: Record<string, string> = {
  en: "en",
  de: "de",
  fr: "fr",
  it: "it",
  es: "es-ES",
};

/**
 * Transcription provider that connects directly to xAI's realtime API.
 *
 * Flow:
 *   1. Fetches an ephemeral token from the Wavely backend (which holds
 *      the master XAI_API_KEY).
 *   2. Opens a native browser WebSocket to xAI's realtime endpoint,
 *      authenticating via the `sec-websocket-protocol` header (browsers
 *      don't allow custom HTTP headers on WebSocket upgrades).
 *   3. Sends a `session.update` frame configuring language and
 *      server-side VAD.
 *   4. Streams the audio buffer, waits for transcript deltas, and
 *      returns the assembled transcript.
 *
 * SECURITY: The master XAI_API_KEY never leaves the backend server.
 * Only the short-lived (15 min) ephemeral token reaches the client.
 */
export class XaiProvider implements TranscriptionProvider {
  readonly name: ProviderName = "xai";

  async transcribe(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    if (audio.byteLength === 0) {
      throw new Error("No audio data provided to xAI provider");
    }

    const token = await getXaiEphemeralToken();

    const wsUrl = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";

    return new Promise<string>((resolve, reject) => {
      // Browsers don't allow custom HTTP headers on WebSocket upgrades.
      // The standard workaround is passing the token as a sub-protocol
      // prefixed with "xai-client-secret." — the xAI server strips this
      // prefix and uses the remainder as the auth token.
      const socket = new WebSocket(wsUrl, [
        `xai-client-secret.${token.client_secret}`,
      ]);

      const transcriptParts: string[] = [];
      let sessionReady = false;

      const fail = (err: Error) => {
        socket.close();
        reject(err);
      };

      const timeout = setTimeout(() => {
        fail(new Error("xAI transcription timed out (30s)"));
      }, 30_000);

      socket.addEventListener("open", () => {
        // Send session configuration before any audio.
        // Language: if "auto", omit the field so xAI auto-detects.
        // Turn detection: server_vad means xAI handles voice activity
        // detection — we don't need client-side VAD.
        const languageTag =
          options.language !== "auto"
            ? (LANGUAGE_MAP[options.language] ?? options.language)
            : undefined;

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

        socket.send(JSON.stringify(sessionUpdate));

        // Now send the audio buffer as base64-encoded chunks.
        // xAI expects input_audio_buffer.append events with base64
        // PCM16 audio. Our audio is WebM/Opus from MediaRecorder —
        // xAI's server handles the decoding.
        const chunkSize = 9600; // ~600ms of 16kHz 16-bit mono
        const bytes = new Uint8Array(audio);

        const sendChunks = () => {
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
          }

          // Commit signals we're done sending audio — xAI begins
          // transcription.
          socket.send(
            JSON.stringify({ type: "input_audio_buffer.commit" }),
          );

          // Request the response — xAI won't send transcripts until
          // we explicitly ask.
          socket.send(
            JSON.stringify({ type: "response.create" }),
          );
        };

        // Small delay to let the session.update propagate before
        // we start streaming audio.
        setTimeout(sendChunks, 200);
      });

      socket.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          switch (msg.type) {
            case "session.created":
            case "session.updated":
              sessionReady = true;
              break;

            // Transcription delta — real-time partial result
            case "response.audio_transcript.delta":
              if (msg.delta) {
                transcriptParts.push(String(msg.delta));
              }
              break;

            // Text delta — for text responses
            case "response.text.delta":
              if (msg.delta) {
                transcriptParts.push(String(msg.delta));
              }
              break;

            // Full transcript when response completes
            case "response.audio_transcript.done":
              if (msg.transcript) {
                // Replace any partial deltas with the complete transcript
                transcriptParts.length = 0;
                transcriptParts.push(String(msg.transcript));
              }
              break;

            case "response.done":
              clearTimeout(timeout);
              socket.close();
              resolve(transcriptParts.join("").trim());
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
              // Log unrecognized event types for debugging
              console.log("[xAI] Unrecognized event:", msg.type);
              break;
          }
        } catch (err) {
          clearTimeout(timeout);
          fail(
            new Error(
              `Failed to parse xAI response: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      });

      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        fail(new Error("xAI WebSocket connection failed"));
      });

      socket.addEventListener("close", (event) => {
        // If the socket closes before response.done, treat as error
        // unless we already have transcript parts
        if (transcriptParts.length === 0 && event.code !== 1000) {
          clearTimeout(timeout);
          fail(
            new Error(
              `xAI WebSocket closed unexpectedly (code: ${event.code}, reason: ${event.reason || "none"})`,
            ),
          );
        }
      });
    });
  }
}
