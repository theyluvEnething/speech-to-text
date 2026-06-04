import type {
  TranscriptionProvider,
  TranscribeOptions,
  ProviderName,
  ServerEvent,
} from "../types";
import { getOpenAiEphemeralToken } from "./get-ephemeral-token";

/**
 * Transcription provider using OpenAI's realtime API via ephemeral token.
 *
 * Flow:
 *   1. Fetches an ephemeral token from the Wavely backend (the master
 *      OPENAI_API_KEY never reaches the client).
 *   2. Opens an RTCPeerConnection + DataChannel to OpenAI's realtime
 *      endpoint, authenticating with the ephemeral token as a Bearer token
 *      in the SDP answer fetch.
 *   3. Streams audio over WebRTC, receives transcription via DataChannel.
 *
 * This mirrors the pattern in groq/realtime-client.ts but uses the
 * backend-mediated ephemeral token instead of calling OpenAI's
 * client_secrets endpoint directly from the frontend.
 */
export class OpenAIProvider implements TranscriptionProvider {
  readonly name: ProviderName = "openai";

  async transcribe(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    if (audio.byteLength === 0) {
      throw new Error("No audio data provided to OpenAI provider");
    }

    const token = await getOpenAiEphemeralToken();

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const succeed = (text: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(text);
      };

      const timeout = setTimeout(() => {
        fail(new Error("OpenAI transcription timed out (30s)"));
      }, 30_000);

      // ── WebRTC setup ──────────────────────────────────────
      const pc = new RTCPeerConnection();
      let dc: RTCDataChannel | null = null;
      let sessionReady = false;
      let track: MediaStreamTrack | null = null;

      const cleanup = () => {
        clearTimeout(timeout);
        if (dc) {
          dc.close();
          dc = null;
        }
        pc.getSenders().forEach((s) => s.track?.stop());
        pc.close();
        if (track) {
          track.stop();
          track = null;
        }
      };

      dc = pc.createDataChannel("oai-events");

      dc.addEventListener("message", (e) => {
        try {
          const event: ServerEvent = JSON.parse(e.data);

          if (event.type === "session.created") {
            sessionReady = true;
            return;
          }

          if (event.type === "response.done" && event.response?.output) {
            for (const item of event.response.output) {
              if (item.role === "assistant" && item.content) {
                for (const part of item.content) {
                  if (part.transcript) {
                    succeed(part.transcript.trim());
                    return;
                  }
                  if (part.type === "text" && part.text) {
                    succeed(part.text.trim());
                    return;
                  }
                }
              }
            }
            // response.done with no text — empty transcript
            succeed("");
            return;
          }

          if (event.type === "error") {
            fail(
              new Error(
                `OpenAI error: ${event.error?.message ?? JSON.stringify(event)}`,
              ),
            );
          }
        } catch {
          // Ignore parse errors on non-critical messages
        }
      });

      // ── Add audio track (silent, enabled after session is ready) ──
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = audioCtx.createBuffer(1, audio.byteLength / 2, 16000);
      const channel = audioBuffer.getChannelData(0);
      const int16 = new Int16Array(audio);
      for (let i = 0; i < channel.length; i++) {
        channel[i] = (int16[i] ?? 0) / 32768;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      track = dest.stream.getAudioTracks()[0]!;
      track.enabled = false; // Muted until session is ready
      pc.addTrack(track);

      // ── SDP negotiation ──────────────────────────────────
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (!pc.localDescription) {
            throw new Error("Failed to create local SDP description");
          }

          return fetch(
            "https://api.openai.com/v1/realtime/calls?model=gpt-realtime",
            {
              method: "POST",
              body: pc.localDescription.sdp,
              headers: {
                Authorization: `Bearer ${token.client_secret}`,
                "Content-Type": "application/sdp",
              },
            },
          );
        })
        .then(async (sdpResponse) => {
          if (!sdpResponse.ok) {
            throw new Error(
              `OpenAI SDP negotiation failed (${sdpResponse.status}): ${await sdpResponse.text()}`,
            );
          }

          const sdp = await sdpResponse.text();
          await pc.setRemoteDescription({ type: "answer", sdp });

          // Wait for session.created event
          await new Promise<void>((ready, timeoutErr) => {
            const deadline = Date.now() + 10_000;
            const check = () => {
              if (sessionReady) return ready();
              if (Date.now() > deadline)
                return timeoutErr(
                  new Error("Timed out waiting for OpenAI session.created"),
                );
              setTimeout(check, 50);
            };
            check();
          });

          // Send session update
          dc!.send(
            JSON.stringify({
              type: "session.update",
              session: {
                type: "transcription",
                modalities: ["text"],
                turn_detection: null,
                temperature: 0,
              },
            }),
          );

          // Small delay then enable audio
          await new Promise((r) => setTimeout(r, 300));
          if (track) track.enabled = true;

          // Start playback + commit
          source.start();
          source.addEventListener("ended", () => {
            dc!.send(
              JSON.stringify({ type: "input_audio_buffer.commit" }),
            );
            dc!.send(JSON.stringify({ type: "response.create" }));
          });

          // Cleanup audio context when done
          source.addEventListener("ended", () => {
            audioCtx.close();
          });
        })
        .catch((err) => {
          audioCtx.close();
          fail(
            err instanceof Error
              ? err
              : new Error(String(err)),
          );
        });
    });
  }
}
