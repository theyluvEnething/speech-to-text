import React, { useState, useEffect, useRef } from "react";

type OverlayState = "idle" | "recording" | "processing" | "result" | "error";

function AudioBars({ active }: { active: boolean }): React.ReactElement {
  const [heights, setHeights] = useState([2, 3, 4, 3, 2]);
  const interval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (active) {
      interval.current = setInterval(() => {
        setHeights([
          Math.random() * 10 + 2,
          Math.random() * 14 + 3,
          Math.random() * 16 + 4,
          Math.random() * 14 + 3,
          Math.random() * 10 + 2,
        ]);
      }, 120);
    } else {
      if (interval.current) clearInterval(interval.current);
      setHeights([2, 3, 4, 3, 2]);
    }
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [active]);

  return (
    <div className="flex items-end gap-[3px] h-5">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-red-400 transition-all duration-[120ms] ease-linear"
          style={{ height: `${h}px`, opacity: active ? 0.9 : 0.5 }}
        />
      ))}
    </div>
  );
}

function OverlayApp(): React.ReactElement {
  const [state, setState] = useState<OverlayState>("idle");
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearResultTimer(): void {
    if (resultTimeout.current) {
      clearTimeout(resultTimeout.current);
      resultTimeout.current = null;
    }
  }

  function goIdle(): void {
    setVisible(false);
    setState("idle");
    setText("");
    window.overlay.sendIdle();
  }

  useEffect(() => {
    window.overlay.onState((newState: string) => {
      if (newState === "recording") {
        clearResultTimer();
        setState("recording");
        setVisible(true);
        setElapsed(0);
        timer.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        clearResultTimer();
        setState("processing");
      } else if (newState === "idle") {
        if (timer.current) { clearInterval(timer.current); timer.current = null; }
        clearResultTimer();
        goIdle();
      }
    });

    window.overlay.onResult((resultText: string) => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      clearResultTimer();
      setState("result");
      setText(resultText);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 3000);
    });

    window.overlay.onError((msg: string) => {
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
      clearResultTimer();
      setState("error");
      setText(msg);
      resultTimeout.current = setTimeout(() => {
        goIdle();
      }, 3000);
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      clearResultTimer();
    };
  }, []);

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
        : "border-emerald-500/40";

  const glowColor = isRecording
    ? "animate-glow-pulse"
    : isProcessing
      ? "shadow-[0_0_30px_rgba(245,158,11,0.15)]"
      : isError
        ? "shadow-[0_0_30px_rgba(220,38,38,0.15)]"
        : "shadow-[0_0_30px_rgba(16,185,129,0.15)]";

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl
          bg-surface-900/90 backdrop-blur-2xl border
          shadow-2xl shadow-black/40 ${glowColor} ${borderColor}
          animate-fade-in animate-zoom-in
          min-w-[240px] max-w-[400px]`}
      >
        {/* Left indicator */}
        <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
          {isRecording ? (
            <AudioBars active={true} />
          ) : isProcessing ? (
            <div className="w-5 h-5 rounded-full border-2 border-amber-400/60 border-t-transparent animate-spin" />
          ) : isError ? (
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgb(239,68,68)" strokeWidth="1.5" strokeLinecap="round">
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
              <span className="text-sm font-semibold text-white">Recording</span>
              <span className="text-xs text-surface-400 tabular-nums">{elapsed.toFixed(1)}s</span>
            </div>
          ) : isProcessing ? (
            <p className="text-sm font-medium text-amber-300/90">Transcribing…</p>
          ) : isError ? (
            <p className="text-sm text-red-400/90 truncate leading-snug">{text}</p>
          ) : (
            <p className="text-sm text-white/90 leading-snug">{text}</p>
          )}
        </div>

        {/* Right hint */}
        {isRecording && (
          <span className="text-[10px] text-surface-600 shrink-0 animate-pulse">
            ESC
          </span>
        )}
      </div>
    </div>
  );
}

export default OverlayApp;
