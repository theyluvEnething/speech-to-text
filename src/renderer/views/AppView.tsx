import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const APP_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Espanol" },
  { value: "ja", label: "日本語" },
];

function AppView(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [appLanguage, setAppLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        const lang = settings.appLanguage || "en";
        setAppLanguage(lang);
        i18n.changeLanguage(lang);
        setLoading(false);
        initialLoad.current = false;
      })
      .catch((err) => {
        console.error("[Wavely] Failed to load app settings:", err);
        setLoading(false);
        initialLoad.current = false;
      });
  }, []);

  function save(updated: Record<string, string | boolean>): void {
    window.wavely
      .setSettings(updated)
      .then(() => {
        toast(t("appSettings.preferencesSaved", "Preferences saved"));
      })
      .catch((err) => {
        console.error("[Wavely] Failed to save settings:", err);
      });
  }

  function handleReset(): void {
    window.wavely
      .setSettings({
        hotkey: "ctrlright",
        language: "auto",
        model: "nova-2",
        modelTier: "",
        copyToClipboard: true,
        appLanguage: "en",
      })
      .then(() => {
        setAppLanguage("en");
        i18n.changeLanguage("en");
        toast(t("appSettings.resetDone", "Settings reset to defaults"));
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : t("appSettings.resetFailed", "Failed to reset settings"));
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
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground/98">{t("appSettings.title", "App")}</h2>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              {t("appSettings.language", "Language")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">{t("appSettings.appLanguage", "App language")}</label>
            <Select
              value={appLanguage}
              onValueChange={(v) => {
                setAppLanguage(v);
                i18n.changeLanguage(v);
                if (!initialLoad.current) save({ appLanguage: v });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              {t("appSettings.account", "Account")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <span className="text-sm text-foreground/70">U</span>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
                  {t("appSettings.loggedIn", "Logged in")}
                </p>
                <p className="text-[12px] text-foreground/45">
                  {t("appSettings.localSession", "Local session")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Reset at very bottom */}
      <div className="shrink-0 pt-4 pb-2">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] text-foreground/70">
                {t("appSettings.aboutText", "Wavely v1.0.0 — Push-to-talk speech-to-text powered by Deepgram.")}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleReset}>
              {t("appSettings.resetToDefaults", "Reset to defaults")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AppView;
