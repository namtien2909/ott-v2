export type ThemeSurface = "light" | "dark";

/**
 * The single semantic token source for the Neon Esports Arena.  Components
 * consume CSS variables; this object keeps the names and values auditable in
 * TypeScript and lets the app apply the same contract before first paint.
 */
export const DESIGN_TOKENS = {
  dark: {
    "--bg-root": "#05070D",
    "--bg-secondary": "#0A0F1A",
    "--surface-1": "#0F1626",
    "--surface-2": "#151E33",
    "--surface-3": "#1C2842",
    "--glass": "rgba(15, 22, 38, 0.6)",
    "--text-primary": "#F5F8FC",
    "--text-secondary": "#A9B5C6",
    "--text-muted": "#6F7D90",
    "--system-cyan": "#44E7FF",
    "--blue-player": "#267BFF",
    "--blue-high": "#55A1FF",
    "--red-player": "#FF3F5E",
    "--red-high": "#FF7188",
    "--violet": "#8B5CFF",
    "--magenta": "#FF3FD2",
    "--amber": "#FFC94A",
    "--success": "#41D98A",
    "--warning": "#F3B84B",
    "--error": "#FF684B",
  },
  light: {
    "--bg-root": "#EEF3FB",
    "--bg-secondary": "#E5ECF8",
    "--surface-1": "#FFFFFF",
    "--surface-2": "#F7FAFF",
    "--surface-3": "#EAF1FC",
    "--glass": "rgba(255, 255, 255, 0.78)",
    "--text-primary": "#0B1220",
    "--text-secondary": "#3F5069",
    "--text-muted": "#4F6077",
    "--system-cyan": "#007A8C",
    "--blue-player": "#267BFF",
    "--blue-high": "#55A1FF",
    "--red-player": "#FF3F5E",
    "--red-high": "#FF7188",
    "--violet": "#7448EA",
    "--magenta": "#D82BB6",
    "--amber": "#C88700",
    "--success": "#177A55",
    "--warning": "#986A00",
    "--error": "#BD3B2B",
  },
  shared: {
    "--font-display": "'Space Grotesk', 'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
    "--font-body": "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
    "--font-data": "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
    "--gradient-arena-aurora": "linear-gradient(135deg, #8B5CFF 0%, #44E7FF 100%)",
    "--gradient-system-pulse": "linear-gradient(135deg, #44E7FF 0%, #267BFF 100%)",
    "--gradient-victory": "linear-gradient(135deg, #FFC94A 0%, #FF3FD2 100%)",
    "--gradient-defeat": "linear-gradient(135deg, #FF3F5E 0%, #351C64 100%)",
    "--gradient-legend": "linear-gradient(110deg, #FF3FD2 0%, #8B5CFF 48%, #44E7FF 100%)",
    "--motion-micro": "120ms",
    "--motion-fast": "160ms",
    "--motion-normal": "220ms",
    "--motion-cinematic": "800ms",
    "--radius-sm": "0.5rem",
    "--radius-md": "0.85rem",
    "--radius-lg": "1.2rem",
    "--glow-card": "0 0 24px",
    "--glow-token": "0 0 14px",
    "--z-ambient": "0",
    "--z-content": "1",
    "--z-header": "20",
    "--z-overlay": "40",
  },
} as const;

export function applyDesignTokens(theme: ThemeSurface, root: HTMLElement = document.documentElement): void {
  const tokens = { ...DESIGN_TOKENS.shared, ...DESIGN_TOKENS[theme] };
  for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
}
