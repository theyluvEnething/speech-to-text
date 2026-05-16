import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput, useStdout, useApp } from "ink";
import type { ReactNode } from "react";
import { EventEmitter } from "events";
import Header from "./header";
import LogPanel from "./log-panel";
import type { LogEntry } from "./log-panel";
import Waveform from "./waveform";
import FullScreen from "./fullscreen";
import Spinner from "./spinner";

function timeStr(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

let nextId = 1;

const SAMPLES = [
  "No way it already works so far.",
  "Okay, this is actually so fast.",
  "How does this even work?",
  "Testing the speech recognition model.",
  "The transcription quality is incredible.",
  "Can you hear me clearly now?",
  "This is a test of the speech to text system.",
];

function randomSample(): string {
  return SAMPLES[Math.floor(Math.random() * SAMPLES.length)] ?? "Test transcript.";
}

const HEADER_ROWS = 3;
const WAVEFORM_ROWS = 6;
const STATUS_ROWS = 1;
const SEPARATORS = 2;
const FIXED = HEADER_ROWS + WAVEFORM_ROWS + STATUS_ROWS + SEPARATORS;

type AppPhase = "idle" | "recording" | "transcribing";

interface AppProps {
  events?: EventEmitter;
}

export default function App({ events: externalEvents }: AppProps): ReactNode {
  const { stdout } = useStdout();
  const { exit } = useApp();
  const terminalRows = stdout?.rows ?? 24;
  const terminalCols = stdout?.columns ?? 80;

  const [phase, setPhase] = useState<AppPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [model, setModel] = useState("nova-2");
  const [language, setLanguage] = useState("English");
  const [hotkey, setHotkey] = useState("Ctrl+Space");
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    { id: nextId++, timestamp: timeStr(), tag: "INFO", message: "Whispr Flow started." },
    { id: nextId++, timestamp: timeStr(), tag: "SUCCESS", message: "Deepgram API key configured." },
    { id: nextId++, timestamp: timeStr(), tag: "INFO", message: "Ready — press Ctrl+Space to record." },
  ]);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const standalone = !externalEvents;

  const logHeight = Math.max(terminalRows - FIXED, 1);

  const addLog = useCallback((tag: LogEntry["tag"], message: string) => {
    setLogs((prev) => [
      ...prev,
      { id: nextId++, timestamp: timeStr(), tag, message },
    ]);
  }, []);

  const simulateTranscribe = useCallback(() => {
    setPhase("transcribing");
    addLog("INFO", "Transcribing audio via Deepgram...");
    setTimeout(() => {
      const text = randomSample();
      addLog("SUCCESS", `Transcription: "${text}"`);
      setPhase("idle");
    }, 2200);
  }, [addLog]);

  useEffect(() => {
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  useEffect(() => {
    if (!externalEvents) return;

    function onLog(tag: string, message: string) {
      addLog(tag as LogEntry["tag"], message);
    }

    function onPhase(p: string) {
      setPhase(p as AppPhase);
      if (p === "recording") {
        setElapsed(0);
        elapsedRef.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
      } else if (p === "transcribing" || p === "idle") {
        if (elapsedRef.current) {
          clearInterval(elapsedRef.current);
          elapsedRef.current = null;
        }
      }
    }

    function onLevels(data: { rms: number }) {
      const normalized = Math.min(Math.max((data.rms + 60) / 60, 0), 1);
      setLevel(normalized);
    }

    function onConfig(data: { model: string; language: string; hotkey: string }) {
      setModel(data.model);
      setLanguage(data.language);
      setHotkey(data.hotkey);
    }

    externalEvents.on("log", onLog);
    externalEvents.on("phase", onPhase);
    externalEvents.on("levels", onLevels);
    externalEvents.on("config", onConfig);

    return () => {
      externalEvents.off("log", onLog);
      externalEvents.off("phase", onPhase);
      externalEvents.off("levels", onLevels);
      externalEvents.off("config", onConfig);
    };
  }, [externalEvents, addLog]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      addLog("INFO", "Shutting down.");
      setTimeout(() => exit(), 300);
      return;
    }

    if (!standalone) return;

    if (key.ctrl && (input === " " || input === "\x00")) {
      if (phase === "recording") {
        setPhase("transcribing");
        if (elapsedRef.current) {
          clearInterval(elapsedRef.current);
          elapsedRef.current = null;
        }
        addLog("WARN", `Recording stopped (${elapsed.toFixed(1)}s) — transcribing...`);
        simulateTranscribe();
      } else if (phase === "idle") {
        setPhase("recording");
        setElapsed(0);
        elapsedRef.current = setInterval(() => {
          setElapsed((e) => e + 0.1);
        }, 100);
        addLog("SUCCESS", "Recording started.");
      }
      return;
    }

    if (input === "q" && phase === "idle") {
      addLog("INFO", "Shutting down.");
      setTimeout(() => exit(), 300);
    }
  });

  const sep = "─".repeat(Math.max(terminalCols, 40));

  const isRecording = phase === "recording";

  return (
    <FullScreen>
      <Box flexDirection="column" height={terminalRows}>
        <Header
          width={terminalCols}
          model={model}
          language={language}
          hotkey={hotkey}
          isRecording={isRecording}
          elapsed={elapsed}
        />

        <Text dimColor>{sep}</Text>

        <LogPanel height={logHeight} width={terminalCols} logs={logs} />

        <Text dimColor>{sep}</Text>

        <Waveform
          width={terminalCols}
          isRecording={isRecording}
          level={level}
        />

        <Box
          width={terminalCols}
          paddingLeft={2}
          justifyContent="space-between"
        >
          <Box>
            {isRecording && (
              <>
                <Text color="red" bold>{"●"} </Text>
                <Text color="white">Recording</Text>
              </>
            )}
            {phase === "transcribing" && (
              <>
                <Spinner />
                <Text> </Text>
                <Text color="yellow">Transcribing</Text>
              </>
            )}
            {phase === "idle" && (
              <>
                <Text color="green">{"◉ "}</Text>
                <Text dimColor>Ready</Text>
              </>
            )}
          </Box>

          <Box gap={2}>
            {standalone && (
              <>
                <Text dimColor>
                  <Text color="magenta">{hotkey}</Text> record
                </Text>
                <Text dimColor>
                  <Text color="magenta">q</Text> quit
                </Text>
              </>
            )}
            {!standalone && (
              <Text dimColor>
                <Text color="magenta">Ctrl+C</Text> quit
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    </FullScreen>
  );
}
