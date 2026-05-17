require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/api/get-deepgram-key", async (_req, res) => {
  const apiKey = process.env["DEEPGRAM_API_KEY"];
  const projectId = process.env["DEEPGRAM_PROJECT_ID"];

  if (!apiKey || !projectId || apiKey === "your_key_here" || projectId === "your_project_id_here") {
    console.error("[Wavely Backend] Deepgram credentials not configured.");
    return res.status(500).json({ error: "Deepgram credentials not configured." });
  }

  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "Wavely Client Key",
          scopes: ["member"],
          time_to_live_in_seconds: 21600,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Wavely Backend] Deepgram API error (${response.status}): ${text}`);
      return res.status(500).json({ error: "Failed to generate temporary key." });
    }

    const data = await response.json();
    const tempKey = data.api_key;

    if (!tempKey) {
      console.error("[Wavely Backend] No api_key in Deepgram response:", JSON.stringify(data));
      return res.status(500).json({ error: "No API key in response." });
    }

    console.log("[Wavely Backend] Temporary key generated successfully.");
    res.json({ api_key: tempKey });
  } catch (err) {
    console.error("[Wavely Backend] Error contacting Deepgram:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.listen(PORT, () => {
  console.log(`[Wavely Backend] Running on http://localhost:${PORT}`);
});
