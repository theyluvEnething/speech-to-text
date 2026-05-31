import { app, ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import { randomUUID } from "crypto";
import { updateHotkey } from "./hotkey";
import { getSettingsWindow, getOverlayWindow, toggleOverlayTransparency } from "./windows";

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
  provider: string;
  copyToClipboard: boolean;
  appLanguage: string;
  theme: string;
  isPaused: boolean;
  hidePill: boolean;
  debugProximity: boolean;
  profiles: Profile[];
  activeProfileId: string;
  recentProfileIds: string[];
  conversations: Conversation[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    hotkey: "ctrlright",
    language: "auto",
    model: "whisper-large-v3-turbo",
    provider: "groq",
    copyToClipboard: false,
    appLanguage: "en",
    theme: "light",
    isPaused: false,
    hidePill: false,
    debugProximity: false,
    profiles: [
      {
        id: "default",
        name: "Default",
        color: "#10b981",
        icon: "🌎",
        systemPrompt: "",
      },
    ],
    activeProfileId: "default",
    recentProfileIds: ["default"],
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
  if (conversations.length > 500) {
    conversations.length = 500;
  }
  store.set("conversations", conversations);

  const win = getSettingsWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send("conversations:new", conv);
  }
}

function uuid(): string {
  return randomUUID();
}

export function registerIpcHandlers(
  onAudioBuffer: (buffer: ArrayBuffer) => void,
  onLevels: (data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => void,
  onOverlayIdle: () => void,
): void {
  // ── Settings ──────────────────────────────────────────────
  ipcMain.handle("settings:get", () => {
    return {
      hotkey: store.get("hotkey"),
      language: store.get("language"),
      model: store.get("model"),
      provider: store.get("provider"),
      copyToClipboard: store.get("copyToClipboard"),
      appLanguage: store.get("appLanguage"),
      theme: store.get("theme"),
      hidePill: store.get("hidePill"),
    };
  });

  ipcMain.handle("settings:set", (_event, settings: Record<string, string | boolean>) => {
    if (typeof settings['hotkey'] === "string" && settings['hotkey'] !== store.get("hotkey")) {
      store.set("hotkey", settings['hotkey']);
      updateHotkey(settings['hotkey']);
    }

    if (typeof settings['language'] === "string") {
      store.set("language", settings['language']);
    }

    if (typeof settings['model'] === "string") {
      store.set("model", settings['model']);
    }

    if (typeof settings['provider'] === "string") {
      store.set("provider", settings['provider']);
    }

    if (typeof settings['copyToClipboard'] === "boolean") {
      store.set("copyToClipboard", settings['copyToClipboard']);
    }

    if (typeof settings['appLanguage'] === "string") {
      store.set("appLanguage", settings['appLanguage']);
    }

    if (typeof settings['theme'] === "string") {
      store.set("theme", settings['theme']);
      const overlay = getOverlayWindow();
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send("overlay:theme-changed", settings['theme']);
      }
    }

    if (typeof settings['hidePill'] === "boolean") {
      store.set("hidePill", settings['hidePill']);
      const overlay = getOverlayWindow();
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send("overlay:hide-pill-changed", settings['hidePill']);
      }
      const settingsWin = getSettingsWindow();
      if (settingsWin && !settingsWin.isDestroyed()) {
        settingsWin.webContents.send("settings:hide-pill-changed", settings['hidePill']);
      }
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

  ipcMain.on("settings:minimize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      console.log("[Wavely] Settings window minimized.");
      win.minimize();
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
    if (profile.id === "default") {
      const existing = store.get("profiles").find((p) => p.id === "default");
      if (existing && (existing.name !== profile.name || existing.icon !== profile.icon || existing.color !== profile.color || existing.systemPrompt !== profile.systemPrompt)) {
        throw new Error("Default profile cannot be modified.");
      }
    }
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
    if (id === "default") {
      throw new Error("Default profile cannot be deleted.");
    }
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
      const recents = store.get("recentProfileIds");
      const updated = [id, ...recents.filter((r) => r !== id)].slice(0, 3);
      store.set("recentProfileIds", updated);
      console.log(`[Wavely] Active profile set: ${id}`);
    }
  });

  ipcMain.handle("profiles:getRecent", () => {
    return store.get("recentProfileIds");
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

  ipcMain.handle("overlay:getActiveProfile", () => {
    return getActiveProfile();
  });

  ipcMain.handle("overlay:toggleTransparency", (_event, transparent: boolean) => {
    toggleOverlayTransparency(transparent);
  });

  // ── Theme sync to overlay ─────────────────────────────
  ipcMain.handle("overlay:getTheme", () => {
    return store.get("theme") || "dark";
  });

  // ── Audio ─────────────────────────────────────────────────
  ipcMain.on("audio:buffer", (_event, buffer: ArrayBuffer) => {
    console.log(`[Wavely] Audio buffer received: ${buffer.byteLength} bytes`);
    onAudioBuffer(buffer);
  });

  ipcMain.on("audio:levels", (_event, data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => {
    onLevels(data);
  });

  // ── App state ─────────────────────────────────────────────
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });

  ipcMain.handle("debug:getProximity", () => {
    return store.get("debugProximity");
  });

  ipcMain.handle("debug:toggleProximity", () => {
    const next = !store.get("debugProximity");
    store.set("debugProximity", next);
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("overlay:debug-proximity-changed", next);
    }
    return next;
  });

  ipcMain.handle("app:getPaused", () => {
    return store.get("isPaused");
  });

  ipcMain.handle("app:togglePaused", () => {
    const paused = !store.get("isPaused");
    store.set("isPaused", paused);
    return paused;
  });

  ipcMain.handle("app:fullReset", () => {
    store.set({
      hotkey: "ctrlright",
      language: "auto",
      model: "whisper-large-v3-turbo",
      provider: "groq",
      copyToClipboard: false,
      appLanguage: "en",
      isPaused: false,
      hidePill: false,
      debugProximity: false,
      profiles: [
        {
          id: "default",
          name: "Default",
          color: "#10b981",
          icon: "🌎",
          systemPrompt: "",
        },
      ],
      activeProfileId: "default",
      recentProfileIds: ["default"],
      conversations: [],
    });
    console.log("[Wavely] Full reset: all data restored to defaults.");

    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.webContents.send("app:reset");
    }
    const settingsWin = getSettingsWindow();
    if (settingsWin && !settingsWin.isDestroyed()) {
      settingsWin.webContents.send("app:reset");
    }

    return { success: true };
  });
}

export { uuid };
