# Wavely Backend

Temporary Deepgram API key distribution server. Holds the master API key securely and issues short-lived keys to Wavely desktop clients.

## Production Deployment

The backend runs as a Docker container with **automatic restart** — it comes back up after crashes and after server reboots with zero manual intervention.

### Frontend API URL

```
http://2a02:c207:2298:9950::1:3000/api/get-deepgram-key
```

Point the Wavely frontend (Electron app) at this URL to get temporary Deepgram keys.

## Docker Management

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

## Files

| File | Purpose |
|------|---------|
| `index.js` | Express server — the only app code |
| `Dockerfile` | Builds the Node.js container image |
| `docker-compose.yml` | Runs the container with restart:always |
| `.env` | Deepgram credentials (never commit this) |

## API

### `GET /api/get-deepgram-key`

Returns a temporary Deepgram API key valid for 6 hours.

**Success (200):**
```json
{ "api_key": "dg_temp_abc123..." }
```

**Error (500):**
```json
{ "error": "Failed to generate temporary key." }
```

## Environment Variables (.env)

| Variable | Description |
|----------|-------------|
| `DEEPGRAM_API_KEY` | Master Deepgram API key |
| `DEEPGRAM_PROJECT_ID` | Deepgram project ID |

Get these from [console.deepgram.com](https://console.deepgram.com).

## First-Time Setup (already done)

```bash
sudo bash /tmp/wavely-setup/setup.sh
```
