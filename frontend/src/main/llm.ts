import { net } from "electron";

const SYSTEM_PROMPTS: Record<string, string> = {
  de: `Korrigiere den folgenden Text: Behebe Fehler in Rechtschreibung und Zeichensetzung.
- Konvertiere ausgesprochene Satzzeichen ("komma" -> ",", "neue zeile" -> "\n").
- Normalisiere Einheiten (mmHG->mmHg).
- Gib NUR den korrigierten Text aus.`,
  en: `Correct the following text: fix spelling and punctuation.
- Convert spoken punctuation ("comma" -> ",", "new line" -> "\n").
- Normalize units (mmHG->mmHg).
- Output ONLY the corrected text.`,
};

export async function correctTranscript(
  text: string,
  language: string,
  apiKey: string,
): Promise<string> {
  if (!text.trim()) return text;

  const sysPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS["en"];

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: "POST",
      url: "https://api.openai.com/v1/chat/completions",
    });

    request.setHeader("Content-Type", "application/json");
    request.setHeader("Authorization", `Bearer ${apiKey}`);

    let body = "";

    request.on("response", (response) => {
      response.on("data", (chunk) => {
        body += chunk.toString();
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          return reject(new Error(`LLM Error: ${body}`));
        }
        try {
          const json = JSON.parse(body);
          resolve(json.choices[0].message.content.trim());
        } catch (e) {
          reject(e);
        }
      });
    });

    request.on("error", (error) => reject(error));

    request.write(
      JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: text },
        ],
        temperature: 0,
      }),
    );

    request.end();
  });
}
