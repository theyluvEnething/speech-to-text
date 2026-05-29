import type { Config } from "tailwindcss";
import { COLOR_PALETTE, ACCENT_AMBER, ACCENT_ROSE } from "./src/renderer/styles/theme";

/**
 * tailwind.config.ts
 *
 * Two layers of color:
 *  1. Raw palette  → bg-color-palette-50 ... bg-color-palette-950
 *  2. Semantic     → bg-surface, text-ink, border-line, bg-btn-primary ...
 *                    (read from CSS variables set by applyTheme())
 *
 * Dark mode is driven by the data-theme attribute on <html>.
 */
export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./overlay.html",
    "./src/**/*.{ts,tsx,js,jsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. raw palette
        "color-palette": COLOR_PALETTE,
        "amber-accent": ACCENT_AMBER,
        "rose-accent":  ACCENT_ROSE,

        // 2. shadcn-compatible semantic names (existing primitives keep working)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        sidebar: "var(--sidebar)",

        // 3. redesign-specific semantic names
        surface: "var(--surface)",
        raised: "var(--raised)",
        hover: "var(--hover)",
        line: { DEFAULT: "var(--line)", soft: "var(--line-soft)" },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
          4: "var(--ink-4)",
        },
        acc: {
          DEFAULT: "var(--acc)",
          strong: "var(--acc-strong)",
          faint: "var(--acc-faint)",
        },
        keycap: { DEFAULT: "var(--key-bg)", ink: "var(--key-ink)" },
        badge: { DEFAULT: "var(--badge-bg)", ink: "var(--badge-ink)" },
        "toggle-on": "var(--toggle-on)",
        "btn-primary": { DEFAULT: "var(--btn-primary)", ink: "var(--btn-primary-ink)" },
        "btn-soft": { DEFAULT: "var(--btn-soft-bg)", ink: "var(--btn-soft-ink)" },
        "chart-track": "var(--chart-track)",
        "data-high": "var(--data-high)",
        "data-mid": "var(--data-mid)",
        "data-low": "var(--data-low)",
        "data-faint": "var(--data-faint)",
        "heat-empty": "var(--heat-empty)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        key: "6px",
        btn: "11px",
        card: "16px",
        panel: "20px",
        modal: "22px",
      },
      boxShadow: {
        "wv-card": "var(--wv-shadow-card)",
        "wv-pop": "var(--wv-shadow-pop)",
      },
      keyframes: {
        "wv-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "wv-pop": {
          from: { opacity: "0", transform: "scale(.97) translateY(10px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "wv-fade": "wv-fade .18s ease",
        "wv-pop": "wv-pop .22s cubic-bezier(.2,.7,.3,1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
