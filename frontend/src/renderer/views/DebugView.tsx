import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DebugView(): React.ReactElement {
  const showTestNotification = () => {
    toast("Test notification", {
      description: "This will disappear in 2 seconds",
      duration: 2000,
    });
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Debug Tools</h2>
      <Button onClick={showTestNotification}>
        Show Test Notification
      </Button>
    </div>
  );
}
