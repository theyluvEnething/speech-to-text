require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { default: Groq, toFile } = require("groq-sdk");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3000;

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION — Temporary shared-secret check
// ═══════════════════════════════════════════════════════════════════════════
//
// FIXME(auth): Replace this with proper Clerk token verification before
// production deployment. The current BACKEND_API_SECRET is a placeholder
// shared secret (default: "0xDEADBEEF") that MUST be changed.
//
// Migration path:
//   1. Set up Clerk backend SDK (`@clerk/express` or manual JWT verification)
//   2. Add CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY to .env
//   3. Replace this middleware with Clerk's `requireAuth()` or a custom
//      `clerkClient.verifyToken()` check against the Clerk JWKS endpoint
//   4. Require `Authorization: Bearer <clerk-session-token>` from clients
//   5. Remove BACKEND_API_SECRET from .env
//
// The placeholder value "0xDEADBEEF" is intentionally obvious so that any
// security audit or AI code review will flag it immediately.

const BACKEND_API_SECRET = process.env["BACKEND_API_SECRET"] || "0xDEADBEEF";

/**
 * Middleware that validates the shared secret on protected key-distribution
 * endpoints. Routes that do NOT call this (e.g. /api/transcribe) are
 * unaffected.
 *
 * Expects header: `x-api-key: <BACKEND_API_SECRET>`
 */
function requireApiSecret(req, res, next) {
  const provided = req.headers["x-api-key"];

  if (!provided || provided !== BACKEND_API_SECRET) {
    console.warn(
      `[Wavely Backend] Rejected unauthorized request to ${req.method} ${req.path} ` +
      `— invalid or missing x-api-key header`,
    );
    return res.status(401).json({
      error: "Unauthorized",
      hint: "Provide a valid x-api-key header. See backend documentation.",
    });
  }

  next();
}

// ═══════════════════════════════════════════════════════════════════════════
// Global middleware
// ═══════════════════════════════════════════════════════════════════════════

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// Rate limiter — shared across transcription endpoints
// ═══════════════════════════════════════════════════════════════════════════

const transcribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Max 10 per minute." },
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER 1: Deepgram — ephemeral (temporary) key
// ═══════════════════════════════════════════════════════════════════════════
//
// The master DEEPGRAM_API_KEY never leaves the server. We call Deepgram's
// key-creation API to mint a short-lived (6 h) scoped key and hand that to
// the client. This is the ideal security pattern.

