import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function DebugView(): React.ReactElement {
  const [transparent, setTransparent] = useState(true);

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

  return (
    <div className="p-6 space-y-4">
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
    </div>
  );
}
