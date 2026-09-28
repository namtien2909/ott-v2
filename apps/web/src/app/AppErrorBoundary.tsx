import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/ui";

interface Props { children: ReactNode }
interface State { hasError: boolean; errorCode: string }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorCode: "ERR_APP_RENDER_001" };

  static getDerivedStateFromError(): Partial<State> { return { hasError: true, errorCode: "ERR_APP_RENDER_001" }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error("App render error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="error-page" role="alert" aria-labelledby="app-error-title">
        <p className="eyebrow">OẲN TÙ TÌ v2</p>
        <h1 id="app-error-title">Ứng dụng gặp sự cố</h1>
        <p>Đã xảy ra lỗi không mong muốn. Không có stack trace hay dữ liệu bí mật nào được hiển thị.</p>
        <div className="error-actions"><Button onClick={() => this.setState({ hasError: false, errorCode: "ERR_APP_RENDER_001" })}>Thử lại</Button><Button variant="secondary" onClick={() => window.location.reload()}>Tải lại trang</Button></div>
        <code className="error-code">{this.state.errorCode}</code>
      </main>
    );
  }
}
