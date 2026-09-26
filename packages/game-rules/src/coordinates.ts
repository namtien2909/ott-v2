import { FILES, RANKS, type Coordinate, type File, type Rank, type Side } from "./types.js";

export const BOARD_COORDINATES: readonly Coordinate[] = Object.freeze(
  RANKS.flatMap((rank) => FILES.map((file) => `${file}${rank}` as Coordinate)),
);

export const GOAL_COORDINATES: Readonly<Record<Side, Coordinate>> = Object.freeze({
  BLUE: "i9",
  RED: "a1",
});

export type BoardPosition = Readonly<{
  fileIndex: number;
  rankIndex: number;
}>;

export function isCoordinate(value: unknown): value is Coordinate {
  return typeof value === "string" && /^[a-i][1-9]$/.test(value);
}

export function coordinateToPosition(coordinate: Coordinate): BoardPosition {
  const file = coordinate.slice(0, 1) as File;
  const rank = Number(coordinate.slice(1)) as Rank;
  return {
    fileIndex: FILES.indexOf(file),
    rankIndex: RANKS.indexOf(rank),
  };
}

export function positionToCoordinate(fileIndex: number, rankIndex: number): Coordinate | null {
  const file = FILES[fileIndex];
  const rank = RANKS[rankIndex];
  if (file === undefined || rank === undefined) return null;
  return `${file}${rank}` as Coordinate;
}

export function rotateCoordinate180(coordinate: Coordinate): Coordinate {
  const { fileIndex, rankIndex } = coordinateToPosition(coordinate);
  return positionToCoordinate(FILES.length - 1 - fileIndex, RANKS.length - 1 - rankIndex) as Coordinate;
}

export function adjacentCoordinates(from: Coordinate): readonly Coordinate[] {
  const { fileIndex, rankIndex } = coordinateToPosition(from);
  const coordinates: Coordinate[] = [];
  for (let rankDelta = -1; rankDelta <= 1; rankDelta += 1) {
    for (let fileDelta = -1; fileDelta <= 1; fileDelta += 1) {
      if (fileDelta === 0 && rankDelta === 0) continue;
      const coordinate = positionToCoordinate(fileIndex + fileDelta, rankIndex + rankDelta);
      if (coordinate !== null) coordinates.push(coordinate);
    }
  }
  return coordinates;
}
