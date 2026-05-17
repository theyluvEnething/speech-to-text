import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileSwitcherPopover from "@/components/ProfileSwitcherPopover";
import { useStore } from "@/store";

function ProfileFooter({ collapsed }: { collapsed: boolean }): React.ReactElement {
  const activeProfile = useStore((s) => s.activeProfile);

  if (!activeProfile) return <div />;

  return (
    <ProfileSwitcherPopover>
      <button
        className={cn(
          "flex items-center rounded-lg hover:bg-accent/50 transition-colors text-left group",
          collapsed ? "justify-center w-full p-1.5" : "gap-2.5 w-full px-3 py-2",
        )}
        title={collapsed ? activeProfile.name : undefined}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activeProfile.color }}
        />
        {!collapsed && (
          <>
            <span className="text-[16px] leading-none">{activeProfile.icon}</span>
            <span className="flex-1 text-[13px] font-medium truncate text-foreground">
              {activeProfile.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0
              group-hover:text-foreground transition-colors" />
          </>
        )}
      </button>
    </ProfileSwitcherPopover>
  );
}

export default ProfileFooter;
