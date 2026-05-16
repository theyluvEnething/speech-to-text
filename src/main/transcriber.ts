import { DeepgramClient } from "@deepgram/sdk";

let deepgram: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!deepgram) {
    const apiKey = process.env['DEEPGRAM_API_KEY'];
    if (!apiKey || apiKey === "your_key_here") {
      throw new Error("Deepgram API key not configured. Set DEEPGRAM_API_KEY in .env file.");
    }
    deepgram = new DeepgramClient({ apiKey });
  }
  return deepgram;
}

function buildModelName(model: string, modelTier: string): string {
  if (!modelTier) return model;
  return `${model}-${modelTier}`;
}

export async function transcribe(
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

  if (!transcript) {
    return "";
  }

  return transcript.trim();
}
