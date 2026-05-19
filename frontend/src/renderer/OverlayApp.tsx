import React, { useState, useEffect, useRef, useCallback } from "react";

type OverlayState = "idle" | "recording" | "processing" | "result" | "error";

const BAR_COUNT = 5;

function mapDbToHeight(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  const normalized = (clamped + 60) / 60;
  return 3 + normalized * normalized * 22;
}

function AudioBars({ rms, peak }: { rms: number; peak: number }): React.ReactElement {
  const [heights, setHeights] = useState<number[]>([3, 4, 5, 4, 3]);
  const prevRef = useRef<number[]>([3, 4, 5, 4, 3]);

  useEffect(() => {
    const baseHeight = mapDbToHeight(rms);
    const volumeNorm = Math.max(0, Math.min(1, (rms + 60) / 60));
    const chaos = volumeNorm * 0.6;

    const next = Array.from({ length: BAR_COUNT }, (_, i) => {
      const positionFactor = 1 - Math.abs(i - 2) * 0.15;
      const noise = (Math.random() - 0.5) * 2 * chaos * 8;
      const peakBoost = volumeNorm > 0.4 ? (Math.random() * peak * 0.03) : 0;
      return Math.max(3, baseHeight * positionFactor + noise + peakBoost);
    });

    const smoothed = next.map((h, i) => {
      const prev = prevRef.current[i] ?? h;
      return prev + (h - prev) * 0.55;
    });

    prevRef.current = smoothed;
    setHeights(smoothed);
  }, [rms, peak]);

  return (
    <div className="flex items-end gap-[3px] h-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-red-400"
          style={{
            height: `${h}px`,
            opacity: 0.5 + (Math.max(0, Math.min(1, (rms + 60) / 60))) * 0.5,
            transition: "height 90ms ease-out, opacity 90ms ease-out",
          }}
        />
      ))}
    </div>
  );
}

function OverlayApp(): React.ReactElement {
  const [state, setState] = useState<OverlayState>("idle");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [audioLevels, setAudioLevels] = useState<{ rms: number; peak: number }>({ rms: -60, peak: -60 });

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goIdleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastResize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

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
    setExiting(true);
    goIdleTimeout.current = setTimeout(() => {
      setVisible(false);
      setState("idle");
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
    if (visible && (state === "result" || state === "error")) {
      requestAnimationFrame(() => {
        requestResize();
      });
    }
  }, [text, visible, state, requestResize]);

  useEffect(() => {
    if (visible && state === "recording") {
      const w = 360;
      const h = 80;
      if (lastResize.current.w !== w || lastResize.current.h !== h) {
        lastResize.current = { w, h };
        window.overlay.requestResize(w, h);
      }
    }
  }, [visible, state]);

  useEffect(() => {
    window.overlay.onState((newState: string, displayLabel: string) => {
      setLabel(displayLabel || "");
      if (newState === "recording") {
        clearResultTimer();
        clearGoIdleTimeout();
        setExiting(false);
        setState("recording");
        setVisible(true);
        setAnimKey((k) => k + 1);
        setElapsed(0);
        timer.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        clearResultTimer();
        clearGoIdleTimeout();
        setExiting(false);
        setState("processing");
      } else if (newState === "idle") {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        goIdle();
      }
    });

    window.overlay.onResult((resultText: string) => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      clearResultTimer();
      clearGoIdleTimeout();
      setExiting(false);
      setState("result");
      setText(resultText);
      setAnimKey((k) => k + 1);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 3000);
    });

    window.overlay.onError((msg: string) => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      clearResultTimer();
      clearGoIdleTimeout();
      setExiting(false);
      setState("error");
      setText(msg);
      setAnimKey((k) => k + 1);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 3000);
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

  if (!visible) return <div />;

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isResult = state === "result";
  const isError = state === "error";

  const borderColor = isRecording
    ? "border-red-500/50"
    : isProcessing
      ? "border-amber-500/50"
      : isError
        ? "border-red-600/50"
        : "border-emerald-500/30";

  const glowColor = isRecording
    ? "animate-glow-pulse"
    : isProcessing
      ? "shadow-[0_0_30px_rgba(245,158,11,0.15)]"
      : isError
        ? "shadow-[0_0_30px_rgba(220,38,38,0.15)]"
        : "shadow-[0_0_30px_rgba(16,185,129,0.12)]";

  const animClass = exiting
    ? "animate-popup-exit"
    : "animate-popup-enter";

  return (
    <div className="flex items-end justify-center w-full h-full pb-2">
      <div
        key={animKey}
        ref={contentRef}
        className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl
          bg-surface-900/90 backdrop-blur-2xl border
          shadow-2xl shadow-black/40 ${glowColor} ${borderColor}
          ${animClass}
          max-w-[680px]`}
      >
        {/* Left indicator */}
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          {isRecording ? (
            <AudioBars rms={audioLevels.rms} peak={audioLevels.peak} />
          ) : isProcessing ? (
            <div className="w-5 h-5 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" />
          ) : isError ? (
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 3.5v3M6 8v.5" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4.5L5 8l5-5" />
              </svg>
            </div>
          )}
        </div>

        {/* Center content */}
        <div className="flex-1 min-w-0">
          {isRecording ? (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-white">{label || "Recording"}</span>
              <span className="text-xs text-surface-400 tabular-nums">{elapsed.toFixed(1)}s</span>
            </div>
          ) : isProcessing ? (
            <p className="text-sm font-medium text-amber-300/90">{label || "Transcribing…"}</p>
          ) : isError ? (
            <p className="text-sm text-red-400/90 leading-snug break-words">{text}</p>
          ) : (
            <p className="text-sm text-white/90 leading-snug break-words">{text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayApp;
