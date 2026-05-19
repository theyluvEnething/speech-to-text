/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        sidebar: "hsl(var(--sidebar) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        // Keep old surface palette for the overlay window (out of scope)
        surface: {
          50: "#f8f9fa",
          100: "#f1f3f5",
          200: "#e9ecef",
          300: "#dee2e6",
          400: "#ced4da",
          500: "#adb5bd",
          600: "#868e96",
          700: "#495057",
          800: "#343a40",
          900: "#212529",
          950: "#0d1117",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "fade-out": "fadeOut 200ms ease-in",
        "zoom-in": "zoomIn 200ms ease-out",
        "scale-out": "scaleOut 200ms ease-in",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "glow-pulse-green": "glow-pulse-green 2s ease-in-out infinite",
        "popup-enter": "popupEnter 500ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "popup-exit": "popupExit 280ms cubic-bezier(0.55, 0, 1, 0.45) forwards",
        "wave-bar": "waveBar 120ms linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        zoomIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        scaleOut: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.92)" },
        },
        popupEnter: {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.82)" },
          "55%": { opacity: "1", transform: "translateY(-4px) scale(1.04)" },
          "75%": { transform: "translateY(2px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        popupExit: {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "25%": { transform: "translateY(-3px) scale(1.02)" },
          "100%": { opacity: "0", transform: "translateY(18px) scale(0.85)" },
        },
        waveBar: {
          "0%": { height: "var(--bar-from)" },
          "100%": { height: "var(--bar-to)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 12px rgba(239,68,68,0.15)" },
          "50%": { boxShadow: "0 0 24px rgba(239,68,68,0.3)" },
        },
        "glow-pulse-green": {
          "0%, 100%": { boxShadow: "0 0 12px rgba(16,185,129,0.15)" },
          "50%": { boxShadow: "0 0 24px rgba(16,185,129,0.3)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
