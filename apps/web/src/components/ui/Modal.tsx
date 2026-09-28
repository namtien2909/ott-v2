import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import FocusTrap from "focus-trap-react";

export interface ModalProps { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void; dismissible?: boolean }

export function Modal({ open, title, description, children, onClose, dismissible = true }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; previousFocus.current?.focus(); };
  }, [open]);
  useEffect(() => {
    if (!open || !dismissible) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [dismissible, onClose, open]);
  if (!open) return null;
  const root = document.getElementById("modal-root") ?? document.body;
  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}><FocusTrap focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, fallbackFocus: ".modal" }}><section className="modal" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}><header><div><p className="eyebrow">YÊU CẦU THAO TÁC</p><h2 id={titleId}>{title}</h2></div>{dismissible && <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng hộp thoại">×</button>}</header>{description && <p id={descriptionId}>{description}</p>}<div className="modal-content">{children}</div></section></FocusTrap></div>, root);
}
