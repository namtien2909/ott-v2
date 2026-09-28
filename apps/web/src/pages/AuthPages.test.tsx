import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import * as authApi from "../services/auth/authApi";
import { ToastProvider } from "../components/ui";

function renderPage(page: ReactNode) {
  return render(<ToastProvider><MemoryRouter>{page}</MemoryRouter></ToastProvider>);
}

afterEach(() => vi.restoreAllMocks());

describe("B2 auth output", () => {
  it("shows inline login validation without sending a request", () => {
    const loginSpy = vi.spyOn(authApi, "login");
    renderPage(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), { target: { value: "x" } });
    fireEvent.submit(screen.getByRole("button", { name: "Đăng nhập" }).closest("form") as HTMLFormElement);
    expect(screen.getByText("Username cần ít nhất 4 ký tự.")).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it("shows the one-time recovery hologram after registration", async () => {
    vi.spyOn(authApi, "register").mockResolvedValue({
      user: { id: "user-1", fullName: "Người Chơi", displayName: "Player", username: "player", theme: "dark", avatarPreset: "arena", privacy: { presenceVisibility: "FRIENDS", friendListVisibility: "PRIVATE", fullNameVisibility: "PRIVATE" }, stats: { elo: 1200, rankedWins: 0, rankedLosses: 0, quickWins: 0, quickLosses: 0 } },
      recoveryCode: "ABCD-EFGH",
    });
    renderPage(<RegisterPage />);
    fireEvent.change(screen.getByLabelText("Họ và tên"), { target: { value: "Người Chơi" } });
    fireEvent.change(screen.getByLabelText("Tên hiển thị"), { target: { value: "Player" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player" } });
    fireEvent.change(document.getElementById("register-password") as HTMLInputElement, { target: { value: "password1" } });
    fireEvent.change(document.getElementById("register-confirm-password") as HTMLInputElement, { target: { value: "password1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Đăng ký" }).closest("form") as HTMLFormElement);
    expect(await screen.findByText("Mã khôi phục")).toBeInTheDocument();
    expect(screen.getByText("ABCD-EFGH")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tôi đã lưu mã" })).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps recovery confirmation error beside the field", async () => {
    const recoverSpy = vi.spyOn(authApi, "recover");
    renderPage(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player" } });
    fireEvent.change(screen.getByLabelText("Recovery Code"), { target: { value: "ABCD" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "different1" } });
    fireEvent.submit(screen.getByRole("button", { name: "Đặt lại mật khẩu" }).closest("form") as HTMLFormElement);
    await waitFor(() => expect(screen.getByText("Mật khẩu xác nhận không khớp.")).toBeInTheDocument());
    expect(recoverSpy).not.toHaveBeenCalled();
  });
});
