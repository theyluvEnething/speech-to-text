import { execFile } from "child_process";
import { promisify } from "util";
import { createReadStream, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";

const execFileAsync = promisify(execFile);

export class GroqProvider implements TranscriptionProvider {
  readonly name: ProviderName = "groq";
  private client: Groq | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    if (!this.client) {
      const apiKey = process.env["GROQ_API_KEY"];
      if (!apiKey) {
        throw new Error("GROQ_API_KEY environment variable is not set");
      }
      this.client = new Groq({ apiKey });
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
}
