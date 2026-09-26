import { Spinner } from "./Spinner";
export function LoadingState({ label = "Đang tải…", fullPage = false }: { label?: string; fullPage?: boolean }) {
  return <div className={`loading-state${fullPage ? " full-page" : ""}`} role="status"><Spinner /><span>{label}</span></div>;
}
