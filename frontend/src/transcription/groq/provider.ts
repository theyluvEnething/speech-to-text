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
import { getBackendSecret } from "../env";

const execFileAsync = promisify(execFile);

export class GroqProvider implements TranscriptionProvider {
  readonly name: ProviderName = "groq";
  private client: Groq | null = null;
  private cachedKey: string | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(
      `[Groq] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}, ` +
      `key cached: ${this.cachedKey ? "yes" : "no"}`,
    );

    if (!this.client) {
      console.log("[Groq] No client — fetching API key from backend...");
      await this.fetchApiKey();
      console.log("[Groq] Creating Groq SDK client with fetched key.");
      this.client = new Groq({ apiKey: this.cachedKey! });
    }

    if (!ffmpegPath) {
      throw new Error("ffmpeg binary not found — ensure ffmpeg-static is installed");
    }

    const tmpDir = tmpdir();
    const id = randomUUID();
    const webmPath = join(tmpDir, `${id}.webm`);
    const flacPath = join(tmpDir, `${id}.flac`);

    console.log(`[Groq] Writing temp files: webm=${webmPath}, flac=${flacPath}`);

    try {
      writeFileSync(webmPath, Buffer.from(audio));
      console.log(`[Groq] Converting WebM → FLAC (16kHz mono)...`);
      await execFileAsync(ffmpegPath, [
        "-i", webmPath,
        "-ar", "16000",
        "-ac", "1",
        "-map", "0:a",
        "-c:a", "flac",
        flacPath,
      ]);

      console.log(`[Groq] Sending to Groq API — model: ${options.model}, language: ${options.language}`);
      const transcription = await this.client.audio.transcriptions.create({
        file: createReadStream(flacPath),
        model: options.model,
        language: options.language === "auto" ? undefined : options.language,
        response_format: "verbose_json",
      });

      const text = transcription.text ?? "";
      console.log(`[Groq] Transcription result: "${text}" (${text.length} chars)`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Groq] Transcription failed: ${msg}`);
      throw err;
    } finally {
      try { unlinkSync(webmPath); } catch { /* ignore */ }
      try { unlinkSync(flacPath); } catch { /* ignore */ }
      console.log("[Groq] Temp files cleaned up.");
    }
  }

  private async fetchApiKey(): Promise<void> {
    const secret = getBackendSecret();
    const url = `${BACKEND_BASE_URL}/api/get-groq-key`;

    console.log(`[Groq] fetchApiKey() — calling backend: GET ${url}`);
    console.log(`[Groq] Using backend secret: ${secret === "0xDEADBEEF" ? "⚠ PLACEHOLDER (0xDEADBEEF)" : "✓ custom"}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-api-key": secret },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Groq] Backend fetch failed: ${msg}`);
      throw new Error(`Cannot reach Wavely backend at ${url}: ${msg}`);
    }

    console.log(`[Groq] Backend response: HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let body: string;
      try {
        body = await response.text();
      } catch {
        body = "(unable to read response body)";
      }
      console.error(`[Groq] Backend returned error: ${body}`);
      throw new Error(
        `Failed to fetch Groq API key from backend (${response.status}): ${body}`,
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.error("[Groq] Backend response was not valid JSON.");
      throw new Error("Backend returned invalid JSON when fetching Groq API key");
    }

    if (typeof data !== "object" || data === null || !("api_key" in data)) {
      console.error("[Groq] Backend response missing 'api_key':", JSON.stringify(data));
      throw new Error("Backend response for Groq API key missing 'api_key' field");
    }

    this.cachedKey = String((data as { api_key: unknown }).api_key);
    if (!this.cachedKey) {
      throw new Error("Backend returned empty Groq API key");
    }

    console.log(`[Groq] API key received successfully (${this.cachedKey.length} chars, starts with: ${this.cachedKey.slice(0, 8)}...)`);
  }
}
