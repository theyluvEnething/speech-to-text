// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "C:\\Users\\Enething\\Programmieren\\Projekte\\speech-to-text";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: {
          preload: resolve(__electron_vite_injected_dirname, "src/preload/preload.ts"),
          "preload-audio": resolve(__electron_vite_injected_dirname, "src/preload/preload-audio.ts"),
          "preload-overlay": resolve(__electron_vite_injected_dirname, "src/preload/preload-overlay.ts")
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    build: {
      outDir: resolve(__electron_vite_injected_dirname, "dist/renderer"),
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html"),
          overlay: resolve(__electron_vite_injected_dirname, "src/renderer/overlay.html"),
          audio: resolve(__electron_vite_injected_dirname, "src/renderer/audio.html")
        }
      }
    },
    resolve: {
      alias: {
        "@": resolve(__electron_vite_injected_dirname, "src/renderer")
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
