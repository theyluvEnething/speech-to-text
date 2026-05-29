/**
 * theme.ts — Wavely Design System · SINGLE SOURCE OF TRUTH
 * Path: src/styles/theme.ts
 *
 * Swap the entire theme by editing ONLY this file:
 *   • COLOR_PALETTE   → the raw hex scale (the only place hex lives)
 *   • DARK / LIGHT    → semantic role → palette-shade maps
 *   • RADII / SPACE   → geometry tokens
 *   • WV_*            → reusable Tailwind class-string tokens
 *
 * Nothing else in the codebase should contain a hardcoded hex value.
 */

/* ─────────────────────────────────────────────────────────────────────────
 * 1. COLOR PALETTE  (increments of 50/100)
 * ──────────────────────────────────────────────────────────────────────── */
export const COLOR_PALETTE = {
   50: "#eef4f6",
  100: "#dde9ee",
  200: "#bcd3dc",
  300: "#9abccb",
  400: "#78a6ba",
  500: "#5790a8",
  600: "#457387",
  700: "#345665",
  800: "#233a43",
  825: "#1f333b",
  850: "#1a2c33",
  900: "#111d22",
  950: "#0c1418",
} as const;

export type PaletteShade = keyof typeof COLOR_PALETTE;
export type ThemeMode = "dark" | "light";

/* ─────────────────────────────────────────────────────────────────────────
 * 2. SEMANTIC TOKENS  (role → shade). Components never read COLOR_PALETTE
 *    directly; they use these names via CSS variables / Tailwind classes.
 * ──────────────────────────────────────────────────────────────────────── */
export interface ColorTokens {
  // shadcn-compatible names (so existing primitives retheme automatically)
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;            // hover surface (shadcn "accent")
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;

  // redesign-specific names
  surface: string;
  raised: string;
  hover: string;
  line: string;
  lineSoft: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  acc: string;
  accStrong: string;
  accFaint: string;
  keyBg: string;
  keyInk: string;
  badgeBg: string;
  badgeInk: string;
  toggleOn: string;
  btnPrimary: string;
  btnPrimaryInk: string;
  btnSoftBg: string;
  btnSoftInk: string;
  chartTrack: string;
  dataHigh: string;
  dataMid: string;
  dataLow: string;
  dataFaint: string;
  heatEmpty: string;
}

const P = COLOR_PALETTE;

export const DARK: ColorTokens = {
  background: P[825], foreground: P[50],
  card: P[700], cardForeground: P[50],
  popover: P[800], popoverForeground: P[50],
  primary: P[50], primaryForeground: P[900],
  muted: P[700], mutedForeground: P[300],
  accent: P[600], accentForeground: P[50],
  border: P[600], input: P[700], ring: P[400],
  sidebar: P[825],

  surface: P[800], raised: P[700], hover: P[600],
  line: P[600], lineSoft: P[700],
  ink: P[50], ink2: P[100], ink3: P[300], ink4: P[500],
  acc: P[300], accStrong: P[200], accFaint: P[700],
  keyBg: P[600], keyInk: P[50],
  badgeBg: P[600], badgeInk: P[200],
  toggleOn: P[400],
  btnPrimary: P[50], btnPrimaryInk: P[900],
  btnSoftBg: P[700], btnSoftInk: P[100],
  chartTrack: P[700],
  dataHigh: P[400], dataMid: P[300], dataLow: P[200], dataFaint: P[600],
  heatEmpty: P[700],
};

export const LIGHT: ColorTokens = {
  background: P[100], foreground: P[950],
  card: P[50], cardForeground: P[950],
  popover: P[50], popoverForeground: P[950],
  primary: P[900], primaryForeground: P[50],
  muted: P[100], mutedForeground: P[500],
  accent: P[100], accentForeground: P[950],
  border: P[200], input: P[100], ring: P[500],
  sidebar: P[50],

  surface: P[50], raised: P[50], hover: P[100],
  line: P[200], lineSoft: P[100],
  ink: P[950], ink2: P[700], ink3: P[500], ink4: P[400],
  acc: P[600], accStrong: P[700], accFaint: P[200],
  keyBg: P[300], keyInk: P[900],
  badgeBg: P[200], badgeInk: P[700],
  toggleOn: P[700],
  btnPrimary: P[900], btnPrimaryInk: P[50],
  btnSoftBg: P[200], btnSoftInk: P[800],
  chartTrack: P[200],
  dataHigh: P[700], dataMid: P[600], dataLow: P[500], dataFaint: P[400],
  heatEmpty: P[200],
};

