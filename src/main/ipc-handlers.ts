import { ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import { updateHotkey } from "./hotkey";

interface Profile {
  id: string;
  name: string;
  color: string;
  icon: string;
  systemPrompt: string;
  language?: string;
  model?: string;
}

interface Conversation {
  id: string;
  text: string;
  language: string;
  model: string;
  profileId: string;
  durationSec: number;
  createdAt: number;
}

interface StoreSchema {
  hotkey: string;
  language: string;
  model: string;
  modelTier: string;
  profiles: Profile[];
  activeProfileId: string;
  conversations: Conversation[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    hotkey: "alt",
    language: "en",
    model: "nova-2",
    modelTier: "",
    profiles: [
      {
        id: "default",
        name: "Default",
        color: "#10b981",
        icon: "🎙️",
        systemPrompt: "",
      },
    ],
    activeProfileId: "default",
    conversations: [],
  },
});

export function getActiveProfile(): Profile {
  const profiles = store.get("profiles");
  const activeId = store.get("activeProfileId");
  const profile = profiles.find((p) => p.id === activeId);
  return profile ?? profiles[0]!;
}

export function saveConversation(conv: Conversation): void {
  const conversations = store.get("conversations");
  conversations.unshift(conv);
  // Keep only the last 500 conversations
  if (conversations.length > 500) {
    conversations.length = 500;
  }
  store.set("conversations", conversations);
}

let v4: () => string;
function uuid(): string {
  if (!v4) {
    try {
      v4 = require("uuid").v4;
    } catch {
      v4 = () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
    }
  }
  return v4();
}

export function registerIpcHandlers(
  onAudioBuffer: (buffer: ArrayBuffer) => void,
  onLevels: (data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => void,
  onOverlayIdle: () => void,
): void {
  // ── Settings ──────────────────────────────────────────────
  ipcMain.handle("settings:get", () => {
    const settings = {
      hotkey: store.get("hotkey"),
      language: store.get("language"),
      model: store.get("model"),
      modelTier: store.get("modelTier"),
    };
    console.log(`[Wavely] Settings loaded: hotkey=${settings.hotkey}, language=${settings.language}, model=${settings.model}${settings.modelTier ? `-${settings.modelTier}` : ""}`);
    return settings;
  });

  ipcMain.handle("settings:set", (_event, settings: Record<string, string>) => {
    const oldHotkey = store.get("hotkey");

    if (settings['hotkey'] !== undefined && settings['hotkey'] !== oldHotkey) {
      store.set("hotkey", settings['hotkey']);
      updateHotkey(settings['hotkey']);
      console.log(`[Wavely] Hotkey saved: ${oldHotkey} -> ${settings['hotkey']}`);
    }

    if (settings['language'] !== undefined) {
      store.set("language", settings['language']);
    }

    if (settings['model'] !== undefined) {
      store.set("model", settings['model']);
      console.log(`[Wavely] Model saved: ${settings['model']}`);
    }

    if (settings['modelTier'] !== undefined) {
      store.set("modelTier", settings['modelTier']);
      console.log(`[Wavely] Model tier saved: ${settings['modelTier'] || "default"}`);
    }

    return { success: true };
  });

  ipcMain.on("settings:hide", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      console.log("[Wavely] Settings window hidden to tray.");
      win.hide();
    }
  });

  ipcMain.on("settings:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    console.log("[Wavely] Settings window closed.");
    win?.close();
  });

  // ── Profiles ──────────────────────────────────────────────
  ipcMain.handle("profiles:list", () => {
    return store.get("profiles");
  });

  ipcMain.handle("profiles:upsert", (_event, profile: Profile) => {
    const profiles = store.get("profiles");
    const idx = profiles.findIndex((p) => p.id === profile.id);

    if (idx >= 0) {
      profiles[idx] = profile;
    } else {
      profiles.push(profile);
    }

    store.set("profiles", profiles);
    console.log(`[Wavely] Profile saved: ${profile.name}`);
    return profiles;
  });

  ipcMain.handle("profiles:delete", (_event, id: string) => {
    let profiles = store.get("profiles");
    if (profiles.length <= 1) {
      throw new Error("Cannot delete the last profile.");
    }
    const deleted = profiles.find((p) => p.id === id);
    profiles = profiles.filter((p) => p.id !== id);

    // If the deleted profile was active, switch to the first remaining
    if (store.get("activeProfileId") === id) {
      store.set("activeProfileId", profiles[0]!.id);
    }

    store.set("profiles", profiles);
    console.log(`[Wavely] Profile deleted: ${deleted?.name ?? id}`);
    return profiles;
  });

  ipcMain.handle("profiles:getActive", () => {
    return getActiveProfile();
  });

  ipcMain.handle("profiles:setActive", (_event, id: string) => {
    const profiles = store.get("profiles");
    if (profiles.some((p) => p.id === id)) {
      store.set("activeProfileId", id);
      console.log(`[Wavely] Active profile set: ${id}`);
    }
  });

  // ── Conversations ─────────────────────────────────────────
  ipcMain.handle("conversations:list", () => {
    return store.get("conversations");
  });

  ipcMain.handle("conversations:delete", (_event, id: string) => {
    const conversations = store.get("conversations").filter((c) => c.id !== id);
    store.set("conversations", conversations);
    console.log(`[Wavely] Conversation deleted: ${id}`);
    return conversations;
  });

  ipcMain.handle("conversations:clear", () => {
    store.set("conversations", []);
    console.log("[Wavely] All conversations cleared.");
  });

  // ── Overlay ───────────────────────────────────────────────
  ipcMain.on("overlay:idle", () => {
    onOverlayIdle();
  });

  // ── Audio ─────────────────────────────────────────────────
  ipcMain.on("audio:buffer", (_event, buffer: ArrayBuffer) => {
    console.log(`[Wavely] Audio buffer received: ${buffer.byteLength} bytes`);
    onAudioBuffer(buffer);
  });

  ipcMain.on("audio:levels", (_event, data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => {
    onLevels(data);
  });
}

export { uuid };
