# Wavely Backend

Temporary Deepgram API key distribution server. Holds the master API key securely and issues short-lived keys to Wavely desktop clients — so the master key never leaves the server.

## Setup

```bash
cd backend
npm install
```

Create a `.env` file with your Deepgram credentials:

```
DEEPGRAM_API_KEY=your_master_key_here
DEEPGRAM_PROJECT_ID=your_project_id_here
```

Get these from the [Deepgram Console](https://console.deepgram.com).

## Run

```bash
npm start        # Production
npm run dev      # Development (auto-restarts on changes)
```

The server starts on **http://localhost:3000**.

## API

### `GET /api/get-deepgram-key`

Generates a temporary Deepgram API key and returns it to the client.

**Response** (200):
```json
{
  "api_key": "dg_temp_abc123..."
}
```

**Response** (500):
```json
{
  "error": "Failed to generate temporary key."
}
```

The temporary key:
- Has `member` scope (read/write access to the project)
- Expires after **6 hours** (21600 seconds)
- Is identified by the comment `"Wavely Client Key"` in the Deepgram dashboard

## How it works

1. Client sends `GET /api/get-deepgram-key`
2. Server reads `DEEPGRAM_API_KEY` and `DEEPGRAM_PROJECT_ID` from `.env`
3. Server calls Deepgram's `POST /v1/projects/{id}/keys` with the master key
4. Deepgram returns a temporary key
5. Server returns `{ api_key }` to the client
6. Client uses the temp key for transcription; on expiry (or 401), it requests a new one

## Dependencies

| Library | Purpose |
|---------|---------|
| `express` | HTTP server |
| `cors` | Cross-origin requests (client runs on a different origin) |
| `dotenv` | Load credentials from `.env` |
