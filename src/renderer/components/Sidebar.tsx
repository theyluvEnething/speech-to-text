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
        "flex flex-col h-full bg-sidebar shrink-0 transition-all duration-150",
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
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground shrink-0">
          <Mic className="h-5 w-5 text-background" />
        </div>
        {!collapsed && (
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground/95 whitespace-nowrap">
            Wavely
          </span>
        )}
      </div>

      <div className="mx-3">
        <Separator />
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 py-3 space-y-0.5", collapsed ? "px-2" : "px-2")}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 w-full h-8 rounded-md transition-colors duration-150 relative",
              collapsed ? "justify-center px-0" : "px-2.5",
              "text-[13px] font-medium",
              activeTab === item.tab
                ? "bg-accent text-foreground"
                : "text-foreground/45 hover:text-foreground/70 hover:bg-accent/50",
            )}
          >
            {activeTab === item.tab && !collapsed && (
              <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground/40" />
            )}
            <item.icon className={cn("h-4 w-4 shrink-0", activeTab === item.tab ? "text-foreground/92" : "")} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("px-2 pb-1", collapsed && "flex justify-center")}>
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-7 rounded-md
            text-foreground/30 hover:text-foreground/60 hover:bg-accent/50
            transition-colors duration-150"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Profile footer */}
      <div className="mx-3">
        <Separator />
      </div>
      <div className={cn("py-2", collapsed ? "px-1.5" : "px-3")}>
        <ProfileFooter collapsed={collapsed} />
      </div>

      {/* Status dot */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 px-2.5 py-1">
            <div className="w-2 h-2 rounded-full bg-foreground/40 shrink-0" />
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
              Running
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
