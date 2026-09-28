import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotFoundPage from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("renders the branded explanation and a lobby action", () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "Oẳn Tù Tì v2 — Về sảnh" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trang này không tồn tại" })).toBeInTheDocument();
    expect(screen.getByText(/Đường dẫn có thể đã đổi/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về sảnh" })).toHaveAttribute("href", "/");
  });
});
