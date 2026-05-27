const RI_BASE = 0x1f1e6;

export function isFlagEmoji(emoji: string): boolean {
  const chars = [...emoji];
  if (chars.length !== 2) return false;
  const a = chars[0]!.codePointAt(0)!;
  const b = chars[1]!.codePointAt(0)!;
  return a >= RI_BASE && a < RI_BASE + 26 && b >= RI_BASE && b < RI_BASE + 26;
}

export function flagEmojiToCountryCode(emoji: string): string | null {
  if (!isFlagEmoji(emoji)) return null;
  const chars = [...emoji];
  const a = chars[0]!.codePointAt(0)! - RI_BASE;
  const b = chars[1]!.codePointAt(0)! - RI_BASE;
  return String.fromCharCode(65 + a) + String.fromCharCode(65 + b);
}
