export type ToastVariant = "success" | "info" | "warning" | "error";
export interface ToastItem { id: string; message: string; variant: ToastVariant; duration: number }
export function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  return <div className={`toast ${toast.variant}`} role={toast.variant === "error" ? "alert" : "status"}><span>{toast.message}</span><button type="button" onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo">×</button></div>;
}
