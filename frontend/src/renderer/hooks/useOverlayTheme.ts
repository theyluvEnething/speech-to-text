import { useEffect } from "react";
import { applyTheme, type ThemeMode } from "@/styles/theme";

/**
 * useOverlayTheme — listen for theme changes from the main window and
 * apply them to the overlay window's CSS variables.
 *
 * Mount once at the top of OverlayApp.
 */
export function useOverlayTheme(): void {
  useEffect(() => {
    // Initial fetch
    window.overlay.getTheme?.().then((mode) => {
      if (mode === "dark" || mode === "light") applyTheme(mode);
    }).catch(() => applyTheme("dark"));

    // Live updates
    window.overlay.onThemeChanged?.((mode: ThemeMode) => {
      applyTheme(mode);
    });
  }, []);
}
