import React from "react";
import { cn } from "@/lib/utils";
import { WV_BUTTON_PRIMARY } from "@/styles/theme";

interface NotificationCardProps {
  title: React.ReactNode;
  description: React.ReactNode;
  buttonLabel: string;
  onAction: () => void;
  className?: string;
}

function NotificationCard({ title, description, buttonLabel, onAction, className }: NotificationCardProps): React.ReactElement {
  return (
    <div className={cn("mx-2 mb-2 rounded-[14px] border border-line bg-raised p-3.5", className)}>
      <div className="text-[12.5px] font-semibold text-ink">{title}</div>
      <p className="text-[11.5px] text-ink-2 leading-[1.55] my-1.5">{description}</p>
      <button className={cn(WV_BUTTON_PRIMARY, "w-full")} onClick={onAction}>
        {buttonLabel}
      </button>
    </div>
  );
}

export default NotificationCard;
