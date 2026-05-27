import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserPlus, Check } from "lucide-react";
import ProfileIcon from "@/components/ProfileIcon";
import { useStore, type Tab } from "@/store";

function ProfileSwitcherPopover({ children, compact }: { children: React.ReactNode; compact?: boolean }): React.ReactElement {
  const profiles = useStore((s) => s.profiles);
  const activeProfile = useStore((s) => s.activeProfile);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setProfiles = useStore((s) => s.setProfiles);
  const setTriggerNewProfile = useStore((s) => s.setTriggerNewProfile);

  function handleSelect(id: string): void {
    window.wavely.profiles.setActive(id).then(() => {
      const p = profiles.find((pr) => pr.id === id);
      if (p) setActiveProfile(p);
    });
  }

  function handleNewProfile(): void {
    setActiveTab("profiles");
    setTriggerNewProfile(true);
  }

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-auto p-1.5">
          <div className="flex items-center gap-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                title={p.name}
                className="flex items-center justify-center w-9 h-9 rounded-md text-lg
                  hover:bg-accent transition-colors
                  data-[active=true]:bg-accent data-[active=true]:ring-1 data-[active=true]:ring-border"
                data-active={activeProfile?.id === p.id}
              >
                <ProfileIcon icon={p.icon} className="text-lg" />
              </button>
            ))}
            <div className="w-px h-6 bg-border mx-0.5" />
            <button
              onClick={handleNewProfile}
              title="New profile"
              className="flex items-center justify-center w-9 h-9 rounded-md
                text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-56 p-1">
        <div className="space-y-0.5">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className="flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm
                hover:bg-accent transition-colors text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[16px] leading-none"><ProfileIcon icon={p.icon} className="text-[16px]" /></span>
              <span className="flex-1 truncate text-foreground">{p.name}</span>
              {activeProfile?.id === p.id && (
                <Check className="h-4 w-4 text-foreground/50 shrink-0" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-1 pt-1 border-t border-border">
          <button
            onClick={handleNewProfile}
            className="flex items-center gap-2 w-full rounded-md px-2 py-2 text-sm
              text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            New profile
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ProfileSwitcherPopover;
