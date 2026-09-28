import type { SVGProps } from "react";
import type { AvatarPreset } from "../../services/auth/authApi";

type Props = SVGProps<SVGSVGElement> & { preset: AvatarPreset; size?: number };

/** Avatar marks are deliberately abstract vector silhouettes, never emoji glyphs. */
export function AvatarGlyph({ preset, size = 34, ...props }: Props) {
  const common = { width: size, height: size, viewBox: "0 0 40 40", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, focusable: "false" as const, "aria-hidden": true, ...props };
  if (preset === "robot") return <svg {...common}><rect x="8" y="10" width="24" height="21" rx="5" /><path d="M20 6v4m-7 9h.1m13.8 0h.1M14 25h12" /><path d="M5 17v6m30-6v6" /></svg>;
  if (preset === "wolf") return <svg {...common}><path d="m8 29 2-17 6 4 4-6 4 6 6-4 2 17-7 5H15l-7-5Z" /><path d="M14 24h.1m11.8 0h.1M16 29c2.5 1.5 5.5 1.5 8 0" /></svg>;
  if (preset === "fox") return <svg {...common}><path d="m7 12 7 2 6-4 6 4 7-2-2 17-11 6-11-6-2-17Z" /><path d="m14 24 2.5 2 3.5-2 3.5 2 2.5-2M15 20h.1m9.8 0h.1" /></svg>;
  if (preset === "panda") return <svg {...common}><circle cx="20" cy="21" r="12" /><path d="M12 12 9 8m16 4 3-4" /><ellipse cx="14.5" cy="20" rx="3" ry="4" /><ellipse cx="25.5" cy="20" rx="3" ry="4" /><path d="M18 26h4" /></svg>;
  return <svg {...common}><path d="m20 5 4 8 8 1-6 6 1.5 9L20 25l-7.5 4L14 20l-6-6 8-1 4-8Z" /><path d="M20 11v7m-3 3h6" /></svg>;
}
