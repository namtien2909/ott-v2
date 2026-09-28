/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStoredTheme, storeTheme } from "./theme.storage";
import type { ResolvedTheme, ThemeChoice } from "./theme.types";
import { applyDesignTokens } from "../foundation/tokens";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
const query = "(prefers-color-scheme: dark)";
const resolveSystemTheme = (): ResolvedTheme => window.matchMedia(query).matches ? "dark" : "light";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(resolveSystemTheme);
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    applyDesignTokens(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme: (next) => { setThemeState(next); storeTheme(next); },
  }), [resolvedTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
