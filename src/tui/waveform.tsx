import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import type { ReactNode } from "react";

const ROWS = 6;

function generateAmps(prev: number[], active: boolean, level: number): number[] {
  return prev.map((p, i) => {
    if (!active) return p * 0.88;
    const center = 1 - Math.abs(i / prev.length - 0.5) * 1.3;
    const noise = 0.5 + Math.random() * 0.5;
    const boosted = Math.pow(level, 0.55);
    const target = center * noise * Math.max(boosted, 0.08);
    return p + (target - p) * 0.3;
  });
}

const CHARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

interface WaveformProps {
  width: number;
  isRecording: boolean;
  level?: number;
}

export default function Waveform({ width, isRecording, level = 0 }: WaveformProps): ReactNode {
  const cols = Math.min(width - 3, 80);
  const [amps, setAmps] = useState<number[]>(() =>
    Array.from({ length: cols }, () => 0),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef(level);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setAmps((prev) => generateAmps(prev, isRecording, levelRef.current));
    }, 60);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRecording]);

  const maxAmp = Math.max(...amps);

  const rows = Array.from({ length: ROWS }, (_, row) => {
    const threshold = (ROWS - row) / ROWS;
    return amps
      .map((amp) => {
        const normalized = amp / threshold;
        const idx = Math.min(
          CHARS.length - 1,
          Math.floor(normalized * CHARS.length),
        );
        return CHARS[idx] ?? " ";
      })
      .join("");
  });

  if (!isRecording && maxAmp < 0.01) {
    const idleLine = CHARS[1]!.repeat(cols);
    return (
      <Box flexDirection="column" paddingLeft={2}>
        {Array.from({ length: ROWS }, (_, i) => (
          <Text key={i} dimColor>
            {idleLine}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {rows.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
