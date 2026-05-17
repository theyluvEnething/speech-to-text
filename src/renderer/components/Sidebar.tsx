import React from "react";
import { MessageSquare, User, Settings, Mic, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-transparent shrink-0 transition-all duration-200",
        collapsed ? "w-[52px]" : "w-60",
      )}
    >
      {/* App identity */}
      <div
        className={cn(
          "flex items-center h-12 shrink-0",
          collapsed ? "justify-center px-0" : "gap-3 px-4",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <Mic className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="text-[17px] font-bold tracking-tight text-foreground whitespace-nowrap">
            Wavely
          </span>
        )}
      </div>

      <Separator />

      {/* Navigation */}
      <nav className={cn("flex-1 py-3 space-y-0.5", collapsed ? "px-2" : "px-3")}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 w-full h-8 rounded-md transition-colors",
              collapsed ? "justify-center px-0" : "px-3",
              "text-[13px] font-medium",
              activeTab === item.tab
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("px-2 pb-1", collapsed && "flex justify-center")}>
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-7 rounded-md
            text-muted-foreground hover:text-foreground hover:bg-accent/50
            transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Profile footer */}
      <Separator />
      <div className={cn("py-2", collapsed ? "px-1.5" : "px-3")}>
        <ProfileFooter collapsed={collapsed} />
      </div>

      {/* Status dot */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
            <span className="text-[11px] text-muted-foreground">Running</span>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
