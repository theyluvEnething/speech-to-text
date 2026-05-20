import React, { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Sparkles, Settings, Check } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useProximity } from "./hooks/useProximity";

type PopupStatus = "idle" | "recording" | "transcribing" | "inserting";

interface Profile {
  id: string;
  name: string;
  color: string;
  icon: string;
  systemPrompt: string;
  language?: string;
  model?: string;
}

const statusColor: Record<
  Exclude<PopupStatus, "idle">,
  { ring: string; textColor: string }
> = {
  recording: {
    ring: "shadow-[0_0_0_1.5px_rgba(239,68,68,0.9),0_0_24px_-2px_rgba(239,68,68,0.6)]",
    textColor: "text-red-400",
  },
  transcribing: {
    ring: "shadow-[0_0_0_1.5px_rgba(245,158,11,0.9),0_0_24px_-2px_rgba(245,158,11,0.6)]",
    textColor: "text-amber-400",
  },
  inserting: {
    ring: "shadow-[0_0_0_1.5px_rgba(34,197,94,0.9),0_0_24px_-2px_rgba(34,197,94,0.6)]",
    textColor: "text-emerald-400",
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

function LanguagePopover({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [recentProfiles, setRecentProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (!open) return;
    window.overlay.getProfiles().then((profiles: Profile[]) => {
      const recentIds: string[] = JSON.parse(
        localStorage.getItem("recentProfiles") || "[]",
      );
      const recent = recentIds
        .map((id) => profiles.find((p) => p.id === id))
        .filter((p): p is Profile => !!p);
      setRecentProfiles(recent.slice(0, 3));
    });
  }, [open]);

  const handleSelect = (profile: Profile) => {
    window.overlay.setActiveProfile(profile.id);
    const recentIds: string[] = JSON.parse(
      localStorage.getItem("recentProfiles") || "[]",
    );
    const updated = [
      profile.id,
      ...recentIds.filter((id) => id !== profile.id),
    ].slice(0, 5);
    localStorage.setItem("recentProfiles", JSON.stringify(updated));
    setOpen(false);
  };

  const handleMore = () => {
    setOpen(false);
    window.overlay.showSettings("profiles");
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={12}
          collisionPadding={8}
          avoidCollisions
          className="z-[9999] min-w-[180px] rounded-xl bg-neutral-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-150"
          style={{
            maxWidth: "calc(100vw - 32px)",
            pointerEvents: "auto",
          }}
        >
          <div className="space-y-0.5">
            {recentProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-base">{profile.icon}</span>
                <span className="flex-1 text-white/90">{profile.name}</span>
              </button>
            ))}
            <div className="h-px bg-white/10 my-1" />
            <button
              onClick={handleMore}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm hover:bg-white/10 transition-colors text-left"
            >
              <span className="text-base">⋯</span>
              <span className="flex-1 text-white/70">More...</span>
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
      className={`relative overflow-visible transition-all duration-[450ms] ${
        visible
          ? "opacity-100 scale-100 pointer-events-auto"
          : side === "left"
            ? "opacity-0 -translate-x-2 scale-75 pointer-events-none"
            : "opacity-0 translate-x-2 scale-75 pointer-events-none"
      }`}
      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)" }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={onClick}
        className="size-8 grid place-items-center rounded-full bg-neutral-900/90 backdrop-blur-md border border-white/6 text-white/80 hover:text-white hover:border-white/15 transition-colors"
        style={{
          background: "rgba(23,23,23,0.9)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {children}
      </button>

      {/* Tooltip with fixed positioning relative to viewport */}
      {hover && (
        <div
          className="fixed z-[10000] px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 whitespace-nowrap pointer-events-none"
          style={{
            left: "50%",
            transform: "translateX(-50%)",
            top: "calc(var(--y, 0px) - 32px)",
          }}
        />
      )}

      {/* Custom positioned tooltip using absolute positioning with higher z-index and overflow visible */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 -top-[38px] whitespace-nowrap px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 transition-all duration-150 z-[9999] pointer-events-none shadow-lg ${
          hover ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 pointer-events-none"
        }`}
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          top: "-38px",
          willChange: "opacity, transform",
        }}
      >
        {tooltip}
        {/* Triangle arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px]">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M5 6L10 0H0L5 6Z" fill="rgba(0,0,0,0.9)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function OverlayApp(): React.ReactElement {
  const [status, setStatus] = useState<PopupStatus>("idle");
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<{ rms: number; peak: number }>(
    { rms: -60, peak: -60 },
  );

  const barRef = useRef<HTMLDivElement>(null);
  const isNear = useProximity(barRef, 300, 100);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastResize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const clearResultTimer = useCallback(() => {
    if (resultTimeout.current) {
      clearTimeout(resultTimeout.current);
      resultTimeout.current = null;
    }
  }, []);

  const goIdle = useCallback(() => {
    clearResultTimer();
    setStatus("idle");
    setText("");
    window.overlay.sendIdle();
  }, [clearResultTimer]);

  const requestResize = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const pillW = el.offsetWidth + 32;
    const pillH = el.offsetHeight + 32;
    // Increase max dimensions to accommodate tooltips and popovers
    const w = Math.max(140, Math.min(900, pillW));
    const h = Math.max(200, Math.min(700, pillH));
    if (w !== lastResize.current.w || h !== lastResize.current.h) {
      lastResize.current = { w, h };
      window.overlay.requestResize(w, h);
    }
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => requestResize());
  }, [text, status, isNear, requestResize]); // Add isNear to trigger resize when proximity changes

  useEffect(() => {
    window.overlay.onState((newState: string, _displayLabel: string) => {
      if (newState === "recording") {
        clearResultTimer();
        setStatus("recording");
        setElapsed(0);
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        clearResultTimer();
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
    };
  }, [clearResultTimer, goIdle]);

  const isActive = status !== "idle";
  // Only expand if actively recording/transcribing/inserting OR hovering near
  // But when idle and not near, it should stay collapsed
  const expanded = isActive || (status === "idle" && isNear);
  const activeStatus = isActive ? status : null;
  const meta = activeStatus ? statusColor[activeStatus] : null;
  const showSideButtons =
    expanded && status !== "recording" && status !== "transcribing";
  const hasText = text.length > 0;

  const displayText =
    text.length > 300 ? text.slice(0, 300) + "..." : text;
  const barWidthClass =
    activeStatus === "inserting" && displayText.length > 30
      ? "min-w-[200px] max-w-[500px]"
      : expanded
        ? "min-w-[180px]"
        : "w-[80px]";

  const handleBarClick = () => {
    if (status === "idle") {
      window.overlay.startRecording();
    } else if (status === "recording") {
      window.overlay.stopRecording();
    }
  };

  const handleOpenSettings = () => {
    window.overlay.showSettings();
  };

  return (
    <div className="flex items-center justify-center w-full h-full p-4 overflow-visible">
      <div
        ref={contentRef}
        className="relative inline-flex flex-col items-center gap-3 overflow-visible"
        style={{ overflow: "visible" }}
      >
        <div ref={barRef} className="flex items-center gap-2 overflow-visible">
          <LanguagePopover>
            <SideButton
              visible={showSideButtons}
              side="left"
              tooltip="Change profile"
              ariaLabel="Change profile"
            >
              <Globe className="size-[14px]" strokeWidth={2.25} />
            </SideButton>
          </LanguagePopover>

          <div
            onClick={handleBarClick}
            className={`relative overflow-visible flex items-center justify-center gap-2
              bg-neutral-900/90 backdrop-blur-md border border-white/6
              transition-all duration-[450ms] rounded-full cursor-pointer
              ${expanded ? `h-10 ${barWidthClass} px-4` : "h-[16px] w-[80px] px-3 opacity-60"}
              ${meta ? meta.ring : ""}`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)",
            }}
          >
            {activeStatus === "recording" && (
              <>
                <Waveform rms={audioLevels.rms} />
                <span className={`text-[13px] font-medium ${meta?.textColor}`}>
                  Recording {elapsed.toFixed(1)}s
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
                <Check
                  className="size-4 text-emerald-400 shrink-0"
                  strokeWidth={2.5}
                />
                <span className="text-[13px] font-medium text-white/90 truncate max-w-[440px]">
                  {displayText}
                </span>
              </>
            )}
            {status === "idle" && expanded && <DottedLine />}
            {status === "idle" && !expanded && null}
          </div>

          <SideButton
            visible={showSideButtons}
            side="right"
            tooltip={
              hasText ? (
                <>
                  Click or press{" "}
                  <span className="bg-gradient-to-r from-fuchsia-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                    Win Alt 1
                  </span>{" "}
                  to polish
                </>
              ) : (
                "Open settings"
              )
            }
            onClick={hasText ? undefined : handleOpenSettings}
            ariaLabel={hasText ? "Polish text" : "Open settings"}
          >
            {hasText ? (
              <Sparkles
                className="size-[14px] text-pink-300"
                strokeWidth={2.25}
              />
            ) : (
              <Settings className="size-[14px]" strokeWidth={2.25} />
            )}
          </SideButton>
        </div>
      </div>
    </div>
  );
}

export default OverlayApp;