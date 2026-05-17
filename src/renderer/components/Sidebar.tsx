import React from "react";
import { MessageSquare, User, Settings, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type Tab } from "@/store";
import ProfileFooter from "@/components/ProfileFooter";
import { Separator } from "@/components/ui/separator";

const NAV_ITEMS: { tab: Tab; icon: typeof MessageSquare; label: string }[] = [
  { tab: "conversations", icon: MessageSquare, label: "Conversations" },
  { tab: "profiles", icon: User, label: "Profiles" },
  { tab: "settings", icon: Settings, label: "Settings" },
];

function Sidebar(): React.ReactElement {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <aside className="flex flex-col w-60 h-full bg-background border-r border-border shrink-0">
      {/* App identity */}
      <div className="flex items-center gap-2.5 px-4 h-12 shrink-0">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-primary">
          <Mic className="h-3 w-3 text-primary-foreground" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          Wavely
        </span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            className={cn(
              "flex items-center gap-2.5 w-full h-8 rounded-md px-3 text-[13px] font-medium transition-colors",
              activeTab === item.tab
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Profile footer */}
      <Separator />
      <div className="px-3 py-2">
        <ProfileFooter />
      </div>

      {/* Status dot */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
          <span className="text-[11px] text-muted-foreground">Running</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
