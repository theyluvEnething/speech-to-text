/** Shared state for the main process — avoids circular imports between index.ts and windows.ts. */

let appWindowFocused = false;

export function getAppWindowFocused(): boolean {
  return appWindowFocused;
}

export function setAppWindowFocused(value: boolean): void {
  appWindowFocused = value;
}
