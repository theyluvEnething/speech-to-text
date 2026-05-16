import React, { useState, useEffect, useRef, useCallback } from "react";

type OverlayState = "idle" | "recording" | "processing" | "result" | "error";

interface LevelData {
  rms: number;
  peak: number;
  elapsed: number;
  samples: number;
  final?: boolean;
}

const BAR_COUNT = 36;
const CANVAS_W = 260;
const CANVAS_H = 36;

function OverlayApp(): React.ReactElement {
  const [state, setState] = useState<OverlayState>("idle");
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef(new Float32Array(BAR_COUNT));
  const targetsRef = useRef(new Float32Array(BAR_COUNT));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const bars = barsRef.current;
    const targets = targetsRef.current;
    const active = state === "recording";

    for (let i = 0; i < BAR_COUNT; i++) {
      const target = targets[i] ?? 0;
      const current = bars[i] ?? 0;
      bars[i] = current + (target - current) * 0.3;
    }

    if (!active) {
      const decay = 0.92;
      for (let i = 0; i < BAR_COUNT; i++) {
        bars[i] = (bars[i] ?? 0) * decay;
        targets[i] = (targets[i] ?? 0) * decay;
      }
    }

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (active || bars.some((b) => b > 0.01)) {
      const barW = (CANVAS_W / BAR_COUNT) * 0.7;
      const gap = (CANVAS_W / BAR_COUNT) * 0.3;
      const midY = CANVAS_H / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const level = bars[i] ?? 0;
        const h = Math.max(1.5, level * (CANVAS_H / 2 - 2));
        const x = i * (barW + gap) + gap / 2;
        const y = midY - h / 2;
        const radius = Math.max(1, barW / 2);

        const t = i / (BAR_COUNT - 1);
        const hue = 255 + t * 55;
        const lightness = active ? 55 + level * 30 : 40;

        ctx.fillStyle = `hsl(${hue}, 60%, ${lightness}%)`;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
        ctx.lineTo(x + barW, y + h - radius);
        ctx.arcTo(x + barW, y + h, x + barW - radius, y + h, radius);
        ctx.lineTo(x + radius, y + h);
        ctx.arcTo(x, y + h, x, y + h - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

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

    window.overlay.onLevels((data: LevelData) => {
      if (data.final) return;
      const targets = targetsRef.current;
      const normalized = Math.min(Math.max((data.rms + 60) / 60, 0), 1);
      for (let i = 0; i < BAR_COUNT; i++) {
        const t = i / (BAR_COUNT - 1);
        const bell = Math.exp(-(((t - 0.5) * 3) ** 2));
        const noise = 0.3 + Math.random() * 0.7;
        targets[i] = normalized * bell * noise;
      }
    });

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!visible && state === "idle") return <div />;

  const isRecording = state === "recording";

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div
        className="flex flex-col items-center gap-2 px-5 py-3 rounded-xl
          bg-surface-900/95 border shadow-2xl shadow-black/50
          transition-all duration-300
          min-w-[300px]"
        style={{
          backgroundColor: "rgba(13, 17, 23, 0.96)",
          backdropFilter: "blur(20px)",
          borderColor: isRecording
            ? "rgba(239, 68, 68, 0.6)"
            : state === "processing"
              ? "rgba(251, 191, 36, 0.6)"
              : state === "error"
                ? "rgba(220, 38, 38, 0.6)"
                : "rgba(108, 92, 231, 0.6)",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: CANVAS_W, height: CANVAS_H, display: "block" }}
        />

        <div className="flex items-center gap-3 w-full">
          <div
            className="relative flex items-center justify-center shrink-0"
            style={{ width: 12, height: 12 }}
          >
            {isRecording && (
              <div
                className="absolute rounded-full animate-ping opacity-75"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: "rgb(239, 68, 68)",
                }}
              />
            )}
            <div
              className="rounded-full"
              style={{
                width: 12,
                height: 12,
                backgroundColor: isRecording
                  ? "rgb(239, 68, 68)"
                  : state === "processing"
                    ? "rgb(251, 191, 36)"
                    : state === "error"
                      ? "rgb(220, 38, 38)"
                      : "rgb(108, 92, 231)",
                boxShadow: isRecording
                  ? "0 0 12px rgba(239, 68, 68, 0.8)"
                  : "none",
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-semibold">
                  Recording
                </span>
                <span
                  className="text-xs tabular-nums"
                  style={{ color: "rgb(173, 181, 189)" }}
                >
                  {elapsed.toFixed(1)}s
                </span>
              </div>
            ) : state === "processing" ? (
              <p
                className="text-sm font-medium"
                style={{ color: "rgb(209, 213, 219)" }}
              >
                Processing…
              </p>
            ) : state === "error" ? (
              <p
                className="text-sm truncate leading-tight"
                style={{ color: "rgb(252, 165, 165)" }}
              >
                {text}
              </p>
            ) : (
              <p
                className="text-sm truncate leading-tight"
                style={{ color: "rgba(255, 255, 255, 0.9)" }}
              >
                {text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OverlayApp;
