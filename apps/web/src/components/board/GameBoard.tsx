import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  FILES,
  getLegalDestinations,
  GOAL_COORDINATES,
  RANKS,
  rotateCoordinate180,
  type Coordinate,
  type Piece,
  type RuleState,
  type Side,
} from "@ottv2/game-rules";
import { PieceGlyph } from "./PieceGlyph";

export type GameBoardProps = {
  state: RuleState;
  viewSide: Side;
  interactionSide?: Side | null;
  onMove?: (from: Coordinate, to: Coordinate) => void;
  disabled?: boolean;
};

function blueViewCoordinates(): Coordinate[] {
  return [...RANKS].reverse().flatMap((rank) => FILES.map((file) => `${file}${rank}` as Coordinate));
}

function coordinatesForView(viewSide: Side): Coordinate[] {
  const blueView = blueViewCoordinates();
  return viewSide === "BLUE" ? blueView : blueView.map((coordinate) => rotateCoordinate180(coordinate));
}

function pieceLabel(piece: Piece | null): string {
  if (piece === null) return "trống";
  const names = { R: "Đấm", P: "Bao", S: "Kéo" } as const;
  return `Quân ${names[piece.type]} phe ${piece.side === "BLUE" ? "Xanh" : "Đỏ"}`;
}

function sideLabel(side: Side | null): string {
  return side === "BLUE" ? "Xanh" : side === "RED" ? "Đỏ" : "—";
}

