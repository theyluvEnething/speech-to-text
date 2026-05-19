export async function getApiKey(): Promise<string> {
  const key = await window.audio.getApiKey();
  if (!key) {
    throw new Error(
      "OpenAI API key not configured. Set OPENAI_API_KEY in your environment.",
    );
  }
  return key;
}
