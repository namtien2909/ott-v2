import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinalPositionThumbnail } from "./FinalPositionThumbnail";

const board = {
  a1: { id: "red-s", side: "RED", type: "S" },
  i9: { id: "blue-s", side: "BLUE", type: "S" },
  e5: { id: "blue-r", side: "BLUE", type: "R" },
} as const;

describe("B7 final position thumbnail", () => {
  it("renders the canonical board as a read-only glyph grid", () => {
    render(<FinalPositionThumbnail board={board} />);
    expect(screen.getByRole("img", { name: /canonical Xanh ở dưới/i })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(document.querySelectorAll(".final-position-piece .piece-glyph")).toHaveLength(3);
    expect(document.querySelectorAll(".final-position-square")).toHaveLength(81);
    expect(document.querySelectorAll("button")).toHaveLength(0);
    expect(document.querySelector('[data-coordinate="i9"] .piece-glyph')).toBeInTheDocument();
  });

  it("explains when an older history row has no persisted board", () => {
    render(<FinalPositionThumbnail board={null} />);
    expect(screen.getByText("Vị trí cuối chưa có trong bản lưu trận này.")).toBeInTheDocument();
  });
});
