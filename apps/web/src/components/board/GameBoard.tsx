import { useEffect, useMemo, useState } from "react";
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

const PIECE_SYMBOLS = {
  R: "✊",
  P: "✋",
  S: "✌️",
} as const;

export type GameBoardProps = {
  state: RuleState;
  viewSide: Side;
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
  const names = { R: "Rock", P: "Paper", S: "Scissors" } as const;
  return `${piece.side === "BLUE" ? "Xanh" : "Đỏ"} ${names[piece.type]}`;
}

export function GameBoard({ state, viewSide, onMove, disabled = false }: GameBoardProps) {
  const [selectedCoordinate, setSelectedCoordinate] = useState<Coordinate | null>(null);
  const displayCoordinates = useMemo(() => coordinatesForView(viewSide), [viewSide]);
  const displayFiles = viewSide === "RED" ? [...FILES].reverse() : [...FILES];
  const displayRanks = viewSide === "RED" ? [...RANKS] : [...RANKS].reverse();
  const legalDestinations = useMemo(
    () => selectedCoordinate === null ? [] : getLegalDestinations(state, viewSide, selectedCoordinate),
    [selectedCoordinate, state, viewSide],
  );
  const legalDestinationSet = useMemo(() => new Set(legalDestinations), [legalDestinations]);

  useEffect(() => {
    setSelectedCoordinate(null);
  }, [state, viewSide]);

  function handleSquareClick(coordinate: Coordinate): void {
    if (disabled) return;
    if (selectedCoordinate !== null && legalDestinationSet.has(coordinate)) {
      onMove?.(selectedCoordinate, coordinate);
      if (onMove) setSelectedCoordinate(null);
      return;
    }
    const piece = state.board[coordinate];
    if (piece === null || piece.side !== viewSide) {
      if (!legalDestinationSet.has(coordinate)) setSelectedCoordinate(null);
      return;
    }
    setSelectedCoordinate(coordinate);
  }

  return (
    <section className="board-panel" aria-label={`Bàn cờ, góc nhìn ${viewSide}`}>
      <div className="board-panel-header">
        <div>
          <p className="eyebrow">W1 / GAME RULES FIXTURE</p>
          <h2>Bàn cờ 9×9</h2>
        </div>
        <div className={`turn-badge ${state.currentTurn?.toLowerCase() ?? "finished"}`}>
          {state.status === "FINISHED" ? `Kết thúc · ${state.winner}` : `Lượt ${state.currentTurn}`}
        </div>
      </div>
      <p className="board-help" aria-live="polite">
        {selectedCoordinate === null
          ? `Góc nhìn ${viewSide}. Chọn một quân ${viewSide} để xem ô có thể đi.`
          : `Đang chọn ${selectedCoordinate}. Ô sáng là legal move cục bộ; chưa gửi nước đi.`}
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
              const isCapture = isLegalDestination && piece !== null && piece.side !== viewSide;
              const goalSide = GOAL_COORDINATES.BLUE === coordinate ? "blue" : GOAL_COORDINATES.RED === coordinate ? "red" : "";
              return (
                <button
                  className={`board-square ${piece?.side.toLowerCase() ?? "empty"} ${goalSide ? `goal ${goalSide}-goal` : ""} ${isSelected ? "selected" : ""} ${isLegalDestination ? "legal" : ""} ${isCapture ? "capture" : ""} ${disabled ? "disabled" : ""}`.trim()}
                  data-coordinate={coordinate}
                  data-legal={isLegalDestination ? "true" : "false"}
                  data-piece={piece?.type ?? "empty"}
                  key={coordinate}
                  onClick={() => handleSquareClick(coordinate)}
                  disabled={disabled}
                  role="gridcell"
                  type="button"
                  aria-label={`Ô ${coordinate}, ${pieceLabel(piece)}${goalSide ? `, đích ${goalSide === "blue" ? "Xanh" : "Đỏ"}` : ""}${isLegalDestination ? (isCapture ? ", có thể ăn quân" : ", có thể đi") : ""}`}
                  aria-pressed={isSelected}
                >
                  {goalSide && <span className="goal-marker" aria-hidden="true">◆</span>}
                  {piece && <span className={`board-piece-token ${piece.side.toLowerCase()}`} aria-hidden="true"><span className="board-piece-symbol">{PIECE_SYMBOLS[piece.type]}</span><span className="board-piece-type">{piece.type}</span></span>}
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
        <span><b>✊</b> Rock</span><span><b>✋</b> Paper</span><span><b>✌️</b> Scissors</span>
      </div>
    </section>
  );
}
