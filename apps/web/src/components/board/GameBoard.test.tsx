import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { GameBoard } from "./GameBoard";

describe("GameBoard", () => {
  it("renders all 81 canonical squares and the initial fixture", () => {
    render(<GameBoard state={createInitialState()} viewSide="BLUE" />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getByRole("gridcell", { name: /Ô b1, Xanh Rock/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i8, Đỏ Scissors/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a1, trống/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, trống/ })).toBeInTheDocument();
  });

  it("keeps canonical labels while showing RED from a 180 degree view", () => {
    render(<GameBoard state={createInitialState()} viewSide="RED" />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getByRole("gridcell", { name: /Ô b1, Xanh Rock/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a9, Đỏ Paper/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, trống/ })).toBeInTheDocument();
  });

  it("highlights only local legal destinations without applying a move", () => {
    const state = createInitialState();
    render(<GameBoard state={state} viewSide="BLUE" />);
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b1, Xanh Rock/ }));
    expect(screen.getByRole("gridcell", { name: /Ô b1, Xanh Rock/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("gridcell", { name: /Ô a2, Xanh Scissors/ })).toHaveAttribute("data-legal", "false");
    expect(screen.getByRole("gridcell", { name: /Ô b2, trống/ })).toHaveAttribute("data-legal", "true");
    expect(state.board.b1).toMatchObject({ side: "BLUE", type: "R" });
    expect(state.board.b2).toBeNull();
  });

  it("does not select an opponent piece for the current view side", () => {
    render(<GameBoard state={createInitialState()} viewSide="BLUE" />);
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a9, Đỏ Paper/ }));
    expect(screen.getByRole("gridcell", { name: /Ô a9, Đỏ Paper/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks both goal cells and exposes a semantic capture target", () => {
    const state = createInitialState();
    render(<GameBoard state={state} viewSide="BLUE" />);
    expect(screen.getByRole("gridcell", { name: /đích Xanh/ })).toHaveClass("blue-goal");
    expect(screen.getByRole("gridcell", { name: /đích Đỏ/ })).toHaveClass("red-goal");
    expect(document.querySelectorAll(".board-piece-token")).toHaveLength(18);
  });

  it("forwards a selected legal destination to the authoritative move callback", () => {
    const onMove = vi.fn();
    render(<GameBoard state={createInitialState()} viewSide="BLUE" onMove={onMove} />);
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b1, Xanh Rock/ }));
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b2, trống/ }));
    expect(onMove).toHaveBeenCalledWith("b1", "b2");
  });
});