app.get("/api/get-deepgram-key", requireApiSecret, async (_req, res) => {
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
          time_to_live_in_seconds: 21600, // 6 hours
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

    const expiresAt = Math.floor(Date.now() / 1000) + 21600; // 6 hours

    console.log(
      `[Wavely Backend] Deepgram temporary key generated — expires in 6h (${new Date(expiresAt * 1000).toISOString()})`,
    );
    res.json({ api_key: tempKey, expires_at: expiresAt });
  } catch (err) {
    console.error("[Wavely Backend] Error contacting Deepgram:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER 2: Groq — static API key (pass-through)
// ═══════════════════════════════════════════════════════════════════════════
//
// SECURITY NOTE: This endpoint returns the long-lived master GROQ_API_KEY
// directly. Groq does not currently offer an ephemeral-token endpoint, so
// the key must be exposed to the client. This is a known deviation from the
// ideal ephemeral-token pattern. When Groq adds ephemeral-key support,
// upgrade this endpoint to fetch a short-lived token instead.

app.get("/api/get-groq-key", requireApiSecret, (_req, res) => {
  const apiKey = process.env["GROQ_API_KEY"];

  if (!apiKey || apiKey === "your_key_here") {
    console.error("[Wavely Backend] GROQ_API_KEY not configured.");
    return res.status(500).json({ error: "Groq API key not configured." });
  }

  // Groq has no ephemeral-token endpoint — the key is long-lived.
  // Synthesize a 30-day expiry so the frontend token cache can treat
  // all providers uniformly. On day 29 the cache will auto-refresh.
  const expiresAt = Math.floor(Date.now() / 1000) + 2_592_000; // 30 days

  console.log(
    `[Wavely Backend] Groq API key retrieved — synthetic expiry in 30d (${new Date(expiresAt * 1000).toISOString()})`,
  );
  res.json({ api_key: apiKey, expires_at: expiresAt });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER 3: OpenAI — ephemeral token (secure)
// ═══════════════════════════════════════════════════════════════════════════
//
// The master OPENAI_API_KEY never leaves the server. We call OpenAI's
// realtime client_secrets endpoint to create a short-lived scoped token
// and hand that to the client. This follows the same ephemeral pattern as
// Deepgram and xAI.

app.post("/api/openai-client-secret", requireApiSecret, async (_req, res) => {
  const apiKey = process.env["OPENAI_API_KEY"];

  if (!apiKey || apiKey === "your_key_here") {
    console.error("[Wavely Backend] OPENAI_API_KEY not configured.");
    return res.status(500).json({ error: "OpenAI API key not configured." });
  }

  try {
    const response = await fetch(
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

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Wavely Backend] OpenAI client_secrets error (${response.status}): ${text}`,
      );
      return res.status(500).json({
        error: "Failed to generate OpenAI ephemeral token.",
      });
    }

    const data = await response.json();
    const clientSecret = data.value;

    if (!clientSecret) {
      console.error(
        "[Wavely Backend] No 'value' in OpenAI response:",
        JSON.stringify(data),
      );
      return res.status(500).json({
        error: "No client secret in OpenAI response.",
      });
    }

    const expiresAt = data.expires_at ?? Math.floor(Date.now() / 1000) + 900;

    console.log(
      `[Wavely Backend] OpenAI ephemeral token generated — expires at ${new Date(expiresAt * 1000).toISOString()}`,
    );
    res.json({
      api_key: clientSecret,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[Wavely Backend] Error contacting OpenAI:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER 4: xAI (Grok) — ephemeral token (secure)
// ═══════════════════════════════════════════════════════════════════════════
//
// The master XAI_API_KEY never leaves the server. We call xAI's realtime
// client_secrets endpoint to mint a short-lived (300 s) scoped token and
// hand only that to the client. The client can then connect directly to
// xAI's WebSocket API at wss://api.x.ai/v1/realtime?model=grok-voice-latest
// using the ephemeral token.

app.post("/api/xai-client-secret", requireApiSecret, async (_req, res) => {
  const apiKey = process.env["XAI_API_KEY"];

  if (!apiKey || apiKey === "your_key_here") {
    console.error("[Wavely Backend] XAI_API_KEY not configured.");
    return res.status(500).json({ error: "xAI API key not configured." });
  }

  try {
    const response = await fetch(
      "https://api.x.ai/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expires_after: {
            seconds: 300, // 5 minutes — matches xAI docs example
          },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[Wavely Backend] xAI client_secrets error (${response.status}): ${text}`,
      );
      // Pass through the upstream error so the client can show useful info.
      // Common causes: invalid API key (401), missing permissions (403),
      // or the xAI endpoint not available in your region (404).
      let upstreamError = text;
      try {
        upstreamError = JSON.parse(text);
      } catch { /* not JSON, use raw text */ }
      return res.status(response.status).json({
        error: "xAI ephemeral token request failed.",
        upstream_status: response.status,
        upstream_error: upstreamError,
      });
    }

    const data = await response.json();
    const clientSecret = data.value;

    if (!clientSecret) {
      console.error(
        "[Wavely Backend] No 'value' in xAI response:",
        JSON.stringify(data),
      );
      return res.status(500).json({
        error: "No client secret in xAI response.",
      });
    }

    const expiresAt = data.expires_at ?? Math.floor(Date.now() / 1000) + 300;

    console.log(
      `[Wavely Backend] xAI ephemeral token generated — expires at ${new Date(expiresAt * 1000).toISOString()}`,
    );
    res.json({
      api_key: clientSecret,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[Wavely Backend] Error contacting xAI:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Legacy: batch transcription proxy (Groq Whisper)
// ═══════════════════════════════════════════════════════════════════════════
//
// NOTE: This endpoint is NOT protected by requireApiSecret because the
// existing frontend BackendProvider sends audio directly without an API
// secret header. If you add auth here, update
// frontend/src/transcription/backend/provider.ts to include the header.

app.post(
  "/api/transcribe",
  express.raw({ type: "audio/*", limit: "25mb" }),
  transcribeLimiter,
  async (req, res) => {
    const startTime = Date.now();
    const audioSize = req.body ? req.body.length : 0;

    console.log(
      `[Wavely Backend] Transcribe request — size: ${(audioSize / 1024).toFixed(1)} KB`,
    );

    if (!audioSize) {
      console.error("[Wavely Backend] Transcribe failed: no audio data provided.");
      return res.status(400).json({ success: false, error: "No audio data provided." });
    }

    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      console.error("[Wavely Backend] GROQ_API_KEY not configured.");
      return res.status(500).json({
        success: false,
        error: "Transcription service not configured.",
      });
    }

    try {
      const groq = new Groq({ apiKey });

      const transcription = await groq.audio.transcriptions.create({
        file: await toFile(req.body, "audio.webm"),
        model: "whisper-large-v3",
        language: "de",
        prompt:
          "Kardiologie, Brachykardie, Tachykardie, EKG, Herzinsuffizienz, Arrhythmie",
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

// ═══════════════════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`[Wavely Backend] Running on http://localhost:${PORT}`);
  console.log(
    `[Wavely Backend] Auth: ${BACKEND_API_SECRET === "0xDEADBEEF" ? "⚠ USING PLACEHOLDER SECRET — change BACKEND_API_SECRET in .env" : "✓ custom secret configured"}`,
  );
});
