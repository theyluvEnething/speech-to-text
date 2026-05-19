require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { default: Groq, toFile } = require("groq-sdk");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const transcribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Max 10 per minute." },
});

app.get("/api/get-deepgram-key", async (_req, res) => {
  const apiKey = process.env["DEEPGRAM_API_KEY"];
  const projectId = process.env["DEEPGRAM_PROJECT_ID"];

  if (!apiKey || !projectId || apiKey === "your_key_here" || projectId === "your_project_id_here") {
    console.error("[Wavely Backend] Deepgram credentials not configured.");
    return res.status(500).json({ error: "Deepgram credentials not configured." });
  }

  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "Wavely Client Key",
          scopes: ["member"],
          time_to_live_in_seconds: 21600,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Wavely Backend] Deepgram API error (${response.status}): ${text}`);
      return res.status(500).json({ error: "Failed to generate temporary key." });
    }

    const data = await response.json();
    const tempKey = data.key;

    if (!tempKey) {
      console.error("[Wavely Backend] No key in Deepgram response:", JSON.stringify(data));
      return res.status(500).json({ error: "No API key in response." });
    }

    console.log("[Wavely Backend] Temporary key generated successfully.");
    res.json({ api_key: tempKey });
  } catch (err) {
    console.error("[Wavely Backend] Error contacting Deepgram:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post(
  "/api/transcribe",
  express.raw({ type: "audio/*", limit: "25mb" }),
  transcribeLimiter,
  async (req, res) => {
    const startTime = Date.now();
    const audioSize = req.body ? req.body.length : 0;

    console.log(`[Wavely Backend] Transcribe request — size: ${(audioSize / 1024).toFixed(1)} KB`);

    if (!audioSize) {
      console.error("[Wavely Backend] Transcribe failed: no audio data provided.");
      return res.status(400).json({ success: false, error: "No audio data provided." });
    }

    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      console.error("[Wavely Backend] GROQ_API_KEY not configured.");
      return res.status(500).json({ success: false, error: "Transcription service not configured." });
    }

    try {
      const groq = new Groq({ apiKey });

      const transcription = await groq.audio.transcriptions.create({
        file: await toFile(req.body, "audio.webm"),
        model: "whisper-large-v3",
        language: "de",
        prompt: "Kardiologie, Brachykardie, Tachykardie, EKG, Herzinsuffizienz, Arrhythmie",
        response_format: "verbose_json",
      });

      const durationSec = (Date.now() - startTime) / 1000;
      const transcript = transcription.text ?? "";

      console.log(
        `[Wavely Backend] Transcription complete — ` +
        `duration: ${durationSec.toFixed(1)}s, ` +
        `transcript length: ${transcript.length} chars`,
      );

      res.json({
        success: true,
        transcript,
        duration: parseFloat(durationSec.toFixed(1)),
        language: "de",
      });
    } catch (err) {
      const durationSec = (Date.now() - startTime) / 1000;
      const msg = err instanceof Error ? err.message : String(err);

      console.error(
        `[Wavely Backend] Transcription failed after ${durationSec.toFixed(1)}s: ${msg}`,
      );

      res.status(500).json({ success: false, error: "Transcription failed." });
    }
  },
);

app.listen(PORT, () => {
  console.log(`[Wavely Backend] Running on http://localhost:${PORT}`);
});
