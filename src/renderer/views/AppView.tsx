import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const APP_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
];

function AppView(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [appLanguage, setAppLanguage] = useState("en");
  const [copyToClipboard, setCopyToClipboard] = useState(true);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        const lang = settings.appLanguage || "en";
        setAppLanguage(lang);
        i18n.changeLanguage(lang);
        setCopyToClipboard(settings.copyToClipboard !== false);
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
        toast("Preferences saved");
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
        setCopyToClipboard(true);
        toast("Settings reset to defaults");
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : "Failed to reset settings");
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
        <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-foreground/98">App</h2>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {/* Language */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Language
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">App language</label>
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

        {/* Account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                <span className="text-sm text-foreground/70">U</span>
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
                  Logged in
                </p>
                <p className="text-[12px] text-foreground/45">
                  Local session
                </p>
              </div>
            </div>
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
            <Button variant="destructive" size="sm" onClick={handleReset}>
              Reset to defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AppView;
