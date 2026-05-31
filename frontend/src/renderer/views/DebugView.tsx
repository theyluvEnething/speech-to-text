import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
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
  const [showBackground, setShowBackground] = useState(false);
  const [debugProximity, setDebugProximity] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    window.wavely.getDebugProximity().then(setDebugProximity).catch(() => {});
  }, []);

  const showTestNotification = () => {
    toast(t("debug.testNotificationTitle"), {
      description: t("debug.testNotificationDesc"),
      duration: 2000,
    });
  };

  const handleBackgroundToggle = (v: boolean) => {
    setShowBackground(v);
    window.wavely.toggleOverlayTransparency(!v);
  };

  const handleDebugProximityToggle = (v: boolean) => {
    window.wavely.toggleDebugProximity().then((enabled: boolean) => {
      setDebugProximity(enabled);
    }).catch(() => {});
  };

  const handleFullReset = () => {
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
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">{t("debug.title")}</h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.backgroundOverlay")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.backgroundOverlayHint")}
          </p>
        </div>
        <Switch
          checked={showBackground}
          onCheckedChange={handleBackgroundToggle}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            {t("debug.proximityOverlay")}
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            {t("debug.proximityOverlayHint")}
          </p>
        </div>
        <Switch
          checked={debugProximity}
          onCheckedChange={handleDebugProximityToggle}
        />
      </div>

      <Button onClick={showTestNotification}>
        {t("debug.testNotification")}
      </Button>

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
