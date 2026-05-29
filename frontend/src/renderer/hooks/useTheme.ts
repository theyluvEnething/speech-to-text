import { useEffect } from "react";
import { useStore } from "@/store";
import { applyTheme, type ThemeMode } from "@/styles/theme";

/**
 * useTheme — wires the persisted theme to the runtime CSS variables.
 *
 * Mount once near the app root (e.g. inside MainApp). On boot it reads the
 * saved theme from settings and applies it; thereafter any call to
 * store.setTheme() re-applies the variables and persists the choice.
 */
export function useTheme(): {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const theme = useStore((s) => s.theme);
  const setThemeState = useStore((s) => s.setTheme);

  // Load persisted theme once on mount.
  useEffect(() => {
    window.wavely
      .getSettings()
      .then((settings) => {
        const saved = (settings.theme as ThemeMode) || "dark";
        setThemeState(saved);
        applyTheme(saved);
      })
      .catch(() => applyTheme("dark"));
  }, [setThemeState]);

  // Re-apply + persist whenever theme changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: ThemeMode): void => {
    setThemeState(t);
    applyTheme(t);
    window.wavely.setSettings({ theme: t }).catch(() => {});
  };

  const toggleTheme = (): void => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme };
}
