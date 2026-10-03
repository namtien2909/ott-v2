import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { transferableAbortController } from "node:util";
import { useState } from "react";
import { Link, useBlocker, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

vi.mock("../foundation/AmbientArena", () => ({ AmbientArena: () => null }));
vi.mock("../foundation/PresentationAudio", () => ({ PresentationAudio: () => null }));
vi.mock("./router", () => ({
  AppRouter: function RouterProbe() {
    const [needsAcknowledgment, setNeedsAcknowledgment] = useState(true);
    const location = useLocation();
    const blocker = useBlocker(needsAcknowledgment);
    if (location.pathname === "/r1-routing-error") throw new Error("PRIVATE_DIAGNOSTIC_MUST_NOT_RENDER");
    return (
      <section>
        <h1>Router probe</h1>
        <p data-testid="path">{location.pathname}</p>
        <p data-testid="blocker">{blocker.state}</p>
        <Link to="/r1-next-page">Rời trang</Link>
        {blocker.state === "blocked" && <button onClick={() => { setNeedsAcknowledgment(false); blocker.proceed(); }}>Đã xác nhận</button>}
        <Link to="/r1-routing-error">Kiểm tra lỗi</Link>
      </section>
    );
  },
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("R1 data-router foundation", () => {
  it("supports acknowledged navigation blocking and a safe localized routing error", async () => {
    // Node's native Request needs a Node-branded signal rather than jsdom's signal.
    vi.stubGlobal("AbortController", function TestAbortController() { return transferableAbortController(); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Router probe" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Rời trang" }));
    await waitFor(() => expect(screen.getByTestId("blocker")).toHaveTextContent("blocked"));
    expect(screen.getByTestId("path")).not.toHaveTextContent("/r1-next-page");
    fireEvent.click(screen.getByRole("button", { name: "Đã xác nhận" }));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/r1-next-page"));
    fireEvent.click(screen.getByRole("link", { name: "Kiểm tra lỗi" }));
    expect(await screen.findByRole("heading", { name: "Không thể hiển thị trang" })).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE_DIAGNOSTIC_MUST_NOT_RENDER/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeInTheDocument();
  });
});
