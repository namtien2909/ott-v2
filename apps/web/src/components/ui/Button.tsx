import type { ButtonHTMLAttributes, ReactNode } from "react";
import { playSound } from "../../services/presentation/preferences";
import { Spinner } from "./Spinner";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pending?: boolean;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export function Button({ children, pending = false, pendingLabel = "Đang xử lý…", variant = "primary", disabled, className = "", onClick, ...props }: ButtonProps) {
  return <button {...props} className={`button ${variant} ${className}`.trim()} disabled={disabled || pending} aria-busy={pending || undefined} onClick={(event) => { if (!disabled && !pending) playSound("click"); onClick?.(event); }}>{pending ? <><Spinner size="small" /><span>{pendingLabel}</span></> : children}</button>;
}