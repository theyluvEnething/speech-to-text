import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { WV_PANEL } from "@/styles/theme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Row({ label, desc, children }: { label: React.ReactNode; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 py-[17px] border-b border-line-soft last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-ink">{label}</div>
        {desc && <div className="text-[12px] text-ink-3 leading-[1.5] mt-1 max-w-[430px]">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] font-semibold text-ink-3 mt-6 first:mt-0 mb-2">{children}</div>;
}

function PaneTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-[26px] font-medium tracking-[-0.01em] text-ink mb-5">{children}</h2>;
}

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

  const handleDebugProximityToggle = useCallback(() => {
    window.wavely.toggleDebugProximity().then((enabled: boolean) => {
      setDebugProximity(enabled);
    }).catch(() => {});
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
    <div className="flex flex-col h-full">
      <PaneTitle>{t("debug.title")}</PaneTitle>

      <GroupLabel>{t("settings.general", "Overlay")}</GroupLabel>
      <div className={cn(WV_PANEL, "px-[18px]")}>
        <Row label={t("debug.hidePopup")} desc={t("debug.hidePopupHint")}>
          <Switch checked={hidePill} onCheckedChange={handleHidePillToggle} />
        </Row>

        <Row label={t("debug.showOverlayNotification")} desc={t("debug.showOverlayNotificationHint")}>
          <Button variant="outline" size="sm" onClick={handleShowOverlayNotification}>
            {t("debug.testNotification")}
          </Button>
        </Row>

        <Row label={t("debug.showInAppNotification")} desc={t("debug.showInAppNotificationHint")}>
          <Button variant="outline" size="sm" onClick={handleShowInAppNotification}>
            {t("debug.testNotification")}
          </Button>
        </Row>

        <Row label={t("debug.proximityOverlay")} desc={t("debug.proximityOverlayHint")}>
          <Switch checked={debugProximity} onCheckedChange={handleDebugProximityToggle} />
        </Row>

        <Row label={t("debug.backgroundTransparency")} desc={t("debug.backgroundTransparencyHint")}>
          <Switch checked={backgroundOpaque} onCheckedChange={handleBackgroundOpaqueToggle} />
        </Row>
      </div>

      <GroupLabel>{t("settings.dangerZone")}</GroupLabel>
      <div className={cn(WV_PANEL, "px-[18px]")}>
        <Row label={t("debug.fullReset")} desc={t("debug.fullResetHint")}>
          <Button variant="destructive" size="sm" onClick={() => setResetConfirmOpen(true)}>
            {t("debug.fullResetButton")}
          </Button>
        </Row>
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
