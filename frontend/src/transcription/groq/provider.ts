import { execFile } from "child_process";
import { promisify } from "util";
import { createReadStream, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { BACKEND_BASE_URL } from "../config";

const execFileAsync = promisify(execFile);

export class GroqProvider implements TranscriptionProvider {
  readonly name: ProviderName = "groq";
  private client: Groq | null = null;
  private cachedKey: string | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(`[Groq] Recording triggered — key cached: ${this.cachedKey ? "yes" : "NO — fetching from backend..."}`);
    if (!this.client) {
      await this.fetchApiKey();
      this.client = new Groq({ apiKey: this.cachedKey! });
    }

    if (!ffmpegPath) {
      throw new Error("ffmpeg binary not found — ensure ffmpeg-static is installed");
    }

    const tmpDir = tmpdir();
    const id = randomUUID();
    const webmPath = join(tmpDir, `${id}.webm`);
    const flacPath = join(tmpDir, `${id}.flac`);

    try {
      writeFileSync(webmPath, Buffer.from(audio));
      await execFileAsync(ffmpegPath, [
        "-i", webmPath,
        "-ar", "16000",
        "-ac", "1",
        "-map", "0:a",
        "-c:a", "flac",
        flacPath,
      ]);

      const transcription = await this.client.audio.transcriptions.create({
        file: createReadStream(flacPath),
        model: options.model,
        language: options.language === "auto" ? undefined : options.language,
        response_format: "verbose_json",
      });

      return transcription.text ?? "";
    } finally {
      try { unlinkSync(webmPath); } catch { /* ignore */ }
      try { unlinkSync(flacPath); } catch { /* ignore */ }
    }
  }

  private async fetchApiKey(): Promise<void> {
    console.log("[Groq] Fetching API key from backend...");
    const response = await fetch(`${BACKEND_BASE_URL}/api/get-groq-key`);

    if (!response.ok) {
      let body: string;
      try {
        body = await response.text();
      } catch {
        body = "(unable to read response body)";
      }
      throw new Error(
        `Failed to fetch Groq API key from backend (${response.status}): ${body}`,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error("Backend returned invalid JSON when fetching Groq API key");
    }

    if (typeof data !== "object" || data === null || !("api_key" in data)) {
      throw new Error("Backend response for Groq API key missing 'api_key' field");
    }

    this.cachedKey = String((data as { api_key: unknown }).api_key);
    if (!this.cachedKey) {
      throw new Error("Backend returned empty Groq API key");
    }

    console.log("[Groq] API key received.");
  }
}
