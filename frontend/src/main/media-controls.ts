/**
 * Media controls during transcription.
 *
 * Pauses only sources that are actually playing and resumes exactly those
 * afterwards — never starts something that was stopped.
 *   - Windows: System Media Transport Controls (SMTC) via WinRT in PowerShell.
 *     Covers any SMTC-aware app (Spotify, browsers/YouTube, VLC, …).
 *   - macOS: AppleScript control of Spotify and Apple Music.
 */

import { execFile } from "child_process";
import {
  parsePausedIds,
  windowsPauseScript,
  windowsResumeScript,
  macPauseScript,
  macResumeScript,
} from "./media-scripts";

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

/** Ids of sources we paused, so we resume exactly those. */
let pausedMediaIds: string[] = [];

function L(msg: string): void {
  console.log(`[MediaControls] ${msg}`);
}

function run(file: string, args: string[], label: string): Promise<string> {
  L(`  [run: ${label}]`);
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 6000, windowsHide: true }, (err, stdout, stderr) => {
      const errOut = stderr.trim();
      if (errOut) L(`  [stderr] ${errOut.split("\n").join(" | ")}`);
      if (err) L(`  [FAILED] ${err.message}`);
      resolve(stdout.trim());
    });
  });
}

function runPowerShell(script: string, label: string): Promise<string> {
  return run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    label,
  );
}

function runOsascript(script: string, label: string): Promise<string> {
  return run("osascript", ["-e", script], label);
}

async function pausePlayingMedia(): Promise<string[]> {
  if (isWindows) return parsePausedIds(await runPowerShell(windowsPauseScript(), "smtc pause"));
  if (isMac) return parsePausedIds(await runOsascript(macPauseScript(), "media pause"));
  L("media pause not supported on this platform — skip");
  return [];
}

async function resumeMedia(ids: string[]): Promise<void> {
  if (!ids.length) return;
  L(`→ resume media: ${ids.join(", ")}`);
  if (isWindows) {
    await runPowerShell(windowsResumeScript(ids), "smtc resume");
  } else if (isMac) {
    await runOsascript(macResumeScript(ids), "media resume");
  }
}

export interface MediaControlsSettings {
  mediaPauseEnabled: boolean;
}

export async function applyMediaControls(cfg: MediaControlsSettings): Promise<void> {
  L(`=== apply mediaPause=${cfg.mediaPauseEnabled}`);
  pausedMediaIds = [];

  if (cfg.mediaPauseEnabled) {
    pausedMediaIds = await pausePlayingMedia();
    L(`  paused ${pausedMediaIds.length} source(s): ${pausedMediaIds.join(", ") || "(none playing)"}`);
  } else {
    L("  media pause disabled — skip");
  }

  L("=== apply END");
}

/** Resume whatever we paused, driven by recorded state. */
async function undo(): Promise<void> {
  if (pausedMediaIds.length) await resumeMedia(pausedMediaIds);
  pausedMediaIds = [];
}

export async function restoreMediaControls(): Promise<void> {
  L(`=== restore paused=${pausedMediaIds.length}`);
  await undo();
  L("=== restore END");
}

export async function cleanupMediaControls(): Promise<void> {
  L(`=== cleanup paused=${pausedMediaIds.length}`);
  await undo();
}
