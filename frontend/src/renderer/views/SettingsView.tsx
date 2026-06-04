import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function SettingsView(): React.ReactElement {
  const { t } = useTranslation();

  const HOTKEYS = [
    { value: "alt", label: `${t("hotkeys.alt")} (${t("hotkeys.left")})` },
    { value: "altright", label: `${t("hotkeys.alt")} (${t("hotkeys.right")})` },
    { value: "ctrl", label: `${t("hotkeys.ctrl")} (${t("hotkeys.left")})` },
    { value: "ctrlright", label: `${t("hotkeys.ctrl")} (${t("hotkeys.right")})` },
    { value: "shift", label: `${t("hotkeys.shift")} (${t("hotkeys.left")})` },
    { value: "shiftright", label: `${t("hotkeys.shift")} (${t("hotkeys.right")})` },
  ];

  const LANGUAGES = [
    { value: "en", label: t("languages.en") },
    { value: "de", label: t("languages.de") },
    { value: "fr", label: t("languages.fr") },
    { value: "es", label: t("languages.es") },
    { value: "it", label: t("languages.it") },
    { value: "ja", label: t("languages.ja") },
    { value: "ko", label: t("languages.ko") },
    { value: "zh", label: t("languages.zh") },
    { value: "auto", label: t("languages.auto") },
  ];

  const PROVIDERS = [
    { value: "deepgram", label: t("providers.deepgram") },
    { value: "groq", label: t("providers.groq") },
    { value: "openai", label: t("providers.openai") },
    { value: "xai", label: t("providers.xai") },
  ];

  const MODELS_BY_PROVIDER: Record<string, readonly { value: string; label: string }[]> = {
    deepgram: [
      { value: "nova-2", label: t("models.nova-2") },
      { value: "nova-2-general", label: t("models.nova-2-general") },
    ],
    groq: [
      { value: "whisper-large-v3-turbo", label: t("models.whisper-large-v3-turbo") },
      { value: "whisper-large-v3", label: t("models.whisper-large-v3") },
    ],
    openai: [
      { value: "gpt-4o-transcribe", label: t("models.gpt-4o-transcribe") },
      { value: "gpt-4o-mini-transcribe", label: t("models.gpt-4o-mini-transcribe") },
      { value: "whisper-1", label: t("models.whisper-1") },
    ],
    xai: [
      { value: "grok-voice-latest", label: t("models.grok-voice-latest") },
    ],
  };

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
        toast(t("settings.preferencesSaved"));
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
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground/98">{t("settings.title")}</h2>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Recording */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              {t("settings.recording")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">{t("settings.pushToTalkKey")}</label>
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
                {t("settings.pushToTalkHint")}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">{t("settings.language")}</label>
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
                  {t("settings.languageOverridden")} &quot;{activeProfile?.name ?? ""}&quot; ({languageLabel ?? profileLanguage})
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
                  {t("settings.copyToClipboard")}
                </p>
                <p className="text-[12px] text-foreground/45 mt-0.5">
                  {t("settings.copyToClipboardHint")}
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
              {t("settings.transcription")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">{t("settings.provider")}</label>
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
                {t("settings.providerHint")}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">{t("settings.model")}</label>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SettingsView;
