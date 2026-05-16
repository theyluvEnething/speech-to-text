export function getApiKey(): string | undefined {
  const key = process.env['DEEPGRAM_API_KEY'];
  if (!key || key === "your_key_here") return undefined;
  return key;
}
