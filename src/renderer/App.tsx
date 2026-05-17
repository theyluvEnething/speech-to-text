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

const NOVA2_TIERS = [
  { value: "", label: "Standard (nova-2)" },
  { value: "general", label: "General (nova-2-general)" },
  { value: "medical", label: "Medical (nova-2-medical)" },
  { value: "meeting", label: "Meeting (nova-2-meeting)" },
];

function Select({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}): React.ReactElement {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-surface-400 mb-2.5"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className="w-full appearance-none bg-surface-800/60 border border-surface-700/80
            rounded-xl px-4 py-3 pr-10 text-sm text-white
            focus:outline-none focus:border-accent/70 focus:bg-surface-800/80
            hover:border-surface-600/80
            transition-all duration-200 cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface-800 text-white">
              {o.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="text-surface-500 group-hover:text-surface-400 transition-colors"
          >
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {description && (
        <p className="mt-2 text-[11px] text-surface-600 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

function App(): React.ReactElement {
  const [hotkey, setHotkey] = useState("alt");
  const [language, setLanguage] = useState("en");
  const [modelTier, setModelTier] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const initialLoad = useRef(true);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    window.whisper
      .getSettings()
      .then((settings) => {
        setHotkey(settings.hotkey || "alt");
        setLanguage(settings.language || "en");
        setModelTier(settings.modelTier || "");
        setLoading(false);
        initialLoad.current = false;
      })
      .catch((err) => {
        console.error("[Wavely UI] Failed to load settings:", err);
        setLoading(false);
        initialLoad.current = false;
      });
  }, []);

  function save(updated: Record<string, string>): void {
    window.whisper
      .setSettings({ model: "nova-2", ...updated })
      .then(() => {
        const entries = Object.entries(updated).map(([k, v]) => `${k}=${v}`);
        console.log(`[Wavely UI] Saved: ${entries.join(", ")}`);
        setSaved(true);
        clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => setSaved(false), 1800);
      })
      .catch((err) => {
        console.error("[Wavely UI] Failed to save settings:", err);
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

  function handleModelTierChange(e: ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    setModelTier(value);
    if (!initialLoad.current) save({ modelTier: value });
  }

  function hideWindow(): void {
    window.whisper.hideWindow();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-950">
        <div className="relative">
          <div className="w-8 h-8 rounded-full border-2 border-surface-800 border-t-accent animate-spin" />
          <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-950 select-none">
      {/* Header */}
      <header className="drag-region relative flex items-center justify-between h-14 px-5">
        <div className="flex items-center gap-3 no-drag">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-lg shadow-accent/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Wavely</h1>
            <p className="text-[10px] text-surface-500 tracking-wide">Voice to text, anywhere</p>
          </div>
        </div>

        <div className="flex items-center gap-2 no-drag">
          {saved && (
            <span className="text-[10px] font-medium text-accent-light animate-in fade-in">
              Saved
            </span>
          )}
          <button
            onClick={hideWindow}
            className="flex items-center justify-center w-7 h-7 rounded-lg
              text-surface-500 hover:text-white hover:bg-surface-800/80
              active:scale-95 transition-all duration-150"
            aria-label="Hide to tray"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 7h12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Divider with gradient */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-surface-800 to-transparent" />

      {/* Body */}
      <main className="flex-1 px-5 py-6 space-y-6 no-drag overflow-y-auto">
        <Select
          label="Push-to-Talk Key"
          description="Hold this key while speaking, release to transcribe and paste."
          value={hotkey}
          options={HOTKEYS}
          onChange={handleHotkeyChange}
        />

        <Select
          label="Language"
          value={language}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
          onChange={handleLanguageChange}
        />

        <Select
          label="Model Tier"
          description="Domain-specific models optimize accuracy for medical or meeting scenarios."
          value={modelTier}
          options={NOVA2_TIERS}
          onChange={handleModelTierChange}
        />
      </main>

      {/* Done button */}
      <div className="px-5 pb-3 no-drag">
        <button
          onClick={hideWindow}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all
            bg-accent hover:bg-accent-dark text-white
            active:scale-[0.98]"
        >
          Done
        </button>
      </div>

      {/* Footer */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-surface-800 to-transparent" />
      <footer className="flex items-center justify-between px-5 py-3.5 no-drag">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
          <span className="text-[10px] font-medium text-surface-600 tracking-wide">Running</span>
        </div>
        <span className="text-[10px] text-surface-700 tabular-nums">v1.0.0</span>
      </footer>
    </div>
  );
}

export default App;
