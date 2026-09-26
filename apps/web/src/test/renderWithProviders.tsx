import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../theme/ThemeProvider";

export function renderWithProviders(ui: ReactElement, route = "/") {
  window.history.pushState({}, "Test", route);
  return render(<ThemeProvider><ToastProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></ToastProvider></ThemeProvider>);
}
