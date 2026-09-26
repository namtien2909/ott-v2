import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "../components/ui/ThemeSwitcher";
import { THEME_STORAGE_KEY } from "./theme.storage";
import { ThemeProvider } from "./ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => localStorage.clear());

  it("dùng system mặc định và lưu lựa chọn hợp lệ", async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    const select = screen.getByRole("combobox", { name: "Chọn giao diện" });
    expect(select).toHaveValue("system");
    await userEvent.selectOptions(select, "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("bỏ qua cache không hợp lệ", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "unknown");
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(screen.getByRole("combobox", { name: "Chọn giao diện" })).toHaveValue("system");
  });
});
