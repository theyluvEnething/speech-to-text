import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: {
          preload: resolve(__dirname, "src/preload/preload.ts"),
          "preload-audio": resolve(__dirname, "src/preload/preload-audio.ts"),
          "preload-overlay": resolve(__dirname, "src/preload/preload-overlay.ts"),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    root: resolve(__dirname, "src/renderer"),
    build: {
      outDir: resolve(__dirname, "dist/renderer"),
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
          overlay: resolve(__dirname, "src/renderer/overlay.html"),
          audio: resolve(__dirname, "src/renderer/audio.html"),
        },
      },
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
  },
});
