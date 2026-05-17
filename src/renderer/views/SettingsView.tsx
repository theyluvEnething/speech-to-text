import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

const SENTINEL = "__global__";

const NOVA2_TIERS = [
  { value: SENTINEL, label: "Standard (nova-2)" },
  { value: "general", label: "General (nova-2-general)" },
  { value: "medical", label: "Medical (nova-2-medical)" },
  { value: "meeting", label: "Meeting (nova-2-meeting)" },
];

function SettingsView(): React.ReactElement {
  const activeProfile = useStore((s) => s.activeProfile);
  const profileLanguage = activeProfile?.language;
  const isLanguageOverridden = !!profileLanguage;

  const languageLabel = LANGUAGES.find((l) => l.value === profileLanguage)?.label;

  const [hotkey, setHotkey] = useState("alt");
  const [language, setLanguage] = useState("en");
  const [modelTier, setModelTier] = useState("");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        setHotkey(settings.hotkey || "alt");
        setLanguage(settings.language || "en");
        setModelTier(settings.modelTier || "");
        setLoading(false);
        initialLoad.current = false;
      })
      .catch((err) => {
        console.error("[Wavely] Failed to load settings:", err);
        setLoading(false);
        initialLoad.current = false;
      });
  }, []);

  function save(updated: Record<string, string>): void {
    window.wavely
      .setSettings({ model: "nova-2", ...updated })
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

        {/* Transcription */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Transcription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">Model tier</label>
            <Select
              value={modelTier || SENTINEL}
              onValueChange={(v) => {
                const tier = v === SENTINEL ? "" : v;
                setModelTier(tier);
                if (!initialLoad.current) save({ modelTier: tier });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOVA2_TIERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[12px] text-foreground/45">
              Domain-specific models optimize for medical or meeting scenarios.
            </p>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13px] text-foreground/70">
              Wavely v1.0.0 — Push-to-talk speech-to-text powered by Deepgram.
            </p>
            <Button variant="outline" size="sm">
              Reset to defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SettingsView;
