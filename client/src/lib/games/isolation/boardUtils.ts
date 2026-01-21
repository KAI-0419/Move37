/**
 * ISOLATION Board Utilities
 * 
 * Functions for parsing, generating, and manipulating the ISOLATION board.
 */

import type { BoardState } from "./types";
import { DEFAULT_BOARD_SIZE } from "./types";

/**
 * Parse board state from JSON string
 */
export function parseBoardState(boardString: string): BoardState {
  try {
    const parsed = JSON.parse(boardString);
    return {
      boardSize: parsed.boardSize || DEFAULT_BOARD_SIZE,
      playerPos: parsed.playerPos || { r: 6, c: 0 },
      aiPos: parsed.aiPos || { r: 0, c: 6 },
      destroyed: parsed.destroyed || [],
    };
  } catch (error) {
    console.error("Failed to parse board state:", error);
    // Return default board state
    return {
      boardSize: DEFAULT_BOARD_SIZE,
      playerPos: { r: 0, c: 0 },
      aiPos: { r: 6, c: 6 },
      destroyed: [],
    };
  }
}

/**
 * Generate board state as JSON string
 */
export function generateBoardString(board: BoardState): string {
  return JSON.stringify(board);
}

/**
 * Get initial board state with random positions
 */
export function getInitialBoard(): BoardState {
  const boardSize = DEFAULT_BOARD_SIZE;
  const totalCells = boardSize.rows * boardSize.cols;

  // Generate random positions for player and AI
  // Ensure they are at least 2 cells apart
  let playerPos: { r: number; c: number };
  let aiPos: { r: number; c: number };

  do {
    const playerIndex = Math.floor(Math.random() * totalCells);
    const aiIndex = Math.floor(Math.random() * totalCells);

    playerPos = {
      r: Math.floor(playerIndex / boardSize.cols),
      c: playerIndex % boardSize.cols,
    };

    aiPos = {
      r: Math.floor(aiIndex / boardSize.cols),
      c: aiIndex % boardSize.cols,
    };

    // Calculate Manhattan distance
    const distance = Math.abs(playerPos.r - aiPos.r) + Math.abs(playerPos.c - aiPos.c);

    // If positions are different and at least 2 cells apart, we're good
    if (distance >= 2 && (playerPos.r !== aiPos.r || playerPos.c !== aiPos.c)) {
      break;
    }
  } while (true);

  return {
    boardSize,
    playerPos,
    aiPos,
    destroyed: [],
  };
}

/**
 * Check if a position is valid (within board bounds)
 */
export function isValidPosition(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): boolean {
  return (
    pos.r >= 0 &&
    pos.r < boardSize.rows &&
    pos.c >= 0 &&
    pos.c < boardSize.cols
  );
}

/**
 * Check if a position is destroyed
 */
export function isDestroyed(
  pos: { r: number; c: number },
  destroyed: { r: number; c: number }[]
): boolean {
  return destroyed.some(d => d.r === pos.r && d.c === pos.c);
}

/**
 * Check if a position is occupied by a piece
 */
export function isOccupied(
  pos: { r: number; c: number },
  playerPos: { r: number; c: number },
  aiPos: { r: number; c: number }
): boolean {
  return (
    (pos.r === playerPos.r && pos.c === playerPos.c) ||
    (pos.r === aiPos.r && pos.c === aiPos.c)
  );
}

/**
 * Get all adjacent positions (8 directions: up, down, left, right, and diagonals)
 */
export function getAdjacentPositions(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): { r: number; c: number }[] {
  const directions = [
    { r: -1, c: -1 }, // top-left
    { r: -1, c: 0 },  // top
    { r: -1, c: 1 },   // top-right
    { r: 0, c: -1 },   // left
    { r: 0, c: 1 },    // right
    { r: 1, c: -1 },   // bottom-left
    { r: 1, c: 0 },    // bottom
    { r: 1, c: 1 },    // bottom-right
  ];

  const adjacent: { r: number; c: number }[] = [];

  for (const dir of directions) {
    const newPos = { r: pos.r + dir.r, c: pos.c + dir.c };
    if (isValidPosition(newPos, boardSize)) {
      adjacent.push(newPos);
    }
  }

  return adjacent;
}

/**
 * Flood Fill algorithm to calculate reachable area from a position
 * Returns the number of reachable cells (including the starting position)
 * 
 * This function calculates how many cells a piece can reach from the given position,
 * considering destroyed tiles and the other piece as obstacles.
 * 
 * @param startPos - Starting position for the flood fill
 * @param boardState - Current board state
 * @returns Number of reachable cells from startPos
 */
export function floodFill(
  startPos: { r: number; c: number },
  boardState: BoardState
): number {
  const { boardSize, playerPos, aiPos, destroyed } = boardState;
  const visited = new Set<string>();
  const queue: { r: number; c: number }[] = [startPos];
  visited.add(`${startPos.r},${startPos.c}`);

  // Start with count = 1 because we include the starting position
  let count = 1;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const adjacent = getAdjacentPositions(current, boardSize);

    for (const next of adjacent) {
      const key = `${next.r},${next.c}`;

      // Skip if already visited
      if (visited.has(key)) continue;

      // Skip if destroyed
      if (isDestroyed(next, destroyed)) continue;

      // Skip if occupied by the other piece
      // Note: We allow the starting position even if it's occupied (by the piece itself)
      // This is handled by the condition: if next is startPos, the condition is false
      // and we don't skip it. Otherwise, if it's occupied by the other piece, we skip it.
      if (
        (next.r !== startPos.r || next.c !== startPos.c) &&
        isOccupied(next, playerPos, aiPos)
      ) {
        continue;
      }

      // This position is reachable
      visited.add(key);
      queue.push(next);
      count++;
    }
  }

  return count;
}

/**
 * Get all empty cells (not destroyed, not occupied)
 */
export function getEmptyCells(boardState: BoardState): { r: number; c: number }[] {
  const { boardSize, playerPos, aiPos, destroyed } = boardState;
  const empty: { r: number; c: number }[] = [];

  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const pos = { r, c };

      // Skip if destroyed
      if (isDestroyed(pos, destroyed)) continue;

      // Skip if occupied
      if (isOccupied(pos, playerPos, aiPos)) continue;

      empty.push(pos);
    }
  }

  return empty;
}
