import React from "react";
import { isFlagEmoji, flagEmojiToCountryCode } from "@/lib/flagEmoji";
import { cn } from "@/lib/utils";

function ProfileIcon({ icon, className }: { icon: string; className?: string }): React.ReactElement {
  if (isFlagEmoji(icon)) {
    const cc = flagEmojiToCountryCode(icon)!.toLowerCase();
    return <span className={cn("fi !leading-none", `fi-${cc}`, className)} />;
  }
  return <span className={cn("leading-none", className)}>{icon}</span>;
}

export default ProfileIcon;
