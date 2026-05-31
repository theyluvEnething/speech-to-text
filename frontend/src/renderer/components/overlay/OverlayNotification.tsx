import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Info, AlertTriangle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { springPresets } from "@/animations/presets";

export type NotificationVariant = "tip" | "warning" | "premium";

export interface OverlayNotificationData {
  id: string;
  variant?: NotificationVariant;
  badge?: string;
  title: string;
  description?: string;
  action?: { label: string; type: string };
  durationMs?: number;
}

interface Props {
  data: OverlayNotificationData;
  onDismiss: () => void;
  onAction?: (type: string) => void;
}

const variantStyle: Record<NotificationVariant, { bg: string; ink: string; icon: React.ComponentType<{ className?: string }> }> = {
  tip:     { bg: "bg-acc-faint",  ink: "text-acc-strong", icon: Info },
  warning: { bg: "bg-amber-100/40 dark:bg-amber-500/15", ink: "text-amber-700 dark:text-amber-300", icon: AlertTriangle },
  premium: { bg: "bg-pink-100/40 dark:bg-pink-500/15", ink: "text-pink-700 dark:text-pink-300", icon: Sparkles },
};

function OverlayNotification({ data, onDismiss, onAction }: Props): React.ReactElement {
  const { t } = useTranslation();
  const duration = data.durationMs ?? 6000;
  const variant = data.variant ?? "tip";
  const style = variantStyle[variant];
  const Icon = style.icon;

  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        onDismiss();
      }
    }, 30);
    return () => clearInterval(tick);
  }, [duration, onDismiss, data.id]);

  // Pause countdown on hover
  const [paused, setPaused] = useState(false);

  const ringSize = 20;
  const stroke = 1.5;
  const r = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.94 }}
      transition={springPresets.pill}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto rounded-[14px] border border-line shadow-wv-pop max-w-[320px] backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--raised) 94%, transparent)",
      }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <div className="flex-1 min-w-0">
          {data.badge && (
            <div className={`inline-flex items-center gap-1 px-2 py-[2px] rounded-md ${style.bg} ${style.ink} text-[10px] font-bold uppercase tracking-[0.05em] mb-1.5`}>
              <Icon className="h-2.5 w-2.5" />
              {data.badge}
            </div>
          )}
          <div className="text-[13px] font-semibold text-ink leading-snug">
            {data.title}
          </div>
          {data.description && (
            <div className="text-[11.5px] text-ink-3 leading-snug mt-0.5">
              {data.description}
            </div>
          )}
          {data.action && (
            <button
              onClick={() => onAction?.(data.action!.type)}
              className="mt-2 text-[11.5px] font-semibold text-acc-strong hover:text-acc transition-colors"
            >
              {data.action.label} →
            </button>
          )}
        </div>

        <button
          onClick={onDismiss}
          aria-label={t("overlay.dismiss")}
          className="relative shrink-0 grid place-items-center text-ink-3 hover:text-ink transition-colors mt-0.5"
          style={{ width: ringSize, height: ringSize }}
        >
          <svg
            width={ringSize}
            height={ringSize}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth={stroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.55"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 30ms linear" }}
            />
          </svg>
          <X className="h-[11px] w-[11px] relative z-10" strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
}

export default OverlayNotification;
