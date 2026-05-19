import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer"),
      "@transcription": resolve(__dirname, "src/transcription"),
      "@transcription/groq": resolve(__dirname, "src/transcription/groq"),
      "@transcription/openai": resolve(__dirname, "src/transcription/openai"),
      "@transcription/deepgram": resolve(__dirname, "src/transcription/deepgram"),
    },
  },
});
