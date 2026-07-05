# Wavely Backend — Multi-Provider API Key Distribution

Secure key distribution server for Wavely. Holds master API keys and issues
short-lived tokens to desktop clients. **No audio passes through this server**
— clients stream directly to each provider.

## Architecture

```
┌──────────────┐     ephemeral token      ┌──────────────────────┐
│ Wavely       │ ◄─────────────────────── │ Backend (this)       │
│ (Electron)   │                          │                      │
│              │                          │ Holds master keys:   │
│  x-api-key ──┼─────────────────────────►│  XAI_API_KEY         │
│  (auth)      │                          │  OPENAI_API_KEY      │
│              │                          │  DEEPGRAM_API_KEY    │
│              │                          │  GROQ_API_KEY        │
└──────┬───────┘                          └──────────────────────┘
       │
       │ direct connection (WebSocket / REST)
       ▼
┌──────────────┐
│ xAI / OpenAI │
│ Deepgram     │
│ Groq         │
└──────────────┘
```

## Authentication

All key-distribution endpoints are protected by a shared secret in the
`x-api-key` header.

```
⚠ PLACEHOLDER AUTH — default secret is "0xDEADBEEF"

This MUST be replaced with proper Clerk token verification before
production deployment. See the FIXME(auth) blocks in index.js for
the full migration plan.
```

Clients pass: `x-api-key: <BACKEND_API_SECRET>`

The batch transcription proxy (`POST /api/transcribe`) is intentionally
NOT protected — it's used by the legacy BackendProvider which doesn't
know about auth.

## Production Deployment

The backend runs as a Docker container with **automatic restart** — it
comes back up after crashes and after server reboots with zero manual
intervention.

### Docker Management

All commands must be run from `/opt/speech-to-text/backend/`:

```bash
cd /opt/speech-to-text/backend

docker compose ps          # Is it running?
docker compose logs -f     # Live logs
docker compose restart     # Restart the container
docker compose down        # Stop it
docker compose up -d       # Start it
docker compose build && docker compose up -d  # Rebuild after code changes
```

## API Reference

All key endpoints require `x-api-key` header with `BACKEND_API_SECRET`.

### `GET /api/get-deepgram-key` — Deepgram ephemeral key

Server-to-server call to Deepgram's key API. Master key never exposed.

**Success (200):**
```json
{ "api_key": "dg_temp_abc123..." }
```

**Error (500):**
```json
{ "error": "Failed to generate temporary key." }
```

### `GET /api/get-groq-key` — Groq static key (pass-through)

⚠ Returns the master `GROQ_API_KEY` directly. Groq has no ephemeral token
endpoint yet — upgrade this when they add one.

**Success (200):**
```json
{ "api_key": "gsk_abc123..." }
```

**Error (500):**
```json
{ "error": "Groq API key not configured." }
```

### `POST /api/openai-client-secret` — OpenAI ephemeral token

Server-to-server call to `api.openai.com/v1/realtime/client_secrets`.
Master `OPENAI_API_KEY` never exposed. Returns a scoped realtime token.

**Success (200):**
```json
{ "client_secret": "ek_abc123...", "expires_at": 1774274445 }
```

**Error (500):**
```json
{ "error": "Failed to generate OpenAI ephemeral token." }
```

### `POST /api/xai-client-secret` — xAI (Grok) ephemeral token

Server-to-server call to `api.x.ai/v1/realtime/client_secrets`.
Master `XAI_API_KEY` never exposed. Token valid for 15 minutes.

**Success (200):**
```json
{ "client_secret": "xai-realtime-client-secret-...", "expires_at": 1774274445 }
```

**Error (500):**
```json
{ "error": "Failed to generate xAI ephemeral token." }
```

### `POST /api/transcribe` — Legacy batch transcription (Groq Whisper)

No auth required. Receives audio buffer, returns transcript via Groq.

**Success (200):**
```json
{ "success": true, "transcript": "...", "duration": 1.5, "language": "de" }
```

## Environment Variables (.env)

| Variable | Description | Ephemeral? |
|---|---|---|
| `DEEPGRAM_API_KEY` | Master Deepgram API key | ✅ Temp key issued |
| `DEEPGRAM_PROJECT_ID` | Deepgram project ID | — |
| `GROQ_API_KEY` | Groq API key | ⚠ Static pass-through |
| `OPENAI_API_KEY` | Master OpenAI API key | ✅ Ephemeral token |
| `XAI_API_KEY` | Master xAI API key | ✅ Ephemeral token |
| `BACKEND_API_SECRET` | Shared secret for `x-api-key` auth | — |

Get provider keys from:
- Deepgram: [console.deepgram.com](https://console.deepgram.com)
- Groq: [console.groq.com](https://console.groq.com)
- OpenAI: [platform.openai.com](https://platform.openai.com)
- xAI: [console.x.ai](https://console.x.ai)

## Files

| File | Purpose |
|------|---------|
| `index.js` | Express server — the only app code |
| `Dockerfile` | Builds the Node.js container image |
| `docker-compose.yml` | Runs the container (127.0.0.1:3000 only, behind nginx+TLS at gurndinphilipp.com), restart:unless-stopped |
| `.env` | API keys + secrets (never commit this) |

## First-Time Setup (already done)

```bash
sudo bash /tmp/wavely-setup/setup.sh
```
