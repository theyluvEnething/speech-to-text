import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Settings, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ProfileIcon from "@/components/ProfileIcon";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useProximity } from "./hooks/useProximity";
import { springPresets } from "./animations/presets";
import { ProximityDebugOverlay } from "@/components/ProximityDebugOverlay";
import OverlayNotification, { type OverlayNotificationData } from "@/components/overlay/OverlayNotification";
import { useOverlayTheme } from "@/hooks/useOverlayTheme";

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

function getDisplayText(text: string, maxLines: number = 4, maxWidthChars: number = 40): string {
  if (text.length <= maxWidthChars) return text;

  const charsPerLine = maxWidthChars;
  const lines: string[] = [];
  let remaining = text;

  for (let i = 0; i < maxLines - 1; i++) {
    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      remaining = "";
      break;
    }
    let breakPoint = charsPerLine;
    while (breakPoint > 0 && remaining[breakPoint] !== " ") {
      breakPoint--;
    }
    if (breakPoint === 0) breakPoint = charsPerLine;
    lines.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  if (remaining.length > 0) {
    const lastLine =
      remaining.length > charsPerLine
        ? remaining.slice(0, charsPerLine - 3) + "..."
        : remaining;
    lines.push(lastLine);
  }

  return lines.join("\n");
}

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
                repeat: 0,
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
  icon,
  activeProfileId,
  onProfileChange,
  open,
  onOpenChange,
  triggerRef,
  contentRef,
}: {
  icon: string;
  activeProfileId: string;
  onProfileChange: (profile: Profile) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}): React.ReactElement {
  const { t } = useTranslation();
  const [otherProfiles, setOtherProfiles] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    window.overlay.getActiveProfile().then((profile: Profile) => {
      onProfileChange(profile);
    }).catch(() => {});
    Promise.all([
      window.overlay.getProfiles(),
      window.overlay.getRecentProfileIds(),
    ]).then(([profiles, recentIds]: [Profile[], string[]]) => {
      const recent = recentIds
        .map((id) => profiles.find((p) => p.id === id))
        .filter((p): p is Profile => !!p && p.id !== activeProfileId);
      if (recent.length < 3) {
        const recentIdSet = new Set(recent.map((p) => p.id));
        const fillers = profiles.filter(
          (p) => p.id !== activeProfileId && !recentIdSet.has(p.id),
        );
        recent.push(...fillers.slice(0, 3 - recent.length));
      }
      setOtherProfiles(recent.slice(0, 3));
      setTotalCount(profiles.length);
    });
  }, [open]);

  const handleSelect = (profile: Profile) => {
    window.overlay.setActiveProfile(profile.id);
    onProfileChange(profile);
    onOpenChange(false);
  };

  const handleMore = () => {
    onOpenChange(false);
    window.overlay.showSettings("profiles");
  };

  const showMore = totalCount <= 1;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Popover.Root open={open} onOpenChange={onOpenChange}>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                ref={triggerRef}
                type="button"
                aria-label={t("overlay.changeProfile")}
                className="size-7 grid place-items-center rounded-full backdrop-blur-md text-ink-2 hover:text-ink transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--raised) 92%, transparent)",
                  border: "1px solid var(--line)",
                }}
              >
                <ProfileIcon icon={icon} className="text-[14px]" />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              sideOffset={8}
              collisionPadding={16}
              className="z-[9999] px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
            >
              {t("overlay.changeProfile")}
              <Tooltip.Arrow className="fill-black/90" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Popover.Root>
      </Tooltip.Root>
    </Tooltip.Provider>
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
            className="size-7 grid place-items-center rounded-full backdrop-blur-md text-ink-2 hover:text-ink transition-colors"
            style={{
              background: "color-mix(in srgb, var(--raised) 92%, transparent)",
              border: "1px solid var(--line)",
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
  const { t } = useTranslation();
  useOverlayTheme();

  const [status, setStatus] = useState<PopupStatus>("idle");
  const [text, setText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<{ rms: number; peak: number }>(
    { rms: -60, peak: -60 },
  );
  const [overlayTransparent, setOverlayTransparent] = useState(true);
  const [pillAnimationComplete, setPillAnimationComplete] = useState(false);
  const [previousExpanded, setPreviousExpanded] = useState(false);
  const [currentProfileIcon, setCurrentProfileIcon] = useState("🌎");
  const [activeProfileId, setActiveProfileId] = useState("default");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [notification, setNotification] = useState<OverlayNotificationData | null>(null);

  const [menuOverrideActive, setMenuOverrideActive] = useState(false);
  const cachedMenuZones = useRef<{
    btn: { x: number; y: number; width: number; height: number } | null;
    pop: { x: number; y: number; width: number; height: number } | null;
    safe: { x: number; y: number; width: number; height: number } | null;
  }>({ btn: null, pop: null, safe: null });

  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  const [hidePill, setHidePill] = useState(false);
  const [debugProximity, setDebugProximity] = useState(false);

  // Bottom margin for the pill - adjust this value to move the pill up/down
  // Higher value = pill higher up, Lower value = pill lower down
  const PILL_BOTTOM_MARGIN = 32; // 32px = pb-8

  const barRef = useRef<HTMLDivElement>(null);

  const isActive = status !== "idle";
  const isNear = useProximity(barRef, 280, 80, menuOverrideActive);
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
    setPillAnimationComplete(false);
    window.overlay.sendIdle();
  }, [clearResultTimer]);

  // Reset pill animation flag when expanded state changes
  useEffect(() => {
    if (expanded && !previousExpanded) {
      setPillAnimationComplete(false);
    }
    setPreviousExpanded(expanded);
  }, [expanded, previousExpanded]);

  useEffect(() => {
    window.overlay.onState((newState: string, _displayLabel: string) => {
      if (newState === "recording") {
        clearResultTimer();
        setStatus("recording");
        setElapsed(0);
        setPillAnimationComplete(false);
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        setPillAnimationComplete(false);
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

    window.overlay.onReset(() => {
      window.overlay.getActiveProfile().then((profile: Profile) => {
        setCurrentProfileIcon(profile.icon);
        setActiveProfileId(profile.id);
      }).catch(() => {});
    });

    window.overlay.onDebugProximityChanged((enabled: boolean) => {
      setDebugProximity(enabled);
    });

    window.overlay.onNotification((data: OverlayNotificationData) => {
      setNotification(data);
    });

    window.overlay.onHidePillChanged((hidden: boolean) => {
      setHidePill(hidden);
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      clearResultTimer();
    };
  }, [clearResultTimer, goIdle]);

  useEffect(() => {
    window.overlay.getActiveProfile().then((profile: Profile) => {
      setCurrentProfileIcon(profile.icon);
      setActiveProfileId(profile.id);
    }).catch(() => {});
    window.overlay.getDebugProximity().then((enabled: boolean) => {
      setDebugProximity(enabled);
    }).catch(() => {});
    window.overlay.getHidePill().then((hidden: boolean) => {
      setHidePill(hidden);
    }).catch(() => {});
  }, []);

  // Activate the override when the menu opens
  useEffect(() => {
    if (isProfileMenuOpen) {
      setMenuOverrideActive(true);
    }
  }, [isProfileMenuOpen]);

  // When a notification is showing, force click-through off
  useEffect(() => {
    if (notification) {
      window.overlay.setClickThrough(false);
    }
  }, [notification]);

  // Close profile menu when cursor leaves the cached menu zones
  useEffect(() => {
    if (!menuOverrideActive) return;

    let isStable = false;
    const stabilityTimer = setTimeout(() => {
      isStable = true;
    }, 150);

    const isInside = (x: number, y: number, rect: { x: number; y: number; width: number; height: number }) =>
      x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isStable && isProfileMenuOpen) return;

      const mx = e.clientX;
      const my = e.clientY;

      // Update cached zones only while the menu is open in the DOM
      if (isProfileMenuOpen) {
        const btn = profileButtonRef.current;
        const pop = popoverContentRef.current;

        if (btn && pop) {
          const btnRect = btn.getBoundingClientRect();
          const popRect = pop.getBoundingClientRect();

          let safeZone = null;
          if (popRect.bottom <= btnRect.top) {
            const minX = Math.min(btnRect.left, popRect.left);
            const maxX = Math.max(btnRect.right, popRect.right);
            const minY = popRect.top;
            const maxY = btnRect.bottom;
            safeZone = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }

          cachedMenuZones.current = {
            btn: { x: btnRect.x, y: btnRect.y, width: btnRect.width, height: btnRect.height },
            pop: { x: popRect.x, y: popRect.y, width: popRect.width, height: popRect.height },
            safe: safeZone,
          };
        }
      }

      const zones = cachedMenuZones.current;

      let inMenuZone = false;
      if (zones.btn && isInside(mx, my, zones.btn)) inMenuZone = true;
      if (zones.pop && isInside(mx, my, zones.pop)) inMenuZone = true;
      if (zones.safe && isInside(mx, my, zones.safe)) inMenuZone = true;

      if (!inMenuZone) {
        setMenuOverrideActive(false);
        if (isProfileMenuOpen) {
          setIsProfileMenuOpen(false);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      clearTimeout(stabilityTimer);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [menuOverrideActive, isProfileMenuOpen]);

  const activeStatus = isActive ? status : null;
  const meta = activeStatus ? statusColor[activeStatus] : null;
  const showSideButtons =
    expanded && status !== "recording" && status !== "transcribing";
  const hasText = text.length > 0;

  const displayText = getDisplayText(text, 4, 40);
  const lineCount = displayText.split("\n").length;
  const isMultiLine = lineCount > 1;
  const pillHeight = isMultiLine ? `${24 + (lineCount - 1) * 18}px` : "36px";

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
    <div className="relative w-full h-full overflow-visible">
      {/* Notification card — sits above the pill */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none"
        style={{ bottom: `${PILL_BOTTOM_MARGIN + 70}px` }}
      >
        <AnimatePresence>
          {notification && (
            <OverlayNotification
              key={notification.id}
              data={notification}
              onDismiss={() => setNotification(null)}
              onAction={(type) => {
                if (type === "open-settings") window.overlay.showSettings();
                setNotification(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Fixed bottom anchor - never moves */}
      <div
        className="absolute left-0 right-0 flex justify-center transition-opacity duration-300"
        style={{
          bottom: `${PILL_BOTTOM_MARGIN}px`,
          opacity: hidePill && status === "idle" ? 0 : undefined,
          pointerEvents: hidePill && status === "idle" ? "none" : undefined,
        }}
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
                <LanguagePopover
                  icon={currentProfileIcon}
                  activeProfileId={activeProfileId}
                  onProfileChange={(profile) => {
                    setCurrentProfileIcon(profile.icon);
                    setActiveProfileId(profile.id);
                  }}
                  open={isProfileMenuOpen}
                  onOpenChange={setIsProfileMenuOpen}
                  triggerRef={profileButtonRef}
                  contentRef={popoverContentRef}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            onClick={handleBarClick}
            className="flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer"
            style={{
              background: "color-mix(in srgb, var(--raised) 92%, transparent)",
              border: "1px solid var(--line)",
              borderRadius: "18px",
              boxShadow: meta ? meta.ring : undefined,
            }}
            animate={{
              width: expanded ? "auto" : "75px",
              height: expanded ? pillHeight : "15px",
              opacity: expanded ? 1 : 0.6,
              paddingLeft: expanded ? "16px" : "12px",
              paddingRight: expanded ? "16px" : "12px",
            }}
            transition={springPresets.pill}
            onAnimationComplete={() => {
              // When expanding animation finishes, mark as complete
              if (expanded && !pillAnimationComplete) {
                setPillAnimationComplete(true);
              }
            }}
          >
            {activeStatus === "recording" && (
              <>
                <Waveform rms={audioLevels.rms} />
                {pillAnimationComplete && (
                  <span className={`text-[13px] font-medium whitespace-nowrap ${meta?.textColor}`}>
                    {t("overlay.recording")} {elapsed.toFixed(1)}s
                  </span>
                )}
              </>
            )}
            {activeStatus === "transcribing" && (
              <>
                <Spinner />
                <span className={`text-[13px] font-medium ${meta?.textColor}`}>
                  {t("overlay.transcribing")}
                </span>
              </>
            )}
            {activeStatus === "inserting" && (
              <>
                <Check
                  className={`size-4 text-emerald-400 shrink-0 ${isMultiLine ? "self-start mt-1" : ""}`}
                  strokeWidth={2.5}
                />
                <span
                  className={`text-[13px] font-medium text-white/90 ${isMultiLine ? "whitespace-pre-wrap text-justify" : "truncate"} max-w-[280px]`}
                >
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
                className="flex items-center gap-2"
                initial={{ opacity: 0, scale: 0.7, x: 15 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7, x: 15 }}
                transition={{ ...springPresets.button, delay: 0.05 }}
              >
                <SideButton
                  tooltip={
                    hasText ? (
                      t("overlay.polishTooltip")
                    ) : (
                      t("overlay.openSettings")
                    )
                  }
                  onClick={hasText ? undefined : handleOpenSettings}
                  ariaLabel={hasText ? t("overlay.polishText") : t("overlay.openSettings")}
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
                <Tooltip.Provider delayDuration={200}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        aria-label={t("overlay.hidePill")}
                        onClick={() => {
                          setHidePill(true);
                          window.overlay.setSettings({ hidePill: true });
                        }}
                        className="size-[18px] grid place-items-center rounded-full backdrop-blur-md text-ink-2 hover:text-ink transition-colors"
                        style={{
                          background: "color-mix(in srgb, var(--raised) 92%, transparent)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <ChevronDown className="size-[8px]" strokeWidth={2.5} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="top"
                        sideOffset={8}
                        collisionPadding={16}
                        className="z-[9999] px-3 py-1.5 rounded-full bg-black/90 backdrop-blur-md text-[11px] font-medium text-white border border-white/5 shadow-lg animate-in fade-in zoom-in-95 duration-150"
                      >
                        {t("overlay.hidePill")}
                        <Tooltip.Arrow className="fill-black/90" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {debugProximity && (
        <ProximityDebugOverlay
          barRef={barRef}
          profileButtonRef={profileButtonRef}
          popoverContentRef={popoverContentRef}
          isProfileMenuOpen={isProfileMenuOpen}
          menuOverrideActive={menuOverrideActive}
          cachedMenuZones={cachedMenuZones}
        />
      )}
    </div>
  );
}

export default OverlayApp;
