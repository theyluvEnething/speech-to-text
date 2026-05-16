import { DeepgramClient } from "@deepgram/sdk";

let deepgram: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!deepgram) {
    const apiKey = process.env['DEEPGRAM_API_KEY'];
    if (!apiKey || apiKey === "your_key_here") {
      throw new Error("Deepgram API key not configured. Set it in .env file.");
    }
    deepgram = new DeepgramClient({ apiKey });
  }
  return deepgram;
}

export async function transcribe(buffer: ArrayBuffer): Promise<string> {
  const client = getClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: any = await client.listen.v1.media.transcribeFile(
    Buffer.from(buffer),
    {
      model: "nova-2",
      smart_format: true,
      punctuate: true,
      utterances: true,
      mimetype: "audio/webm",
    } as any,
  );

  const transcript =
    response.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!transcript) {
    return "";
  }

  return transcript.trim();
}
