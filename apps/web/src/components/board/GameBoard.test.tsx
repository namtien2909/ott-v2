import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@ottv2/game-rules";
import { GameBoard } from "./GameBoard";

describe("GameBoard", () => {
  it("renders all 81 canonical squares and the initial fixture", () => {
    render(<GameBoard state={createInitialState()} viewSide="BLUE" />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, Quân Kéo phe Đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a2, trống/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i8, trống/ })).toBeInTheDocument();
  });

  it("keeps canonical labels while showing RED from a 180 degree view", () => {
    render(<GameBoard state={createInitialState()} viewSide="RED" />);
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a9, Quân Bao phe Đỏ/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, Quân Kéo phe Đỏ/ })).toBeInTheDocument();
  });

  it("highlights only local legal destinations without applying a move", () => {
    const state = createInitialState();
    render(<GameBoard state={state} viewSide="BLUE" />);
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ }));
    expect(screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ })).toHaveAttribute("data-legal", "false");
    expect(screen.getByRole("gridcell", { name: /Ô a2, trống/ })).toHaveAttribute("data-legal", "true");
    expect(screen.getByRole("gridcell", { name: /Ô b2, trống/ })).toHaveAttribute("data-legal", "true");
    expect(state.board.b1).toMatchObject({ side: "BLUE", type: "R" });
    expect(state.board.b2).toBeNull();
  });

  it("does not select an opponent piece for the current view side", () => {
    render(<GameBoard state={createInitialState()} viewSide="BLUE" />);
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a9, Quân Bao phe Đỏ/ }));
    expect(screen.getByRole("gridcell", { name: /Ô a9, Quân Bao phe Đỏ/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps BLUE orientation while allowing RED interaction", () => {
    const state = { ...createInitialState(), currentTurn: "RED" as const };
    render(<GameBoard state={state} viewSide="BLUE" interactionSide="RED" />);
    const redPiece = screen.getByRole("gridcell", { name: /Ô h9, Quân Đấm phe Đỏ/ });
    fireEvent.click(redPiece);
    expect(redPiece).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("gridcell", { name: /Ô h8, trống/ })).toHaveAttribute("data-legal", "true");
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
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ }));
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô b2, trống/ }));
    expect(onMove).toHaveBeenCalledWith("b1", "b2");
  });

  it("supports roving focus and keyboard select/commit", () => {
    const onMove = vi.fn();
    render(<GameBoard state={createInitialState()} viewSide="BLUE" onMove={onMove} />);
    const gridcells = screen.getAllByRole("gridcell");
    const first = gridcells.find((cell) => cell.getAttribute("tabindex") === "0");
    expect(first).toBeDefined();
    expect(gridcells.filter((cell) => cell.getAttribute("tabindex") === "0")).toHaveLength(1);
    if (!first) return;
    act(() => fireEvent.keyDown(first, { key: "ArrowDown" }));
    expect(gridcells.filter((cell) => cell.getAttribute("tabindex") === "0")).toHaveLength(1);
    const piece = screen.getByRole("gridcell", { name: /Ô b1, Quân Đấm phe Xanh/ });
    act(() => piece.focus());
    act(() => fireEvent.keyDown(piece, { key: "Enter" }));
    expect(piece).toHaveAttribute("aria-pressed", "true");
    const destination = screen.getByRole("gridcell", { name: /Ô b2, trống/ });
    act(() => destination.focus());
    act(() => fireEvent.keyDown(destination, { key: " " }));
    expect(onMove).toHaveBeenCalledWith("b1", "b2");
  });
});
