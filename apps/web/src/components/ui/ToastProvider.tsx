/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast, type ToastAction, type ToastItem, type ToastVariant } from "./Toast";

interface ToastContextValue { notify: (message: string, variant?: ToastVariant, duration?: number, action?: ToastAction) => void }
const ToastContext = createContext<ToastContextValue | null>(null);
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const notify = useCallback((message: string, variant: ToastVariant = "info", duration = 4000, action?: ToastAction) => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items.slice(-(MAX_TOASTS - 1)), { id, message, variant, duration, action }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-viewport" role="region" aria-label="Thông báo" aria-live="polite">{toasts.map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />)}</div></ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast phải được dùng bên trong ToastProvider.");
  return value;
}
