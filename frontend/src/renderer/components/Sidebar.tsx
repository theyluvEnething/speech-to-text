import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  BarChart3,
  User,
  Settings as SettingsIcon,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Pause,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, type Tab } from "@/store";
import { WV_NAV_ITEM, WV_BADGE, WV_BADGE_PRO } from "@/styles/theme";
import ProfileSwitcherPopover from "@/components/ProfileSwitcherPopover";
import ProfileIcon from "@/components/ProfileIcon";
import NotificationCard from "@/components/NotificationCard";
import { Separator } from "@/components/ui/separator";

function Sidebar(): React.ReactElement {
  const { t } = useTranslation();
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const openSettings = useStore((s) => s.openSettings);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const isPaused = useStore((s) => s.isPaused);
  const setIsPaused = useStore((s) => s.setIsPaused);
  const activeProfile = useStore((s) => s.activeProfile);

  const NAV: { tab: Tab; icon: typeof MessageSquare; label: string }[] = [
    { tab: "conversations", icon: MessageSquare, label: t("nav.conversations", "Conversations") },
    { tab: "insights", icon: BarChart3, label: t("nav.insights", "Insights") },
    { tab: "profiles", icon: User, label: t("nav.profiles", "Profiles") },
  ];

  useEffect(() => {
    window.wavely.getPaused().then(setIsPaused).catch(() => {});
  }, [setIsPaused]);

  function handleTogglePaused(): void {
    window.wavely.togglePaused().then(setIsPaused).catch(() => {});
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 overflow-hidden transition-all duration-150 bg-sidebar border border-line rounded-panel",
        collapsed ? "w-[52px]" : "w-[232px]",
      )}
    >
      {/* Brand */}
      <div className={cn("flex items-center shrink-0", collapsed ? "h-12 justify-center" : "h-16 gap-3 px-3")}>
        <div className="grid place-items-center w-[34px] h-[34px] rounded-[10px] bg-[#D4883A] shadow-wv-card shrink-0">
          <Mic className="h-[18px] w-[18px] text-[#FDECC8]" />
        </div>
        {!collapsed && (
          <>
            <span className="text-[21px] font-bold tracking-[-0.02em] text-ink">Wavely</span>
            <span className={cn(WV_BADGE_PRO)}>Pro</span>
          </>
        )}
      </div>

      <div className="mx-3 shrink-0"><Separator /></div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto min-h-0 py-3 px-2 space-y-1">
        {NAV.map((item) => (
          <button
            key={item.tab}
            onClick={() => setActiveTab(item.tab)}
            title={collapsed ? item.label : undefined}
            className={cn(
              WV_NAV_ITEM,
              collapsed && "justify-center px-0",
              activeTab === item.tab && "wv-nav-spike",
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", activeTab === item.tab && "text-amber-accent-300")} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* Settings → opens modal (no longer a routed tab) */}
        <button
          onClick={() => openSettings("general")}
          title={collapsed ? t("nav.settings", "Settings") : undefined}
          className={cn(WV_NAV_ITEM, collapsed && "justify-center px-0")}
        >
          <SettingsIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("nav.settings", "Settings")}</span>}
        </button>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-1">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full h-7 rounded-[10px] text-ink-4 hover:text-ink-2 hover:bg-hover transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Notification slot — pass a NotificationCard to show banners */}

      <div className="mx-3 shrink-0"><Separator /></div>

      {/* Profile footer */}
      <div className={cn("shrink-0 py-2", collapsed ? "px-1.5" : "px-2")}>
        {activeProfile && (
          <ProfileSwitcherPopover compact={collapsed}>
            <button
              title={collapsed ? activeProfile.name : undefined}
              className={cn(
                "flex items-center rounded-[10px] hover:bg-hover transition-colors text-left group w-full",
                collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
              )}
            >
              {collapsed ? (
                <ProfileIcon icon={activeProfile.icon} className="text-[18px]" />
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeProfile.color }} />
                  <ProfileIcon icon={activeProfile.icon} className="text-[16px]" />
                  <span className="flex-1 text-[13px] font-medium truncate text-ink">{activeProfile.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-3 shrink-0 group-hover:text-ink transition-colors" />
                </>
              )}
            </button>
          </ProfileSwitcherPopover>
        )}
      </div>

      {/* Status */}
      {!collapsed && (
        <div className="shrink-0 px-3 pb-3">
          <div className="flex items-center justify-between px-2.5 py-1">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full shrink-0", isPaused ? "bg-red-500" : "bg-green-500")} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-4">
                {isPaused ? t("app.paused", "Paused") : t("app.active", "Active")}
              </span>
            </div>
            <button
              onClick={handleTogglePaused}
              title={isPaused ? "Resume" : "Pause"}
              className="ml-2 text-ink-4 hover:text-ink-2 transition-colors"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
