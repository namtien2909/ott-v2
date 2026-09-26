import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/ui";

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("App render error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="error-page">
        <p className="eyebrow">SYSTEM_ERROR</p>
        <h1>Ứng dụng gặp sự cố</h1>
        <p>Vui lòng tải lại trang. Không có dữ liệu bí mật nào được hiển thị tại đây.</p>
        <Button onClick={() => window.location.reload()}>Tải lại</Button>
      </main>
    );
  }
}
