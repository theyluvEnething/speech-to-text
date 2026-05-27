import { useState } from "react";
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
  const [transparent, setTransparent] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const showTestNotification = () => {
    toast("Test notification", {
      description: "This will disappear in 2 seconds",
      duration: 2000,
    });
  };

  const handleTransparencyToggle = (v: boolean) => {
    setTransparent(v);
    window.wavely.toggleOverlayTransparency(v);
  };

  const handleFullReset = () => {
    setResetConfirmOpen(false);
    window.wavely
      .fullReset()
      .then(() => {
        toast("Full reset complete", {
          description: "All settings, profiles, and conversations have been restored to defaults.",
        });
      })
      .catch((err) => {
        toast("Reset failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        });
      });
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold">Debug Tools</h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em]">
            Transparent overlay background
          </p>
          <p className="text-[12px] text-foreground/45 mt-0.5">
            Toggle between transparent and solid background on the overlay window.
          </p>
        </div>
        <Switch
          checked={transparent}
          onCheckedChange={handleTransparencyToggle}
        />
      </div>

      <Button onClick={showTestNotification}>
        Show Test Notification
      </Button>

      <div className="pt-4 border-t border-border">
        <p className="text-[14px] font-medium text-foreground/92 tracking-[-0.01em] mb-1">
          Full Reset
        </p>
        <p className="text-[12px] text-foreground/45 mb-3">
          This will delete ALL data (settings, profiles, conversations) and restore factory defaults.
        </p>
        <Button variant="destructive" onClick={() => setResetConfirmOpen(true)}>
          FULL RESET
        </Button>
      </div>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Full Reset</DialogTitle>
            <DialogDescription>
              This will permanently delete all settings, profiles, and conversations.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleFullReset}>
              Reset Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