export const THEMES: Record<ThemeMode, ColorTokens> = { dark: DARK, light: LIGHT };

/* ─────────────────────────────────────────────────────────────────────────
 * 3. GEOMETRY TOKENS
 * ──────────────────────────────────────────────────────────────────────── */
export const RADII = {
  key: "6px",
  btn: "11px",
  card: "16px",
  panel: "20px",
  modal: "22px",
} as const;

export const SPACE = {
  xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", "2xl": "32px",
} as const;

export const SHADOW = {
  dark: {
    card: "0 1px 2px rgba(0,0,0,.18), 0 6px 20px rgba(0,0,0,.22)",
    pop: "0 2px 4px rgba(0,0,0,.30), 0 24px 60px rgba(0,0,0,.55)",
  },
  light: {
    card: "0 1px 2px rgba(14,21,22,.06), 0 6px 20px rgba(14,21,22,.07)",
    pop: "0 2px 4px rgba(14,21,22,.06), 0 24px 60px rgba(14,21,22,.20)",
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────
 * 4. REUSABLE CLASS-STRING TOKENS  (Tailwind semantic classes defined in
 *    tailwind.config.ts). Compose with cn(WV_CARD, "extra-classes").
 * ──────────────────────────────────────────────────────────────────────── */
export const WV_CARD =
  "bg-surface border border-line rounded-2xl shadow-wv-card transition-colors";
export const WV_CARD_HOVER =
  "hover:border-acc/60 hover:bg-hover transition-colors";
export const WV_PANEL =
  "bg-background border border-line rounded-[14px]";
export const WV_BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-[11px] bg-btn-primary text-btn-primary-ink " +
  "font-semibold text-[12.5px] px-4 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-50";
export const WV_BUTTON_SOFT =
  "inline-flex items-center justify-center gap-2 rounded-[11px] bg-btn-soft text-btn-soft-ink " +
  "border border-line font-semibold text-[12.5px] px-4 py-2.5 transition-colors hover:bg-hover";
export const WV_INPUT =
  "w-full h-10 rounded-[11px] border border-line bg-surface px-3.5 text-[13.5px] text-ink " +
  "placeholder:text-ink-4 focus:outline-none focus:border-acc-strong focus:ring-2 focus:ring-acc-faint transition-colors";
export const WV_NAV_ITEM =
  "relative flex items-center gap-3 w-full h-9 px-2.5 rounded-[10px] text-[13.5px] font-medium " +
  "text-ink-3 hover:text-ink hover:bg-hover transition-colors";
export const WV_NAV_ITEM_ACTIVE =
  "bg-raised text-ink shadow-wv-card before:absolute before:left-0 before:top-2 before:bottom-2 " +
  "before:w-[2.5px] before:rounded-full before:bg-acc";
export const WV_BADGE =
  "inline-flex items-center rounded-full bg-badge text-badge-ink text-[10.5px] font-semibold px-2 py-[3px]";
export const WV_KEYCAP =
  "inline-flex items-center h-[26px] px-[9px] rounded-[6px] bg-keycap text-keycap-ink " +
  "font-bold text-[13px] shadow-[0_1.5px_0_rgba(0,0,0,.25)]";
export const WV_SECTION_LABEL =
  "text-[11px] font-bold uppercase tracking-[0.07em] text-ink-4";
export const WV_TITLE =
  "font-display text-[26px] font-medium tracking-[-0.01em] text-ink";
export const WV_STAT_NUMBER =
  "font-display text-[28px] font-semibold tracking-[-0.02em] text-ink";

/* ─────────────────────────────────────────────────────────────────────────
 * 5. RUNTIME HELPERS
 * ──────────────────────────────────────────────────────────────────────── */
const toKebab = (s: string) => s.replace(/([A-Z0-9]+)/g, "-$1").toLowerCase();

/** Build a CSS custom-property block string (for codegen into index.css). */
export function toCSSVars(tokens: ColorTokens): string {
  return Object.entries(tokens)
    .map(([k, v]) => `  --${toKebab(k)}: ${v};`)
    .join("\n");
}

/**
 * Apply a theme at runtime: sets every token as a CSS variable on <html>
 * and flips the data-theme attribute used by Tailwind's selector dark mode.
 */
export function applyTheme(mode: ThemeMode): void {
  const tokens = THEMES[mode];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(`--${toKebab(k)}`, v);
  }
  root.style.setProperty("--wv-shadow-card", SHADOW[mode].card);
  root.style.setProperty("--wv-shadow-pop", SHADOW[mode].pop);
  root.setAttribute("data-theme", mode);
}
