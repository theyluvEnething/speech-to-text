import React, { useState, useCallback } from "react";
import { Box, useInput, useStdout, useApp } from "ink";
import type { ReactNode } from "react";
import Header from "./header";
import LogPanel from "./log-panel";
import type { LogEntry } from "./log-panel";
import Waveform from "./waveform";
import FullScreen from "./fullscreen";

function timeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

let nextId = 1;

const SAMPLES = [
  "No way it already works so far.",
  "Okay, this is actually so fast.",
  "How does this even work?",
  "Testing the speech recognition model.",
];

function randomSample(): string {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)] ?? "Test transcript.";
}

const ROWS = 8;
const HEADER_HEIGHT = 3;
const WAVEFORM_HEIGHT = ROWS + 2;

export default function App(): ReactNode {
  const { stdout } = useStdout();
  const { exit } = useApp();
  const terminalRows = stdout?.rows ?? 24;
  const terminalCols = stdout?.columns ?? 80;

  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    { id: nextId++, timestamp: timeStr(), tag: "INFO", message: "Whispr Flow started." },
    { id: nextId++, timestamp: timeStr(), tag: "INFO", message: "Deepgram API key configured." },
    { id: nextId++, timestamp: timeStr(), tag: "INFO", message: "Ready — press Ctrl+Space to record." },
  ]);

  const logHeight = Math.max(terminalRows - HEADER_HEIGHT - WAVEFORM_HEIGHT, 4);

  const addLog = useCallback((tag: LogEntry["tag"], message: string) => {
    setLogs((prev) => [
      ...prev,
      { id: nextId++, timestamp: timeStr(), tag, message },
    ]);
  }, []);

  const simulateTranscribe = useCallback(() => {
    addLog("INFO", "Transcribing audio...");
    setTimeout(() => {
      const text = randomSample();
      addLog("SUCCESS", `Transcription complete: "${text}"`);
    }, 2000);
  }, [addLog]);

  useInput((input, key) => {
    if (key.ctrl && (input === " " || input === "\x00")) {
      if (isRecording) {
        setIsRecording(false);
        addLog("WARN", "Recording stopped -- transcribing...");
        simulateTranscribe();
      } else {
        setIsRecording(true);
        addLog("SUCCESS", "Recording started.");
      }
      return;
    }

    if (input === "q" && !isRecording) {
      exit();
    }
  });

  return (
    <FullScreen>
      <Box flexDirection="column" height={terminalRows}>
        <Header
          width={terminalCols}
          model="nova-2"
          language="English"
          hotkey="Ctrl+Space"
          isRecording={isRecording}
        />

        <LogPanel
          height={logHeight}
          width={terminalCols}
          logs={logs}
        />

        <Waveform
          width={terminalCols}
          isRecording={isRecording}
        />
      </Box>
    </FullScreen>
  );
}
