import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResultPanel } from "./ResultPanel";

const stats = { moves: 12, captures: 3, piecesLost: 1, durationSeconds: 95 };

describe("B6 ResultPanel", () => {
  it("renders a ranked victory with authoritative Elo and stats", () => {
    render(<ResultPanel status="FINISHED" winner="BLUE" viewerSide="BLUE" resultReason="GOAL_REACHED" mode="RANKED" rating={{ blueBefore: 1200, blueAfter: 1216, blueDelta: 16, redBefore: 1200, redAfter: 1184, redDelta: -16 }} stats={stats} onRematch={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "CHIẾN THẮNG" })).toBeInTheDocument();
    expect(screen.getByText("Bạn đã chiếm ô đích.")).toBeInTheDocument();
    expect(screen.getByLabelText("Elo sau trận 1216")).toBeInTheDocument();
    expect(screen.getByText("01:35")).toBeInTheDocument();
    expect(screen.getByText("ĐẤU LẠI")).toBeInTheDocument();
  });

  it("keeps interruption neutral and never renders a false victory or Elo card", () => {
    render(<ResultPanel status="ABORTED" winner={null} viewerSide="BLUE" resultReason="DISCONNECT_TIMEOUT" mode="RANKED" rating={null} stats={stats} onRematch={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "TRẬN ĐẤU BỊ GIÁN ĐOẠN" })).toBeInTheDocument();
    expect(screen.getByText("Đối thủ không kết nối lại.")).toBeInTheDocument();
    expect(screen.queryByText("CHIẾN THẮNG")).not.toBeInTheDocument();
    expect(screen.queryByText("ĐẤU LẠI")).not.toBeInTheDocument();
    expect(screen.queryByText("ĐIỂM XẾP HẠNG")).not.toBeInTheDocument();
  });

  it("exposes accept and reject controls for an opponent rematch request", () => {
    const onRematch = vi.fn();
    const onReject = vi.fn();
    render(<ResultPanel status="FINISHED" winner="BLUE" viewerSide="BLUE" resultReason="SURRENDER" mode="UNRANKED" stats={stats} rematchState="opponent_requested" onRematch={onRematch} onRejectRematch={onReject} onBack={vi.fn()} />);

    expect(screen.getByText("Đối thủ muốn chơi lại")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đồng ý" }));
    fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
