export type ToastVariant = "success" | "info" | "warning" | "error";
export interface ToastAction { label: string; onClick: () => void }
export interface ToastItem { id: string; message: string; variant: ToastVariant; duration: number; action?: ToastAction }
export function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  return <div className={`toast ${toast.variant}`} role={toast.variant === "error" ? "alert" : "status"}><span>{toast.message}</span>{toast.action && <button className="toast-action" type="button" onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}>{toast.action.label}</button>}<button type="button" onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo">×</button></div>;
}
