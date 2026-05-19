import { DeepgramClient } from "@deepgram/sdk";

let cachedKey: string | null = null;
let deepgram: DeepgramClient | null = null;

let liveClient: any = null;
let realtimeTranscript = "";
let realtimeChunkCount = 0;
let realtimeMessageCount = 0;
const earlyChunkBuffer: ArrayBuffer[] = [];
let liveSocketReady = false;

const MEDICAL_KEYWORDS = [
  "metformin:2", "amlodipine:2", "clopidogrel:2", "levothyroxine:2",
  "amoxicillin:2", "azithromycin:2", "ceftriaxone:2", "vancomycin:2",
  "hemoglobin A1c:2", "creatinine:2", "troponin:2", "D-dimer:2",
  "BNP:2", "CRP:2", "ESR:2",
];

export async function fetchTemporaryKey(): Promise<string> {
  console.log("[Wavely] Fetching temporary Deepgram key from backend...");
  const BACKEND_URL = "http://157.173.115.116:3000/api/get-deepgram-key";
  const response = await fetch(BACKEND_URL);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend returned ${response.status}: ${body}`);
  }
  const data = await response.json();
  if (!data.api_key) {
    throw new Error("Backend response missing api_key");
  }
  cachedKey = String(data.api_key);
  deepgram = null; // force re-instantiation with new key
  console.log("[Wavely] Temporary key received.");
  return cachedKey;
}

function getClient(): DeepgramClient {
  if (!deepgram) {
    if (!cachedKey) {
      throw new Error("No Deepgram API key available. Ensure the backend is running.");
    }
    deepgram = new DeepgramClient({ apiKey: cachedKey as string });
  }
  return deepgram;
}

export function initDeepgramClient(): void {
  getClient();
}

function buildModelName(model: string, modelTier: string): string {
  if (!modelTier) return model;
  return `${model}-${modelTier}`;
}

async function transcribeOnce(
  buffer: ArrayBuffer,
  model: string,
  modelTier: string,
  language: string,
): Promise<string> {
  const client = getClient();
  const modelName = buildModelName(model, modelTier);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await client.listen.v1.media.transcribeFile(
    Buffer.from(buffer),
    {
      model: modelName,
      smart_format: true,
      dictation: true,
      punctuate: true,
      filler_words: false,
      keywords: MEDICAL_KEYWORDS,
      mimetype: "audio/webm",
      language: language === "auto" ? undefined : language,
    } as any,
  );

  const transcript =
    response.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  return transcript?.trim() ?? "";
}

export async function transcribe(
  buffer: ArrayBuffer,
  model: string,
  modelTier: string,
  language: string,
): Promise<string> {
  try {
    return await transcribeOnce(buffer, model, modelTier, language);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status;
    const isAuthError =
      status === 401 ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("key") ||
      msg.toLowerCase().includes("expired");

    if (isAuthError) {
      console.log("[Wavely] Auth error — fetching fresh key and retrying...");
      await fetchTemporaryKey();
      return await transcribeOnce(buffer, model, modelTier, language);
    }

    throw err;
  }
}

export async function startRealtimeTranscription(
  model: string,
  modelTier: string,
  language: string,
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
): Promise<void> {
  const client = getClient();
  const modelName = buildModelName(model, modelTier);
  const langLabel = language === "auto" ? "auto (undefined)" : language;

  console.log(`[Wavely RT] Connecting — model=${modelName} language=${langLabel}`);

  liveClient = await client.listen.v1.connect({
    model: modelName,
    smart_format: "true",
    dictation: "true",
    interim_results: "true",
    punctuate: "true",
    language: language === "auto" ? undefined : language,
  } as any);

  realtimeTranscript = "";
  realtimeChunkCount = 0;
  realtimeMessageCount = 0;
  earlyChunkBuffer.length = 0;
  liveSocketReady = false;

  liveClient.on("open", () => {
    console.log(`[Wavely RT] WebSocket open event fired — flushing ${earlyChunkBuffer.length} buffered chunks.`);
    liveSocketReady = true;
    for (const chunk of earlyChunkBuffer) {
      liveClient.sendMedia(Buffer.from(chunk));
      realtimeChunkCount++;
    }
    earlyChunkBuffer.length = 0;
  });

  liveClient.on("message", (data: any) => {
    realtimeMessageCount++;
    console.log(`[Wavely RT] Message #${realtimeMessageCount} type=${data.type} is_final=${data.is_final} transcript_len=${data.channel?.alternatives?.[0]?.transcript?.length ?? 0}`);

    if (data.type === "Results") {
      const transcript: string =
        data.channel?.alternatives?.[0]?.transcript ?? "";

      if (!transcript) {
        console.log("[Wavely RT] Results message with empty transcript — skipping.");
        return;
      }

      if (data.is_final) {
        console.log(`[Wavely RT] Final transcript fragment: "${transcript}" (speech_final=${data.speech_final})`);

        // Avoid double-appending: if the new fragment is already contained
        // in the accumulated transcript, Deepgram sent a cumulative result.
        const trimmed = transcript.trim();
        if (trimmed && !realtimeTranscript.includes(trimmed)) {
          realtimeTranscript += trimmed + " ";
          console.log(`[Wavely RT] Appended — transcript now: "${realtimeTranscript.trim()}"`);
        } else if (trimmed && realtimeTranscript.includes(trimmed)) {
          console.log(`[Wavely RT] Skipped duplicate fragment.`);
        }

        onInterim(realtimeTranscript.trim());
        onFinal(realtimeTranscript.trim());
      } else {
        console.log(`[Wavely RT] Interim transcript: "${transcript}"`);
        onInterim((realtimeTranscript + transcript).trim());
      }
    } else if (data.type === "Metadata") {
      console.log(`[Wavely RT] Metadata received — transaction_key=${data.transaction_key}`);
    } else {
      console.log(`[Wavely RT] Unknown message type: ${JSON.stringify(data).slice(0, 200)}`);
    }
  });

  liveClient.on("error", (err: any) => {
    console.error("[Wavely RT] WebSocket error:", typeof err === "object" ? JSON.stringify(err) : err);
  });

  liveClient.on("close", (code: any) => {
    console.log(`[Wavely RT] WebSocket closed — code=${code?.code ?? code} wasClean=${code?.wasClean} reason=${code?.reason ?? "N/A"}`);
  });

  console.log("[Wavely RT] Calling liveClient.connect()...");
  liveClient.connect();
  console.log("[Wavely RT] Waiting for open...");
  await liveClient.waitForOpen();
  console.log("[Wavely RT] WebSocket ready — readyState=" + liveClient.readyState);
}

