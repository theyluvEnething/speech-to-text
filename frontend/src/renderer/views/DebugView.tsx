import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DebugView(): React.ReactElement {
  const { t } = useTranslation();
  const hidePill = useStore((s) => s.hidePill);
  const setHidePill = useStore((s) => s.setHidePill);

  const [debugProximity, setDebugProximity] = useState(false);
  const [backgroundOpaque, setBackgroundOpaque] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    window.wavely.getDebugProximity().then(setDebugProximity).catch(() => {});
  }, []);

  const handleHidePillToggle = useCallback((v: boolean) => {
    setHidePill(v);
    window.wavely.setSettings({ hidePill: v }).catch((e) => console.error("[Wavely] save failed:", e));
  }, [setHidePill]);

  const handleDebugProximityToggle = useCallback((v: boolean) => {
    setDebugProximity(v);
    window.wavely.toggleDebugProximity().then((enabled: boolean) => {
      setDebugProximity(enabled);
    }).catch(() => {
      setDebugProximity(!v);
    });
  }, []);

  const handleBackgroundOpaqueToggle = useCallback((v: boolean) => {
    setBackgroundOpaque(v);
    window.wavely.toggleOverlayTransparency(!v);
  }, []);

  const handleShowOverlayNotification = useCallback(() => {
    window.wavely.sendOverlayNotification({
      id: `debug-${Date.now()}`,
      variant: "tip",
      title: t("debug.overlayNotificationTitle"),
      description: t("debug.overlayNotificationDesc"),
      durationMs: 4000,
    }).catch((e) => console.error("[Wavely] send notification failed:", e));
  }, [t]);

  const handleShowInAppNotification = useCallback(() => {
    toast(t("debug.testNotificationTitle"), {
      description: t("debug.testNotificationDesc"),
      duration: 2000,
    });
  }, [t]);

  const handleFullReset = useCallback(() => {
    setResetConfirmOpen(false);
    window.wavely
      .fullReset()
      .then(() => {
        toast(t("debug.fullResetComplete"), {
          description: t("debug.fullResetCompleteHint"),
        });
        setTimeout(() => window.location.reload(), 500);
      })
      .catch((err) => {
        toast(t("debug.resetFailed"), {
          description: err instanceof Error ? err.message : t("debug.unknownError"),
        });
      });
  }, [t]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">{t("debug.title")}</h2>

      {/* Hide bottom pop-up */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.hidePopup")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.hidePopupHint")}
          </p>
        </div>
        <Switch checked={hidePill} onCheckedChange={handleHidePillToggle} className="border-foreground/30" />
      </div>

      {/* Show overlay notification */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.showOverlayNotification")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.showOverlayNotificationHint")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShowOverlayNotification}>
          {t("debug.testNotification")}
        </Button>
      </div>

      {/* Show in-app notification */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.showInAppNotification")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.showInAppNotificationHint")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleShowInAppNotification}>
          {t("debug.testNotification")}
        </Button>
      </div>

      {/* Show bounds of bottom pop-up */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.proximityOverlay")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.proximityOverlayHint")}
          </p>
        </div>
        <Switch checked={debugProximity} onCheckedChange={handleDebugProximityToggle} className="border-foreground/30" />
      </div>

      {/* Screen popup background transparency */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.backgroundTransparency")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.backgroundTransparencyHint")}
          </p>
        </div>
        <Switch checked={backgroundOpaque} onCheckedChange={handleBackgroundOpaqueToggle} className="border-foreground/30" />
      </div>

      {/* Full Reset */}
      <div className="pt-4 border-t border-border">
        <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em] mb-1">
          {t("debug.fullReset")}
        </p>
        <p className="text-[12px] text-foreground/45 mb-3">
          {t("debug.fullResetHint")}
        </p>
        <Button variant="destructive" onClick={() => setResetConfirmOpen(true)}>
          {t("debug.fullResetButton")}
        </Button>
      </div>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("debug.fullResetDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("debug.fullResetDialogHint")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              {t("debug.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleFullReset}>
              {t("debug.resetEverything")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
