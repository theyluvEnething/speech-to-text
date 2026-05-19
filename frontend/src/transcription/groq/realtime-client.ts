import { getApiKey } from "./get-api-key";
import type { TranscriptionCallback, ServerEvent } from "../types";

export type { TranscriptionCallback } from "../types";

export class RealtimeTranscriber {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private onTranscript: TranscriptionCallback;
  private sessionReady = false;
  private queuedCommit = false;

  constructor(onTranscript: TranscriptionCallback) {
    this.onTranscript = onTranscript;
  }

  async start(): Promise<MediaStream> {
    const apiKey = await getApiKey();

    const tokenResponse = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime",
            instructions:
              "You are a highly accurate transcription engine. Output only the transcribed text.",
          },
        }),
      },
    );

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Token creation failed (${tokenResponse.status}): ${body}`);
    }

    const tokenData = await tokenResponse.json();
    const EPHEMERAL_KEY = tokenData.value;
    if (!EPHEMERAL_KEY) throw new Error("No ephemeral key in response");

    const pc = new RTCPeerConnection();
    this.pc = pc;
    this.sessionReady = false;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = this.stream.getTracks()[0]!;
    track.enabled = false;
    pc.addTrack(track);

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.addEventListener("message", (e) => {
      this.handleServerEvent(JSON.parse(e.data));
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls?model=gpt-realtime",
      {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      },
    );

    if (!sdpResponse.ok) {
      throw new Error(`SDP failed (${sdpResponse.status}): ${await sdpResponse.text()}`);
    }

    const sdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp });

    await this.waitForSessionCreated();

    this.sendEvent({
      type: "session.update",
      session: {
        type: "transcription",
        modalities: ["text"],
        turn_detection: null,
        temperature: 0,
      },
    });

    await new Promise((r) => setTimeout(r, 300));
    track.enabled = true;

    if (this.queuedCommit) {
      this.queuedCommit = false;
      this.sendEvent({ type: "input_audio_buffer.commit" });
      this.sendEvent({ type: "response.create" });
    }

    return this.stream;
  }

  sendEvent(message: Record<string, unknown>): void {
    if (this.dc && this.dc.readyState === "open") {
      message["event_id"] = message["event_id"] || crypto.randomUUID();
      this.dc.send(JSON.stringify(message));
    }
  }

  commitAndRequestResponse(): void {
    if (!this.sessionReady) {
      this.queuedCommit = true;
      return;
    }
    this.sendEvent({ type: "input_audio_buffer.commit" });
    this.sendEvent({ type: "response.create" });
  }

  stop(): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.getSenders().forEach((s) => s.track?.stop());
      this.pc.close();
      this.pc = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private async waitForSessionCreated(): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (!this.sessionReady) {
      if (Date.now() > deadline) throw new Error("Timed out waiting for session.created");
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private handleServerEvent(event: ServerEvent): void {
    if (event.type === "session.created") {
      this.sessionReady = true;
    }

    if (event.type === "response.done" && event.response?.output) {
      for (const item of event.response.output) {
        if (item.role === "assistant" && item.content) {
          for (const part of item.content) {
            if (part.transcript) {
              this.onTranscript(part.transcript);
            } else if (part.type === "text" && part.text) {
              this.onTranscript(part.text);
            }
          }
        }
      }
    }

    if (event.type === "error") {
      console.error("[transcription] Server error:", JSON.stringify(event));
    }
  }
}
