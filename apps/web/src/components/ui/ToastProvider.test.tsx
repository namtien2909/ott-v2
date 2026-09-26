import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Button } from "./Button";
import { ToastProvider, useToast } from "./ToastProvider";

function Fixture() {
  const { notify } = useToast();
  return <Button onClick={() => notify("Phòng đấu không tồn tại", "error")}>Thông báo</Button>;
}

describe("ToastProvider", () => {
  it("tự đóng thông báo transient", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Fixture /></ToastProvider>);
    act(() => screen.getByRole("button", { name: "Thông báo" }).click());
    expect(screen.getByRole("alert")).toHaveTextContent("Phòng đấu không tồn tại");
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
