export const themeChoices = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof themeChoices)[number];
export type ResolvedTheme = Exclude<ThemeChoice, "system">;

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && themeChoices.includes(value as ThemeChoice);
}
