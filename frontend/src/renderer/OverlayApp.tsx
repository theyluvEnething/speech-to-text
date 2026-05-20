import React, { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Sparkles, Check } from "lucide-react";

type PopupStatus = "idle" | "hover" | "recording" | "transcribing" | "inserting";

interface NotificationPayload {
  id: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: "bell" | "sparkles" | "globe";
}

const statusColor: Record<
  Exclude<PopupStatus, "idle" | "hover">,
  { ring: string; textColor: string; iconColor: string }
> = {
  recording: {
    ring: "shadow-[0_0_0_1.5px_rgba(239,68,68,0.9),0_0_24px_-2px_rgba(239,68,68,0.6)]",
    textColor: "text-red-400",
    iconColor: "bg-red-400",
  },
  transcribing: {
    ring: "shadow-[0_0_0_1.5px_rgba(245,158,11,0.9),0_0_24px_-2px_rgba(245,158,11,0.6)]",
    textColor: "text-amber-400",
    iconColor: "border-amber-400/60",
  },
  inserting: {
    ring: "shadow-[0_0_0_1.5px_rgba(34,197,94,0.9),0_0_24px_-2px_rgba(34,197,94,0.6)]",
    textColor: "text-emerald-400",
    iconColor: "text-emerald-400",
  },
};

function Waveform({ rms }: { rms: number }): React.ReactElement {
  const bars = 12;
  const volumeNorm = Math.max(0, Math.min(1, (rms + 60) / 60));
  return (
    <div className="flex items-center gap-[2px] h-4">
      {Array.from({ length: bars }).map((_, i) => {
        const positionFactor = 1 - Math.abs(i - 5.5) * 0.12;
        const noise = (Math.random() - 0.5) * 2 * volumeNorm * 6;
        const h = Math.max(2, (2 + volumeNorm * 12) * positionFactor + noise);
        return (
          <span
            key={i}
            className="w-[2px] rounded-full bg-red-400"
            style={{ height: `${h}px`, transition: "height 100ms ease-out" }}
          />
        );
      })}
    </div>
  );
}

function Spinner(): React.ReactElement {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" />
  );
}

function DottedLine(): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-[3px]">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="w-[2.5px] h-[2.5px] rounded-full bg-white/40"
          style={{ opacity: 0.4 + 0.6 * Math.sin((i / 17) * Math.PI) }}
        />
      ))}
    </div>
  );
}

