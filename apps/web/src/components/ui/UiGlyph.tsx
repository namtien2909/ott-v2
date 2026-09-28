import type { SVGProps } from "react";

export type UiGlyphName =
  | "brand"
  | "home"
  | "history"
  | "friends"
  | "profile"
  | "copy"
  | "lock"
  | "players"
  | "clock"
  | "spectator"
  | "settings"
  | "empty";

type Props = SVGProps<SVGSVGElement> & { name: UiGlyphName; size?: number };

/** Small, monochrome UI glyphs keep decoration vector-based and theme-safe. */
export function UiGlyph({ name, size = 18, ...props }: Props) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, focusable: "false" as const, "aria-hidden": true, ...props };
  switch (name) {
    case "brand":
      return <svg {...common}><path d="M4 12.5 6.4 6l4.1 2.1L12 5l3.2 3.1 3.6-1.3 1.2 6.1-2.9 5.4H7.1L4 12.5Z" /><path d="m8 13 2.1 2.1m1.1-3.4 2 2m1.1-3.1 1.8 1.7" /></svg>;
    case "home":
      return <svg {...common}><path d="m3.5 10.8 8.5-7 8.5 7" /><path d="M5.5 9.8v9.7h13V9.8M9.2 19.5v-5.2h5.6v5.2" /></svg>;
    case "history":
      return <svg {...common}><path d="M4.5 7.5A8.4 8.4 0 1 1 4 13" /><path d="M4.5 4.5v3h3" /><path d="M12 8v4l2.7 1.7" /></svg>;
    case "friends":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19.2c.5-3 2.3-4.8 5.5-4.8s5 1.8 5.5 4.8" /><path d="M16 6.5a2.5 2.5 0 0 1 0 4.8m1.2 2.2c2 .5 3.1 1.7 3.4 3.7" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5 20c.7-3.7 3-5.6 7-5.6s6.3 1.9 7 5.6" /></svg>;
    case "copy":
      return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></svg>;
    case "lock":
      return <svg {...common}><rect x="4.5" y="10" width="15" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 3v2.5" /></svg>;
    case "players":
      return <svg {...common}><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9" r="2.1" /><path d="M3.8 19c.5-3.2 2.2-4.8 5.2-4.8s4.7 1.6 5.2 4.8m1.2-4.1c2.4.2 3.8 1.5 4.2 4.1" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></svg>;
    case "spectator":
      return <svg {...common}><path d="M2.8 12s3.1-5.1 9.2-5.1 9.2 5.1 9.2 5.1-3.1 5.1-9.2 5.1S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.2" /></svg>;
    case "settings":
      return <svg {...common}><path d="m9.7 3.7.6 1.8a7.2 7.2 0 0 1 3.4 0l.6-1.8 2.1.9-.7 1.8a7.4 7.4 0 0 1 2.4 2.4l1.8-.7.9 2.1-1.8.6a7.2 7.2 0 0 1 0 3.4l1.8.6-.9 2.1-1.8-.7a7.4 7.4 0 0 1-2.4 2.4l.7 1.8-2.1.9-.6-1.8a7.2 7.2 0 0 1-3.4 0l-.6 1.8-2.1-.9.7-1.8a7.4 7.4 0 0 1-2.4-2.4l-1.8.7-.9-2.1 1.8-.6a7.2 7.2 0 0 1 0-3.4l-1.8-.6.9-2.1 1.8.7a7.4 7.4 0 0 1 2.4-2.4l-.7-1.8 2.1-.9Z" /><circle cx="12" cy="12" r="2.7" /></svg>;
    case "empty":
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /></svg>;
  }
}
