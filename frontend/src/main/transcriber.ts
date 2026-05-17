import { DeepgramClient } from "@deepgram/sdk";

let cachedKey: string | null = null;
let deepgram: DeepgramClient | null = null;

export async function fetchTemporaryKey(): Promise<string> {
  console.log("[Wavely] Fetching temporary Deepgram key from backend...");
  const response = await fetch("http://localhost:3000/api/get-deepgram-key");
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
      punctuate: true,
      utterances: true,
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
