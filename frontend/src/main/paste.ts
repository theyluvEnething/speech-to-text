import { clipboard } from "electron";
import { keyboard, Key } from "@nut-tree-fork/nut-js";

export async function pasteText(text: string): Promise<void> {
  if (!text) return;

  clipboard.writeText(text);

  const modifier = process.platform === "darwin" ? Key.LeftSuper : Key.LeftControl;

  await keyboard.pressKey(modifier);
  await keyboard.pressKey(Key.V);
  await keyboard.releaseKey(Key.V);
  await keyboard.releaseKey(modifier);
}
