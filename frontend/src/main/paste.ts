import { clipboard } from "electron";
import { keyboard, Key } from "@nut-tree-fork/nut-js";

// A non-zero auto delay prevents the key-down and key-up events from being squashed
// together too fast. Some applications ignore keystrokes that happen in 0ms.
keyboard.config.autoDelayMs = 5;

export async function pasteText(text: string): Promise<void> {
  if (!text) return;

  clipboard.writeText(text);

  const modifier = process.platform === "darwin" ? Key.LeftSuper : Key.LeftControl;

  // Give the OS a moment to sync the clipboard state before we fire the paste command.
  await new Promise(resolve => setTimeout(resolve, 20));

  await keyboard.type(modifier, Key.V);

  // CRITICAL — wait before resolving. The target application needs time to process
  // the keystroke and read the clipboard. If we resolve immediately, the caller in
  // index.ts restores the old clipboard content before the paste actually happens.
  await new Promise(resolve => setTimeout(resolve, 150));
}
