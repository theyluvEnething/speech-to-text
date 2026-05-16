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

const MODELS = [
  { value: "nova-2", label: "Nova-2" },
  { value: "nova", label: "Nova" },
  { value: "whisper", label: "Whisper Cloud" },
  { value: "enhanced", label: "Enhanced" },
  { value: "base", label: "Base" },
];

const NOVA2_TIERS = [
  { value: "", label: "Standard (nova-2)" },
  { value: "general", label: "General" },
  { value: "medical", label: "Medical" },
  { value: "meeting", label: "Meeting" },
];

const WHISPER_TIERS = [
  { value: "tiny", label: "Tiny" },
  { value: "base", label: "Base" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

function getTiers(model: string): { value: string; label: string }[] {
  if (model === "nova-2") return NOVA2_TIERS;
  if (model === "whisper") return WHISPER_TIERS;
  return [];
}

function App(): React.ReactElement {
  const [hotkey, setHotkey] = useState("alt");
  const [language, setLanguage] = useState("en");
  const [model, setModel] = useState("nova-2");
  const [modelTier, setModelTier] = useState("");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.whisper.getSettings().then((settings) => {
      setHotkey(settings.hotkey || "alt");
      setLanguage(settings.language || "en");
      setModel(settings.model || "nova-2");
      setModelTier(settings.modelTier || "");
      setLoading(false);
      initialLoad.current = false;
    }).catch((err) => {
      console.error("[Whisper UI] Failed to load settings:", err);
      setLoading(false);
      initialLoad.current = false;
    });
  }, []);

  function save(updated: Record<string, string>): void {
    window.whisper
      .setSettings(updated)
      .then(() => {
        const entries = Object.entries(updated).map(([k, v]) => `${k}=${v}`);
        console.log(`[Whisper UI] Saved: ${entries.join(", ")}`);
      })
      .catch((err) => {
        console.error("[Whisper UI] Failed to save settings:", err);
      });
  }

  function handleHotkeyChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setHotkey(value);
    if (!initialLoad.current) save({ hotkey: value });
  }

  function handleLanguageChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setLanguage(value);
    if (!initialLoad.current) save({ language: value });
  }

  function handleModelChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setModel(value);
    const tiers = getTiers(value);
    const newTier = tiers.length > 0 ? (tiers[0]?.value ?? "") : "";
    setModelTier(newTier);
    if (!initialLoad.current) {
      save({ model: value, modelTier: newTier });
    }
  }

  function handleModelTierChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setModelTier(value);
    if (!initialLoad.current) save({ modelTier: value });
  }

  function closeWindow(): void {
    window.whisper.closeWindow();
  }

  const tiers = getTiers(model);

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
          onClick={closeWindow}
          className="no-drag flex items-center justify-center w-7 h-7 rounded-md
            text-surface-500 hover:text-white hover:bg-surface-800
            transition-colors focus:outline-none"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 7h12" />
          </svg>
        </button>
      </header>

      <main className="flex-1 px-6 py-6 space-y-5 no-drag">
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
          <label className="block text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">
            Model
          </label>
          <select
            value={model}
            onChange={handleModelChange}
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-surface-500">
            Nova-2 is the fastest and most accurate model.
          </p>
        </section>

        {tiers.length > 0 && (
          <section>
            <label className="block text-xs font-medium text-surface-400 uppercase tracking-wider mb-2">
              {model === "whisper" ? "Whisper Size" : "Model Tier"}
            </label>
            <select
              value={modelTier}
              onChange={handleModelTierChange}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
            >
              {tiers.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {model === "whisper" && (
              <p className="mt-1.5 text-xs text-surface-500">
                Larger models are more accurate but slower.
              </p>
            )}
          </section>
        )}

        <button
          onClick={closeWindow}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all
            bg-accent hover:bg-accent-dark text-white
            active:scale-[0.98]"
        >
          Close
        </button>
      </main>

      <footer className="px-6 py-3 border-t border-surface-800 text-center">
        <p className="text-xs text-surface-600">Whisper PTT v2.0.0</p>
      </footer>
    </div>
  );
}

export default App;