export function GameBoard({ state, viewSide, interactionSide = viewSide, onMove, disabled = false }: GameBoardProps) {
  const [selectedCoordinate, setSelectedCoordinate] = useState<Coordinate | null>(null);
  const [focusedCoordinate, setFocusedCoordinate] = useState<Coordinate>(() => coordinatesForView(viewSide)[0] ?? "a1");
  const squareRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const displayCoordinates = useMemo(() => coordinatesForView(viewSide), [viewSide]);
  const displayFiles = viewSide === "RED" ? [...FILES].reverse() : [...FILES];
  const displayRanks = viewSide === "RED" ? [...RANKS] : [...RANKS].reverse();
  const legalDestinations = useMemo(
    () => selectedCoordinate === null || interactionSide === null ? [] : getLegalDestinations(state, interactionSide, selectedCoordinate),
    [interactionSide, selectedCoordinate, state],
  );
  const legalDestinationSet = useMemo(() => new Set(legalDestinations), [legalDestinations]);

  useEffect(() => {
    setSelectedCoordinate(null);
  }, [interactionSide, state, viewSide]);

  useEffect(() => {
    if (!displayCoordinates.includes(focusedCoordinate)) setFocusedCoordinate(displayCoordinates[0] ?? "a1");
  }, [displayCoordinates, focusedCoordinate]);

  function handleSquareClick(coordinate: Coordinate): void {
    if (disabled || interactionSide === null) return;
    if (selectedCoordinate !== null && legalDestinationSet.has(coordinate)) {
      onMove?.(selectedCoordinate, coordinate);
      if (onMove) setSelectedCoordinate(null);
      return;
    }
    const piece = state.board[coordinate];
    if (piece === null || piece.side !== interactionSide) {
      if (!legalDestinationSet.has(coordinate)) setSelectedCoordinate(null);
      return;
    }
    setSelectedCoordinate(coordinate);
  }

  function handleSquareKeyDown(event: KeyboardEvent<HTMLButtonElement>, coordinate: Coordinate): void {
    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedCoordinate(null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSquareClick(coordinate);
      return;
    }
    const index = displayCoordinates.indexOf(coordinate);
    if (index < 0) return;
    const column = index % 9;
    const row = Math.floor(index / 9);
    const nextIndex = event.key === "ArrowLeft" && column > 0 ? index - 1 : event.key === "ArrowRight" && column < 8 ? index + 1 : event.key === "ArrowUp" && row > 0 ? index - 9 : event.key === "ArrowDown" && row < 8 ? index + 9 : index;
    if (nextIndex === index) return;
    event.preventDefault();
    const next = displayCoordinates[nextIndex];
    setFocusedCoordinate(next);
    squareRefs.current[next]?.focus();
  }

  return (
    <section className="board-panel" aria-label={`Bàn cờ, góc nhìn phe ${sideLabel(viewSide)}`}>
      <div className="board-panel-header">
        <div>
          <p className="eyebrow">BÀN CỜ CHIẾN THUẬT</p>
          <h2>Bàn cờ 9×9</h2>
        </div>
        <div className={`turn-badge ${state.currentTurn?.toLowerCase() ?? "finished"}`}>
          {state.status === "FINISHED" ? `Kết thúc · ${sideLabel(state.winner)}` : `Lượt phe ${sideLabel(state.currentTurn)}`}
        </div>
      </div>
      <p className="board-help" role="status" aria-live="polite">
        {selectedCoordinate === null
          ? `Góc nhìn phe ${sideLabel(viewSide)}. Chọn quân để xem ô có thể đi. Dùng phím mũi tên để di chuyển.`
          : `Đang chọn ${selectedCoordinate}. ${legalDestinations.length} ô sáng là nước đi hợp lệ.`}
      </p>
      <div className="board-frame">
        <div className="board-axis board-axis-top" aria-hidden="true">{displayFiles.map((file) => <span key={`top-${file}`}>{file}</span>)}</div>
        <div className="board-with-ranks">
          <div className="board-axis board-axis-left" aria-hidden="true">{displayRanks.map((rank) => <span key={`left-${rank}`}>{rank}</span>)}</div>
          <div className="game-board" role="grid" aria-label="Bàn cờ OTTv2 9 nhân 9">
            {displayCoordinates.map((coordinate) => {
              const piece = state.board[coordinate];
              const isSelected = selectedCoordinate === coordinate;
              const isLegalDestination = legalDestinationSet.has(coordinate);
              const isCapture = isLegalDestination && piece !== null && piece.side !== interactionSide;
              const goalSide = GOAL_COORDINATES.BLUE === coordinate ? "blue" : GOAL_COORDINATES.RED === coordinate ? "red" : "";
              return (
                <button
                  className={`board-square ${piece?.side.toLowerCase() ?? "empty"} ${goalSide ? `goal ${goalSide}-goal` : ""} ${isSelected ? "selected" : ""} ${isLegalDestination ? "legal" : ""} ${isCapture ? "capture" : ""} ${disabled ? "disabled" : ""}`.trim()}
                  data-coordinate={coordinate}
                  data-legal={isLegalDestination ? "true" : "false"}
                  data-piece={piece?.type ?? "empty"}
                  key={coordinate}
                  onClick={() => handleSquareClick(coordinate)}
                  onKeyDown={(event) => handleSquareKeyDown(event, coordinate)}
                  onFocus={() => setFocusedCoordinate(coordinate)}
                  ref={(element) => { squareRefs.current[coordinate] = element; }}
                  disabled={disabled}
                  tabIndex={focusedCoordinate === coordinate ? 0 : -1}
                  role="gridcell"
                  type="button"
                  aria-label={`Ô ${coordinate}, ${pieceLabel(piece)}${goalSide ? `, đích ${goalSide === "blue" ? "Xanh" : "Đỏ"}` : ""}${isLegalDestination ? (isCapture ? ", có thể ăn quân" : ", có thể đi") : ""}`}
                  aria-pressed={isSelected}
                >
                  {goalSide && <span className="goal-marker" aria-hidden="true">◆</span>}
                  {piece && <span className={`board-piece-token ${piece.side.toLowerCase()}`} aria-hidden="true"><PieceGlyph type={piece.type} /><span className="board-piece-type">{piece.type}</span></span>}
                  <span className="board-coordinate">{coordinate}</span>
                </button>
              );
            })}
          </div>
          <div className="board-axis board-axis-right" aria-hidden="true">{displayRanks.map((rank) => <span key={`right-${rank}`}>{rank}</span>)}</div>
        </div>
        <div className="board-axis board-axis-bottom" aria-hidden="true">{displayFiles.map((file) => <span key={`bottom-${file}`}>{file}</span>)}</div>
      </div>
      <div className="board-legend" aria-label="Chú thích quân cờ">
        <span><PieceGlyph type="R" size={20} /> Đấm</span><span><PieceGlyph type="P" size={20} /> Bao</span><span><PieceGlyph type="S" size={20} /> Kéo</span>
      </div>
    </section>
  );
}
