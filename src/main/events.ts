import { EventEmitter } from "events";

export type LogTag = "INFO" | "SUCCESS" | "WARN" | "ERROR";
export type AppPhase = "idle" | "recording" | "transcribing";

export interface LevelData {
  rms: number;
  peak: number;
  elapsed: number;
}

export interface AppConfig {
  model: string;
  language: string;
  hotkey: string;
}

class TuiEvents extends EventEmitter {
  log(tag: LogTag, message: string): void {
    this.emit("log", tag, message);
  }

  phase(phase: AppPhase): void {
    this.emit("phase", phase);
  }

  levels(data: LevelData): void {
    this.emit("levels", data);
  }

  config(config: AppConfig): void {
    this.emit("config", config);
  }
}

export const events = new TuiEvents();