function SideButton({
  visible,
  side,
  tooltip,
  onClick,
  ariaLabel,
  children,
}: {
  visible: boolean;
  side: "left" | "right";
  tooltip: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}): React.ReactElement {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={`relative transition-all duration-[450ms] ${
        visible
          ? "opacity-100 scale-100 pointer-events-auto"
          : side === "left"
            ? "opacity-0 -translate-x-1 scale-75 pointer-events-none"
            : "opacity-0 translate-x-1 scale-75 pointer-events-none"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)" }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="size-7 grid place-items-center rounded-full bg-neutral-900/90 backdrop-blur-md border border-white/6 text-white/80 hover:text-white hover:border-white/15 transition-colors"
        style={{
          background: "rgba(23,23,23,0.9)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {children}
      </button>

      <div
        className={`absolute left-1/2 -translate-x-1/2 -top-2 text-white/60 transition-opacity duration-150 ${
          hover ? "opacity-100" : "opacity-0"
        }`}
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M5 0L10 6H0L5 0Z" fill="currentColor" />
        </svg>
      </div>

      <div
        className={`absolute left-1/2 -translate-x-1/2 -top-10 whitespace-nowrap px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 transition-all duration-150 ${
          hover ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
        }`}
      >
        {tooltip}
      </div>
    </div>
  );
}

function OverlayApp(): React.ReactElement {
  const [status, setStatus] = useState<PopupStatus>("idle");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [audioLevels, setAudioLevels] = useState<{ rms: number; peak: number }>({
    rms: -60,
    peak: -60,
  });
  const [notification] = useState<NotificationPayload | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goIdleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastResize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const wasVisible = useRef(false);

  const clearResultTimer = useCallback((): void => {
    if (resultTimeout.current) {
      clearTimeout(resultTimeout.current);
      resultTimeout.current = null;
    }
  }, []);

  const clearGoIdleTimeout = useCallback((): void => {
    if (goIdleTimeout.current) {
      clearTimeout(goIdleTimeout.current);
      goIdleTimeout.current = null;
    }
  }, []);

  const goIdle = useCallback((): void => {
    clearResultTimer();
    clearGoIdleTimeout();
    wasVisible.current = false;
    setExiting(true);
    setAnimKey((k) => k + 1);
    goIdleTimeout.current = setTimeout(() => {
      setVisible(false);
      setStatus("idle");
      setText("");
      setExiting(false);
      window.overlay.sendIdle();
    }, 280);
  }, [clearResultTimer, clearGoIdleTimeout]);

  const requestResize = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const pillW = el.offsetWidth + 32;
    const pillH = el.offsetHeight + 32;
    const w = Math.max(360, Math.min(700, pillW));
    const h = Math.max(72, Math.min(320, pillH));
    if (w !== lastResize.current.w || h !== lastResize.current.h) {
      lastResize.current = { w, h };
      window.overlay.requestResize(w, h);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => requestResize());
    }
  }, [text, status, visible, requestResize]);

  useEffect(() => {
    window.overlay.onState((newState: string, displayLabel: string) => {
      setLabel(displayLabel || "");
      if (newState === "recording") {
        clearResultTimer();
        clearGoIdleTimeout();
        const needsEnter = !wasVisible.current;
        wasVisible.current = true;
        setExiting(false);
        setStatus("recording");
        setVisible(true);
        setElapsed(0);
        if (needsEnter) setAnimKey((k) => k + 1);
        timer.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        clearResultTimer();
        clearGoIdleTimeout();
        setExiting(false);
        setStatus("transcribing");
      } else if (newState === "idle") {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        goIdle();
      }
    });

    window.overlay.onResult((resultText: string) => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      clearResultTimer();
      clearGoIdleTimeout();
      setExiting(false);
      setStatus("inserting");
      setText(resultText);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 3000);
    });

    window.overlay.onError((msg: string) => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      clearResultTimer();
      clearGoIdleTimeout();
      setExiting(false);
      setStatus("inserting");
      setText(msg);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 4000);
    });

    window.overlay.onLevels((levels) => {
      setAudioLevels(levels);
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      clearResultTimer();
      clearGoIdleTimeout();
    };
  }, [clearResultTimer, clearGoIdleTimeout, goIdle]);

  const expanded =
    status === "hover" ||
    hovered ||
    status === "recording" ||
    status === "transcribing" ||
    status === "inserting";
  const activeStatus = ["recording", "transcribing", "inserting"].includes(status)
    ? (status as "recording" | "transcribing" | "inserting")
    : null;
  const meta = activeStatus ? statusColor[activeStatus] : null;
  const showSideButtons = expanded && !activeStatus;

  if (!visible) return <div />;

  const displayLabel = label || "Recording";

  return (
    <div className="flex items-end justify-center w-full h-full pb-2">
      <div
        key={animKey}
        ref={contentRef}
        className={`relative inline-flex flex-col items-center gap-3 ${
          exiting ? "animate-popup-exit" : "animate-popup-enter"
        }`}
        onMouseEnter={() => {
          if (status === "idle") setHovered(true);
        }}
        onMouseLeave={() => {
          if (status === "idle") setHovered(false);
        }}
      >
        {notification && (
          <div className="w-[300px] rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/6 shadow-2xl shadow-black/60 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <div className="size-8 grid place-items-center rounded-xl bg-fuchsia-500/15 text-fuchsia-300 shrink-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white leading-tight">
                  {notification.title}
                </p>
                <p className="mt-1 text-[12px] text-white/55 leading-snug">
                  {notification.description}
                </p>
              </div>
              <button
                onClick={() => window.overlay.sendIdle()}
                className="size-6 grid place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Dismiss"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {notification.actionLabel && (
              <div className="mt-3 flex justify-end">
                <button className="px-3 py-1.5 rounded-lg bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors">
                  {notification.actionLabel}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <SideButton
            visible={showSideButtons}
            side="left"
            tooltip="Change language"
            onClick={() => window.overlay.sendIdle()}
            ariaLabel="Change language"
          >
            <Globe className="size-[14px]" strokeWidth={2.25} />
          </SideButton>

          <div
            className={`relative overflow-hidden flex items-center justify-center gap-2
              bg-neutral-900/90 backdrop-blur-md border border-white/6
              transition-all duration-[450ms] rounded-full
              ${expanded ? "h-9 min-w-[180px] px-4" : "h-[14px] w-[80px] px-3 opacity-80"}
              ${meta ? meta.ring : ""}`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)",
              background: "rgba(23,23,23,0.9)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {activeStatus === "recording" && (
              <>
                <Waveform rms={audioLevels.rms} />
                <span className={`text-[13px] font-medium ${meta?.textColor}`}>
                  {displayLabel} {elapsed.toFixed(1)}s
                </span>
              </>
            )}
            {activeStatus === "transcribing" && (
              <>
                <Spinner />
                <span className={`text-[13px] font-medium ${meta?.textColor}`}>
                  Transcribing
                </span>
              </>
            )}
            {activeStatus === "inserting" && (
              <>
                <Check className="size-4 text-emerald-400" strokeWidth={2.5} />
                <span className="text-[13px] font-medium text-white/90 truncate max-w-[220px]">
                  {text}
                </span>
              </>
            )}
            {!activeStatus && <DottedLine />}
          </div>

          <SideButton
            visible={showSideButtons}
            side="right"
            tooltip={
              <>
                Click or press{" "}
                <span className="bg-gradient-to-r from-fuchsia-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                  Win Alt 1
                </span>{" "}
                to polish
              </>
            }
            onClick={() => window.overlay.sendIdle()}
            ariaLabel="Polish text"
          >
            <Sparkles className="size-[14px] text-pink-300" strokeWidth={2.25} />
          </SideButton>
        </div>
      </div>
    </div>
  );
}

export default OverlayApp;
