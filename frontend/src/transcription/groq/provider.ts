import { execFile } from "child_process";
import { promisify } from "util";
import { createReadStream, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Groq from "groq-sdk";
import ffmpegPath from "ffmpeg-static";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { getTokenCache } from "../token-cache";

const execFileAsync = promisify(execFile);

export class GroqProvider implements TranscriptionProvider {
  readonly name: ProviderName = "groq";
  private client: Groq | null = null;
  private lastKey: string | null = null; // detect rotation

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(
      `[Groq] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}`,
    );

    // Token cache handles expiry & proactive refresh automatically.
    // We just ask for a valid key — it's either cached or freshly fetched.
    const key = await getTokenCache().get("groq");

    // Recreate SDK client only when the key actually changes
    if (!this.client || key !== this.lastKey) {
      console.log("[Groq] Creating Groq SDK client with token from cache.");
      this.client = new Groq({ apiKey: key });
      this.lastKey = key;
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
      console.log("[Groq] Converting WebM → FLAC (16kHz mono)...");
      await execFileAsync(ffmpegPath, [
        "-i", webmPath,
        "-ar", "16000",
        "-ac", "1",
        "-map", "0:a",
        "-c:a", "flac",
        flacPath,
      ]);

      console.log(
        `[Groq] Sending to Groq API — model: ${options.model}, language: ${options.language}`,
      );

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

      // 401 → token revoked or expired early. Invalidate and retry once.
      const isAuthErr =
        (err as { status?: number }).status === 401 ||
        msg.includes("401") ||
        msg.toLowerCase().includes("unauthorized");

      if (isAuthErr) {
        console.log("[Groq] Auth error — invalidating cached token and retrying...");
        getTokenCache().invalidate("groq");

        const freshKey = await getTokenCache().get("groq");
        this.client = new Groq({ apiKey: freshKey });
        this.lastKey = freshKey;

        // Re-convert and retry (temp files were already cleaned up)
        const retryId = randomUUID();
        const retryWebm = join(tmpDir, `${retryId}.webm`);
        const retryFlac = join(tmpDir, `${retryId}.flac`);

        try {
          writeFileSync(retryWebm, Buffer.from(audio));
          await execFileAsync(ffmpegPath, [
            "-i", retryWebm,
            "-ar", "16000",
            "-ac", "1",
            "-map", "0:a",
            "-c:a", "flac",
            retryFlac,
          ]);

          const retryResult = await this.client!.audio.transcriptions.create({
            file: createReadStream(retryFlac),
            model: options.model,
            language: options.language === "auto" ? undefined : options.language,
            response_format: "verbose_json",
          });

          const retryText = retryResult.text ?? "";
          console.log(`[Groq] Retry result: "${retryText}"`);
          return retryText;
        } finally {
          try { unlinkSync(retryWebm); } catch { /* ignore */ }
          try { unlinkSync(retryFlac); } catch { /* ignore */ }
        }
      }

      console.error(`[Groq] Transcription failed: ${msg}`);
      throw err;
    } finally {
      try { unlinkSync(webmPath); } catch { /* ignore */ }
      try { unlinkSync(flacPath); } catch { /* ignore */ }
    }
  }
}
