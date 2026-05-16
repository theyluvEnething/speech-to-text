import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import type { ReactNode } from "react";

const COLS = 30;
const ROWS = 8;

function colorForAmp(amp: number): string {
  if (amp < 0.33) return "green";
  if (amp < 0.66) return "yellow";
  return "red";
}

function generateAmplitudes(): number[] {
  return Array.from({ length: COLS }, () => Math.random());
}

interface WaveformProps {
  width: number;
  isRecording: boolean;
}

export default function Waveform({ width, isRecording }: WaveformProps): ReactNode {
  const [amps, setAmps] = useState<number[]>(() =>
    Array.from({ length: COLS }, () => 0),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      setAmps(generateAmplitudes());
      intervalRef.current = setInterval(() => {
        setAmps((prev) => {
          const next = [...prev.slice(1), Math.random()];
          // smooth: blend toward previous neighbor
          for (let i = 0; i < COLS - 1; i++) {
            next[i] = next[i]! * 0.6 + prev[i + 1]! * 0.4;
          }
          return next as number[];
        });
      }, 80);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRecording]);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      height={ROWS + 2}
      width={width}
      paddingX={1}
    >
      {!isRecording ? (
        <Box height={ROWS} justifyContent="center" alignItems="center">
          <Text dimColor>{"──  no audio  ──"}</Text>
        </Box>
      ) : (
        <Box flexDirection="column" height={ROWS}>
          {Array.from({ length: ROWS }, (_, row) => {
            const threshold = (ROWS - 1 - row) / ROWS;
            return (
              <Box key={row} flexDirection="row">
                {amps.map((amp, col) => {
                  const filled = amp >= threshold;
                  const char = filled ? "█" : " ";
                  return (
                    <Text key={col} color={filled ? colorForAmp(amp) : undefined}>
                      {char}
                    </Text>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
