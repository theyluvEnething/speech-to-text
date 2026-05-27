import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, User, Settings, Mic, PanelLeftClose, PanelLeftOpen, Play, Pause, AppWindow, Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type Tab } from "@/store";
import ProfileFooter from "@/components/ProfileFooter";
import { Separator } from "@/components/ui/separator";

function Sidebar(): React.ReactElement {
  const { t } = useTranslation();
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const isPaused = useStore((s) => s.isPaused);
  const setIsPaused = useStore((s) => s.setIsPaused);

  const MAIN_NAV: { tab: Tab; icon: any; label: string }[] = [
    { tab: "conversations", icon: MessageSquare, label: t("nav.conversations", "Conversations") },
    { tab: "profiles", icon: User, label: t("nav.profiles", "Profiles") },
    { tab: "settings", icon: Settings, label: t("nav.settings", "Settings") },
  ];

  useEffect(() => {
    window.wavely.getPaused().then((paused) => setIsPaused(paused));
  }, []);

  function handleTogglePaused(): void {
    window.wavely.togglePaused().then((paused) => setIsPaused(paused));
  }

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
          "flex items-center shrink-0",
          collapsed ? "h-12 justify-center px-0" : "h-16 gap-3 px-4",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-foreground shrink-0">
          <Mic className="h-5 w-5 text-background" />
        </div>
        {!collapsed && (
          <span className="text-[32px] leading-none font-bold tracking-[-0.01em] text-foreground/95 whitespace-nowrap">
            Wavely
          </span>
        )}
      </div>

      <div className="mx-3">
        <Separator />
      </div>

      {/* Main navigation */}
      <nav className={cn("flex-1 py-3 space-y-0.5", collapsed ? "px-2" : "px-2")}>
        {MAIN_NAV.map((item) => (
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

      {/* Bottom nav: App + collapse */}
      <div className={cn("space-y-0.5 pb-1", collapsed ? "px-2" : "px-2")}>
        {/* App tab */}
        <button
          onClick={() => setActiveTab("app")}
          title={collapsed ? "App" : undefined}
          className={cn(
            "flex items-center gap-2.5 w-full h-8 rounded-md transition-colors duration-150 relative",
            collapsed ? "justify-center px-0" : "px-2.5",
            "text-[13px] font-medium",
            activeTab === "app"
              ? "bg-accent text-foreground"
              : "text-foreground/45 hover:text-foreground/70 hover:bg-accent/50",
          )}
        >
          {activeTab === "app" && !collapsed && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground/40" />
          )}
          <AppWindow className={cn("h-4 w-4 shrink-0", activeTab === "app" ? "text-foreground/92" : "")} />
          {!collapsed && <span>{t("nav.app", "App")}</span>}
        </button>

        {/* Debug tab */}
        <button
          onClick={() => setActiveTab("debug")}
          title={collapsed ? "Debug" : undefined}
          className={cn(
            "flex items-center gap-2.5 w-full h-8 rounded-md transition-colors duration-150 relative",
            collapsed ? "justify-center px-0" : "px-2.5",
            "text-[13px] font-medium",
            activeTab === "debug"
              ? "bg-accent text-foreground"
              : "text-foreground/45 hover:text-foreground/70 hover:bg-accent/50",
          )}
        >
          {activeTab === "debug" && !collapsed && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-foreground/40" />
          )}
          <Bug className={cn("h-4 w-4 shrink-0", activeTab === "debug" ? "text-foreground/92" : "")} />
          {!collapsed && <span>{t("nav.debug", "Debug")}</span>}
        </button>

        {/* Collapse toggle */}
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

      {/* Status indicator */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between px-2.5 py-1">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full shrink-0",
                isPaused ? "bg-[#F5C518]" : "bg-[#4ADE80]",
              )} />
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/40">
                {isPaused ? t("app.paused", "Paused") : t("app.active", "Active")}
              </span>
            </div>
            <button
              onClick={handleTogglePaused}
              className="ml-2 text-foreground/30 hover:text-foreground/60 transition-colors duration-150"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <Play className="h-3 w-3" />
              ) : (
                <Pause className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;