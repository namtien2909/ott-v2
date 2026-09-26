import type { ReactNode } from "react";

export function PagePlaceholder({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="placeholder"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><div className="placeholder-content">{children}</div></section>;
}
