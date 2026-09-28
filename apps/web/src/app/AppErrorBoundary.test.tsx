import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

describe("AppErrorBoundary", () => {
  it("shows a safe error code and can recover without exposing a stack", () => {
    let shouldThrow = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function FlakyScreen() {
      if (shouldThrow) throw new Error("private implementation detail");
      return <p>Ứng dụng đã hoạt động lại.</p>;
    }

    render(<AppErrorBoundary><FlakyScreen /></AppErrorBoundary>);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("ERR_APP_RENDER_001")).toBeInTheDocument();
    expect(screen.getByText(/Không có stack trace/)).toBeInTheDocument();
    expect(screen.queryByText("private implementation detail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(screen.getByText("Ứng dụng đã hoạt động lại.")).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
