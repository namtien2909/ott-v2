import { isThemeChoice, type ThemeChoice } from "./theme.types";

export const THEME_STORAGE_KEY = "ottv2.theme";

export function readStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : "system";
  } catch { return "system"; }
}

export function storeTheme(theme: ThemeChoice): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
  catch { /* Storage may be unavailable; the in-memory preference still works. */ }
}
