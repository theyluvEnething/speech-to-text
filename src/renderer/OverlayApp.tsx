import React, { useState, useEffect } from "react";

type OverlayState = "idle" | "recording" | "processing" | "result" | "error";

function OverlayApp(): React.ReactElement {
  const [state, setState] = useState<OverlayState>("idle");
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    window.overlay.onState((newState: string) => {
      if (newState === "recording") {
        setState("recording");
        setVisible(true);
        setElapsed(0);
        timer = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (newState === "processing") {
        if (timer) { clearInterval(timer); timer = null; }
        setState("processing");
      } else if (newState === "idle") {
        if (timer) { clearInterval(timer); timer = null; }
        setVisible(false);
        setState("idle");
      }
    });

    window.overlay.onResult((resultText: string) => {
      if (timer) { clearInterval(timer); timer = null; }
      setState("result");
      setText(resultText);
      setTimeout(() => {
        setVisible(false);
        setState("idle");
        setText("");
      }, 3000);
    });

    window.overlay.onError((msg: string) => {
      if (timer) { clearInterval(timer); timer = null; }
      setState("error");
      setText(msg);
      setTimeout(() => {
        setVisible(false);
        setState("idle");
        setText("");
      }, 3000);
    });

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!visible) return <div />;

  const isRecording = state === "recording";

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-xl
          bg-surface-900/95 backdrop-blur-xl border shadow-2xl shadow-black/50
          transition-all duration-300
          min-w-[220px] max-w-[360px]
          ${isRecording
            ? "border-red-500/60 scale-105"
            : state === "processing"
              ? "border-amber-500/60"
              : state === "error"
                ? "border-red-600/60"
                : "border-accent/60"
          }`}
      >
        <div className="relative flex items-center justify-center w-3 h-3">
          <div
            className={`absolute w-3 h-3 rounded-full
              ${isRecording ? "bg-red-500 animate-ping opacity-75" : ""}`}
          />
          <div
            className={`w-3 h-3 rounded-full
              ${isRecording
                ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                : state === "processing"
                  ? "bg-amber-500 animate-pulse"
                  : state === "error"
                    ? "bg-red-600"
                    : "bg-accent"
              }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          {isRecording ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-semibold">Recording</span>
              <span className="text-xs text-surface-400 tabular-nums">
                {elapsed.toFixed(1)}s
              </span>
            </div>
          ) : state === "processing" ? (
            <p className="text-sm text-surface-300 font-medium">Processing…</p>
          ) : state === "error" ? (
            <p className="text-sm text-red-400 truncate leading-tight">{text}</p>
          ) : (
            <p className="text-sm text-white/90 truncate leading-tight">{text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayApp;
