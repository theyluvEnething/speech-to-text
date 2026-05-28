import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const HOTKEYS = [
  { value: "alt", label: "Alt (Left)" },
  { value: "altright", label: "Alt (Right)" },
  { value: "ctrl", label: "Ctrl (Left)" },
  { value: "ctrlright", label: "Ctrl (Right)" },
  { value: "shift", label: "Shift (Left)" },
  { value: "shiftright", label: "Shift (Right)" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "auto", label: "Auto-detect" },
];

const PROVIDERS = [
  { value: "backend", label: "Backend" },
  { value: "deepgram", label: "Deepgram" },
  { value: "groq", label: "Groq" },
  { value: "openai", label: "OpenAI" },
];

const MODELS_BY_PROVIDER: Record<string, readonly { value: string; label: string }[]> = {
  backend: [
    { value: "whisper-large-v3", label: "Whisper Large V3" },
  ],
  deepgram: [
    { value: "nova-2", label: "Nova-2" },
    { value: "nova-2-general", label: "Nova-2 General" },
  ],
  groq: [
    { value: "whisper-large-v3-turbo", label: "Whisper Large V3 Turbo" },
    { value: "whisper-large-v3", label: "Whisper Large V3" },
  ],
  openai: [],
};

function SettingsView(): React.ReactElement {
  const activeProfile = useStore((s) => s.activeProfile);
  const profileLanguage = activeProfile?.language;
  const isLanguageOverridden = !!profileLanguage;

  const languageLabel = LANGUAGES.find((l) => l.value === profileLanguage)?.label;

  const [hotkey, setHotkey] = useState("alt");
  const [language, setLanguage] = useState("en");
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("whisper-large-v3-turbo");
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        setHotkey(settings.hotkey || "alt");
        setLanguage(settings.language || "en");
        setProvider(settings.provider || "groq");
        setModel(settings.model || "whisper-large-v3-turbo");
        setCopyToClipboard(settings.copyToClipboard === true);
        setLoading(false);
        initialLoad.current = false;
      })
      .catch((err) => {
        console.error("[Wavely] Failed to load settings:", err);
        setLoading(false);
        initialLoad.current = false;
      });
  }, []);

  function save(updated: Record<string, string | boolean>): void {
    window.wavely
      .setSettings(updated)
      .then(() => {
        toast("Preferences saved");
      })
      .catch((err) => {
        console.error("[Wavely] Failed to save settings:", err);
      });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-muted border-t-foreground/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground/98">Settings</h2>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Recording */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Recording
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">Push-to-talk key</label>
              <Select
                value={hotkey}
                onValueChange={(v) => {
                  setHotkey(v);
                  if (!initialLoad.current) save({ hotkey: v });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOTKEYS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-foreground/45">
                Hold this key while speaking, release to transcribe.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">Language</label>
              <Select
                value={language}
                onValueChange={(v) => {
                  setLanguage(v);
                  if (!initialLoad.current) save({ language: v });
                }}
                disabled={isLanguageOverridden}
              >
                <SelectTrigger className={isLanguageOverridden ? "w-full opacity-50 cursor-not-allowed" : "w-full"}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLanguageOverridden && (
                <p className="text-[12px] text-foreground/50">
                  Language overridden by profile &quot;{activeProfile?.name ?? ""}&quot; ({languageLabel ?? profileLanguage})
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clipboard */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Clipboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
                  Copy to clipboard
                </p>
                <p className="text-[12px] text-foreground/45 mt-0.5">
                  Automatically copy and paste transcribed text.
                </p>
              </div>
              <Switch
                checked={copyToClipboard}
                onCheckedChange={(v) => {
                  setCopyToClipboard(v);
                  if (!initialLoad.current) save({ copyToClipboard: v });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transcription */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Transcription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">Provider</label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  setProvider(v);
                  const models = MODELS_BY_PROVIDER[v] ?? [];
                  if (models.length > 0 && !models.some((m) => m.value === model)) {
                    const newModel = models[0]!.value;
                    setModel(newModel);
                    if (!initialLoad.current) save({ provider: v, model: newModel });
                  } else {
                    if (!initialLoad.current) save({ provider: v });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[12px] text-foreground/45">
                Select the transcription service provider.
              </p>
            </div>

            {provider !== "openai" ? (
              <div className="space-y-2">
                <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">Model</label>
                <Select
                  value={model}
                  onValueChange={(v) => {
                    setModel(v);
                    if (!initialLoad.current) save({ model: v });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(MODELS_BY_PROVIDER[provider] ?? []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-[12px] text-foreground/45">
                OpenAI provider is not yet implemented. Select another provider.
              </p>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default SettingsView;