export function sendRealtimeChunk(buffer: ArrayBuffer): void {
  if (liveClient && liveSocketReady && liveClient.readyState === 1) {
    realtimeChunkCount++;
    if (realtimeChunkCount === 1) {
      console.log(`[Wavely RT] First chunk sent — ${buffer.byteLength} bytes`);
    }
    liveClient.sendMedia(Buffer.from(buffer));
  } else if (liveClient && !liveSocketReady) {
    earlyChunkBuffer.push(buffer);
    if (earlyChunkBuffer.length === 1 || earlyChunkBuffer.length % 10 === 0) {
      console.log(`[Wavely RT] Chunk buffered — ${earlyChunkBuffer.length} chunks waiting for WebSocket open`);
    }
  } else if (!liveClient) {
    console.log("[Wavely RT] Chunk dropped — liveClient is null");
  } else {
    console.log(`[Wavely RT] Chunk dropped — readyState=${liveClient.readyState} (expected 1)`);
  }
}

export function stopRealtimeTranscription(): Promise<string> {
  console.log(`[Wavely RT] Stopping — chunks_sent=${realtimeChunkCount} messages_received=${realtimeMessageCount} transcript_len=${realtimeTranscript.length}`);

  return new Promise((resolve) => {
    if (!liveClient) {
      console.log("[Wavely RT] No active connection — resolving with empty.");
      resolve(realtimeTranscript.trim());
      return;
    }

    const sock = liveClient;

    sock.on("close", () => {
      const final = realtimeTranscript.trim();
      console.log(`[Wavely RT] Close handler — final transcript: "${final.slice(0, 100)}" (${final.length} chars)`);
      liveClient = null;
      realtimeTranscript = "";
      realtimeChunkCount = 0;
      realtimeMessageCount = 0;
      earlyChunkBuffer.length = 0;
      liveSocketReady = false;
      resolve(final);
    });

    console.log(`[Wavely RT] Pre-close snapshot — transcript: "${realtimeTranscript.trim().slice(-80)}"`);
    console.log("[Wavely RT] Sending CloseStream...");
    sock.sendCloseStream();
    setTimeout(() => {
      if (liveClient === sock) {
        console.log("[Wavely RT] Force-closing after 1500ms timeout.");
        sock.close();
      }
    }, 1500);
  });
}
