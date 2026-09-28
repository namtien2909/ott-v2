import { Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { LoadingState, ToastProvider } from "../components/ui";
import { ThemeProvider } from "../theme/ThemeProvider";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppRouter } from "./router";
import { AmbientArena } from "../foundation/AmbientArena";
import { PresentationAudio } from "../foundation/PresentationAudio";

export function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AmbientArena />
        <ToastProvider>
          <BrowserRouter>
            <PresentationAudio />
            <Suspense fallback={<LoadingState fullPage label="Đang tải trang…" />}>
              <AppRouter />
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
