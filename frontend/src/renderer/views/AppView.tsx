import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/clerk-react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const APP_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "es", label: "Espanol" },
  { value: "ja", label: "日本語" },
];

type UpdateStatus = "idle" | "checking" | "no-update" | "available" | "downloading" | "error";

function AppView(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const [appVersion, setAppVersion] = useState("1.0.0");
  const [appLanguage, setAppLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    window.wavely
      .getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => {});
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
        model: "whisper-large-v3-turbo",
        provider: "groq",
        copyToClipboard: false,
        appLanguage: "en",
      })
      .then(() => {
        setAppLanguage("en");
        i18n.changeLanguage("en");
        toast(t("appSettings.resetDone", "Settings reset to defaults"));
        setTimeout(() => window.location.reload(), 500);
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : t("appSettings.resetFailed", "Failed to reset settings"));
      });
  }

  const handleCheckForUpdates = useCallback(() => {
    setUpdateStatus("checking");
    setUpdateError(null);
    window.wavely
      .checkForUpdates()
      .then((result) => {
        if (result.available && result.version) {
          setUpdateStatus("available");
          setUpdateVersion(result.version);
          setConfirmOpen(true);
        } else if (result.error) {
          setUpdateStatus("error");
          setUpdateError(result.error);
        } else {
          setUpdateStatus("no-update");
        }
      })
      .catch((err) => {
        setUpdateStatus("error");
        setUpdateError(err instanceof Error ? err.message : "Unknown error");
      });
  }, []);

  const handleConfirmUpdate = useCallback(() => {
    setConfirmOpen(false);
    setUpdateStatus("downloading");
    window.wavely
      .downloadAndInstallUpdate()
      .catch((err) => {
        setUpdateStatus("error");
        setUpdateError(err instanceof Error ? err.message : "Download failed");
      });
  }, []);

  const handleCancelUpdate = useCallback(() => {
    setConfirmOpen(false);
    setUpdateStatus("idle");
  }, []);

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
            <div className="flex items-center justify-between">
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
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Updates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13px] text-foreground/70">Wavely v{appVersion}</p>
            {updateStatus === "no-update" && (
              <p className="text-[13px] text-emerald-500/90">You're up to date.</p>
            )}
            {updateStatus === "error" && (
              <p className="text-[13px] text-red-400/90">
                {updateError || "Failed to check for updates."}
              </p>
            )}
            {updateStatus === "downloading" && (
              <p className="text-[13px] text-foreground/60">Downloading update, the app will restart shortly...</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={updateStatus === "checking" || updateStatus === "downloading"}
            >
              {updateStatus === "checking" ? "Checking..." : "Check for Updates"}
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* Reset at very bottom */}
      <div className="shrink-0 pt-4 pb-2">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] text-foreground/70">
                {t("appSettings.aboutText", `Wavely v${appVersion} — Push-to-talk driven speech to text program.`)}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleReset}>
              {t("appSettings.resetToDefaults", "Reset to defaults")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Available</DialogTitle>
            <DialogDescription>
              Version {updateVersion} is available. You are currently on v{appVersion}.
              Would you like to update now? The app will restart to apply the update.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelUpdate}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpdate}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AppView;