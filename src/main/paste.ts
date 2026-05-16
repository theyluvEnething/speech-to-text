import { clipboard } from "electron";

export async function pasteText(text: string): Promise<void> {
  if (!text) return;

  clipboard.writeText(text);

  const { keyboard, Key } = await import("@nut-tree-fork/nut-js");

  const modifier = process.platform === "darwin" ? Key.LeftSuper : Key.LeftControl;

  await keyboard.pressKey(modifier);
  await keyboard.pressKey(Key.V);
  await keyboard.releaseKey(Key.V);
  await keyboard.releaseKey(modifier);
}
