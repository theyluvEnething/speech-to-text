import React, { useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";

const HOTKEYS = [
  { value: "alt", label: "Alt (Left)" },
  { value: "altright", label: "Alt (Right)" },
  { value: "ctrl", label: "Ctrl (Left)" },
  { value: "ctrlright", label: "Ctrl (Right)" },
  { value: "shift", label: "Shift (Left)" },
  { value: "shiftright", label: "Shift (Right)" },
];
const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Francais" },
  { code: "es", name: "Espanol" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "auto", name: "Auto-detect" },
];

function App(): React.ReactElement {
  const [hotkey, setHotkey] = useState("alt");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.whisper.getSettings().then((settings) => {
      setHotkey(settings.hotkey || "alt");
      setLanguage(settings.language || "en");
      setLoading(false);
      initialLoad.current = false;
      console.log(`[Whisper UI] Loaded settings: hotkey=${settings.hotkey}, language=${settings.language}`);
    }).catch((err) => {
      console.error("[Whisper UI] Failed to load settings:", err);
      setLoading(false);
      initialLoad.current = false;
    });
  }, []);

  function save(updated: { hotkey?: string; language?: string }): void {
    window.whisper
      .setSettings(updated)
      .then(() => {
        const parts: string[] = [];
        if (updated.hotkey) parts.push(`hotkey=${updated.hotkey}`);
        if (updated.language) parts.push(`language=${updated.language}`);
        console.log(`[Whisper UI] Settings saved: ${parts.join(", ")}`);
      })
      .catch((err) => {
        console.error("[Whisper UI] Failed to save settings:", err);
      });
  }

  function handleHotkeyChange(e: ChangeEvent<HTMLSelectElement>): void {
    const newHotkey = e.target.value;
    setHotkey(newHotkey);
    if (!initialLoad.current) {
      save({ hotkey: newHotkey });
    }
  }

  function handleLanguageChange(e: ChangeEvent<HTMLSelectElement>): void {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    if (!initialLoad.current) {
      save({ language: newLanguage });
    }
  }

  function minimizeToTray(): void {
    console.log("[Whisper UI] Minimize to tray.");
    window.whisper.hideWindow();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-950">
        <div className="w-6 h-6 border-2 border-accent rounded-full animate-spin border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <header className="drag-region flex items-center justify-between h-12 px-4 border-b border-surface-800">
        <h1 className="text-sm font-semibold tracking-wide text-surface-400 no-drag">
          Whisper PTT
        </h1>
        <button
          onClick={minimizeToTray}
          className="no-drag flex items-center justify-center w-7 h-7 rounded-md
            text-surface-500 hover:text-white hover:bg-surface-800
            transition-colors focus:outline-none"
          aria-label="Minimize to tray"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 7h12" />
          </svg>
        </button>
      </header>

      <main className="flex-1 px-6 py-6 space-y-6 no-drag">
        <section>
          <label className="block text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">
            Push-to-Talk Key
          </label>
          <select
            value={hotkey}
            onChange={handleHotkeyChange}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
          >
            {HOTKEYS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-surface-500">
            Hold this key while speaking, release to transcribe.
          </p>
        </section>

        <section>
          <label className="block text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">
            Language
          </label>
          <select
            value={language}
            onChange={handleLanguageChange}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </section>

        <section>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-800/50 border border-surface-700/50">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-surface-500 shrink-0">
              <path d="M7 1v12M1 7h12" />
            </svg>
            <p className="text-xs text-surface-500">
              API key is configured via <code className="text-surface-400 bg-surface-800 px-1 rounded">.env</code> file.
            </p>
          </div>
        </section>

        <button
          onClick={minimizeToTray}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all
            bg-accent hover:bg-accent-dark text-white
            active:scale-[0.98]"
        >
          Minimize to Tray
        </button>
      </main>

      <footer className="px-6 py-3 border-t border-surface-800 text-center">
        <p className="text-xs text-surface-600">Whisper PTT v2.0.0</p>
      </footer>
    </div>
  );
}

export default App;
