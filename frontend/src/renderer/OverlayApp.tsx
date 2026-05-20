import React, { useState, useEffect, useRef, useCallback } from "react";
import { Globe, Sparkles, Settings, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useProximity } from "./hooks/useProximity";
import { springPresets } from "./animations/presets";

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
    <div className="flex items-center gap-[2px] h-5">
      {Array.from({ length: bars }).map((_, i) => {
        const positionFactor = 1 - Math.abs(i - 5.5) * 0.08;
        const noise = (Math.random() - 0.5) * 2 * volumeNorm * 10;
        const h = Math.max(3, (4 + volumeNorm * 24) * positionFactor + noise);
        return (
          <span
            key={i}
            className="w-[2.5px] rounded-full bg-red-400"
            style={{ height: `${h}px`, transition: "height 80ms ease-out" }}
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
    <motion.div
      className="flex items-center justify-center gap-[3px]"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: { staggerChildren: 0.03, delayChildren: 0.1 },
        },
      }}
    >
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          className="w-[2.5px] h-[2.5px] rounded-full bg-white/40"
          variants={{
            hidden: { opacity: 0.2, scale: 0.5 },
            visible: {
              opacity: [0.2, 0.8, 0.2],
              scale: [0.5, 1.2, 0.5],
              transition: {
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.03,
              },
            },
          }}
        />
      ))}
    </motion.div>
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
  tooltip,
  onClick,
  ariaLabel,
  children,
}: {
  tooltip: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={onClick}
            className="size-7 grid place-items-center rounded-full bg-neutral-900/90 backdrop-blur-md border border-white/6 text-white/80 hover:text-white hover:border-white/15 transition-colors"
            style={{
              background: "rgba(23,23,23,0.9)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {children}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={16}
            className="z-[9999] px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
          >
            {tooltip}
            <Tooltip.Arrow className="fill-black/90" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function OverlayApp(): React.ReactElement {
  const [status, setStatus] = useState<PopupStatus>("idle");
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<{ rms: number; peak: number }>(
    { rms: -60, peak: -60 },
  );
  const [overlayTransparent, setOverlayTransparent] = useState(true);

  const barRef = useRef<HTMLDivElement>(null);

  const isActive = status !== "idle";
  const isNear = useProximity(barRef, 280, 80);
  const expanded = isActive || (status === "idle" && isNear);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    window.overlay.onTransparencyChanged((transparent: boolean) => {
      setOverlayTransparent(transparent);
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      clearResultTimer();
    };
  }, [clearResultTimer, goIdle]);

  const activeStatus = isActive ? status : null;
  const meta = activeStatus ? statusColor[activeStatus] : null;
  const showSideButtons =
    expanded && status !== "recording" && status !== "transcribing";
  const hasText = text.length > 0;

  const displayText =
    text.length > 40 ? text.slice(0, 40) + "..." : text;

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
    <div
      className="flex items-center justify-center w-full h-full p-4 overflow-visible"
      style={{ background: overlayTransparent ? "transparent" : "#0a0a0a" }}
    >
      <div
        ref={barRef}
        className="flex items-center gap-2 overflow-visible"
      >
        <AnimatePresence>
          {showSideButtons && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, x: -15 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7, x: -15 }}
              transition={{ ...springPresets.button, delay: 0.05 }}
            >
              <LanguagePopover>
                <SideButton
                  tooltip="Change profile"
                  ariaLabel="Change profile"
                >
                  <Globe className="size-[14px]" strokeWidth={2.25} />
                </SideButton>
              </LanguagePopover>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          onClick={handleBarClick}
          className={`flex items-center justify-center gap-2 bg-neutral-900/90 backdrop-blur-md border border-white/6 rounded-full cursor-pointer ${
            expanded ? "h-9 px-4" : "h-[15px] w-[75px] px-3"
          }`}
          animate={{ opacity: expanded ? 1 : 0.6 }}
          transition={springPresets.pill}
          style={{
            boxShadow: meta ? meta.ring : undefined,
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
              <span className="text-[13px] font-medium text-white/90 truncate max-w-[420px]">
                {displayText}
              </span>
            </>
          )}
          {status === "idle" && expanded && <DottedLine />}
          {status === "idle" && !expanded && null}
        </motion.div>

        <AnimatePresence>
          {showSideButtons && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, x: 15 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7, x: 15 }}
              transition={{ ...springPresets.button, delay: 0.05 }}
            >
              <SideButton
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OverlayApp;
