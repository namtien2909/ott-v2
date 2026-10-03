import { Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Button, LoadingState, ToastProvider } from "../components/ui";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppRouter } from "./router";
import { AmbientArena } from "../foundation/AmbientArena";
import { PresentationAudio } from "../foundation/PresentationAudio";

function RoutedContent() {
  return (
    <>
      <PresentationAudio />
      <Suspense fallback={<LoadingState fullPage label="Đang tải trang…" />}>
        <AppRouter />
      </Suspense>
    </>
  );
}

function RoutingError() {
  return (
    <main className="error-page" role="alert" aria-labelledby="routing-error-title">
      <p className="eyebrow">OẲN TÙ TÌ v2</p>
      <h1 id="routing-error-title">Không thể hiển thị trang</h1>
      <p>Đã xảy ra sự cố. Bạn có thể tải lại trang hoặc quay về sảnh.</p>
      <div className="error-actions">
        <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        <a className="button secondary" href="/">Về sảnh</a>
      </div>
      <code className="error-code">ERR_APP_ROUTING_001</code>
    </main>
  );
}

// A data router enables acknowledged navigation blocking without patching browser history.
// Keep existing route/alias definitions inside AppRouter during this incremental migration.
const router = createBrowserRouter([{ path: "*", element: <RoutedContent />, errorElement: <RoutingError /> }]);
import.meta.hot?.dispose(() => router.dispose());

export function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AmbientArena />
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
