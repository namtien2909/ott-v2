import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("khóa thao tác và công bố trạng thái pending", () => {
    const onClick = vi.fn();
    render(<Button pending onClick={onClick}>Lưu</Button>);
    const button = screen.getByRole("button", { name: "Đang xử lý…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
