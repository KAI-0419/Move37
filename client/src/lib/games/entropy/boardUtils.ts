/**
 * ENTROPY Board Utilities
 * 
 * Functions for parsing, generating, and manipulating the ENTROPY (Hex) board.
 */

import type { BoardState, CellState, HexNeighbors } from "./types";
import { DEFAULT_BOARD_SIZE } from "./types";

/**
 * Parse board state from JSON string
 */
export function parseBoardState(boardString: string): BoardState {
  try {
    const parsed = JSON.parse(boardString);
    return {
      boardSize: parsed.boardSize || DEFAULT_BOARD_SIZE,
      cells: parsed.cells || getEmptyBoard(parsed.boardSize || DEFAULT_BOARD_SIZE),
      turnCount: parsed.turnCount || 0,
    };
  } catch (error) {
    console.error("Failed to parse board state:", error);
    // Return default board state
    return getInitialBoard();
  }
}

/**
 * Generate board state as JSON string
 */
export function generateBoardString(board: BoardState): string {
  return JSON.stringify(board);
}

/**
 * Get empty board (all cells are EMPTY)
 */
export function getEmptyBoard(boardSize: { rows: number; cols: number }): CellState[][] {
  const cells: CellState[][] = [];
  for (let r = 0; r < boardSize.rows; r++) {
    const row: CellState[] = [];
    for (let c = 0; c < boardSize.cols; c++) {
      row.push('EMPTY');
    }
    cells.push(row);
  }
  return cells;
}

/**
 * Get initial board state (empty board)
 */
export function getInitialBoard(): BoardState {
  const boardSize = DEFAULT_BOARD_SIZE;
  return {
    boardSize,
    cells: getEmptyBoard(boardSize),
    turnCount: 0,
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
 * Get cell state at position
 */
export function getCellState(
  board: BoardState,
  pos: { r: number; c: number }
): CellState {
  if (!isValidPosition(pos, board.boardSize)) {
    return 'EMPTY';
  }
  return board.cells[pos.r][pos.c];
}

/**
 * Set cell state at position
 */
export function setCellState(
  board: BoardState,
  pos: { r: number; c: number },
  state: CellState
): void {
  if (!isValidPosition(pos, board.boardSize)) {
    return;
  }
  board.cells[pos.r][pos.c] = state;
}

/**
 * Get hexagonal neighbors of a cell
 * Uses offset coordinates (odd-r layout)
 * 
 * In Odd-r offset coordinate system:
 * - Odd rows (r=1,3,5,...): shifted right, so top/bottom neighbors are at (c) and (c+1)
 * - Even rows (r=0,2,4,...): shifted left, so top/bottom neighbors are at (c-1) and (c)
 * 
 * Critical symmetry: A cell's bottom neighbors must match the top neighbors
 * of the cell directly below it (which is in the opposite row parity).
 */
export function getHexNeighbors(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): HexNeighbors {
  const { r, c } = pos;
  const isOddRow = r % 2 === 1;

  if (isOddRow) {
    // 홀수 행 (Odd rows): 상/하단 모두 현재 열(c)과 오른쪽 열(c+1)이 이웃입니다.
    return {
      topLeft: { r: r - 1, c },
      topRight: { r: r - 1, c: c + 1 },
      left: { r, c: c - 1 },
      right: { r, c: c + 1 },
      bottomLeft: { r: r + 1, c },
      bottomRight: { r: r + 1, c: c + 1 },
    };
  } else {
    // 짝수 행 (Even rows): 상/하단 모두 왼쪽 열(c-1)과 현재 열(c)이 이웃입니다.
    return {
      topLeft: { r: r - 1, c: c - 1 },
      topRight: { r: r - 1, c },
      left: { r, c: c - 1 },
      right: { r, c: c + 1 },
      bottomLeft: { r: r + 1, c: c - 1 },
      bottomRight: { r: r + 1, c },
    };
  }
}

/**
 * Get all valid neighbors (within board bounds)
 */
export function getValidNeighbors(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): { r: number; c: number }[] {
  const neighbors = getHexNeighbors(pos, boardSize);
  const valid: { r: number; c: number }[] = [];

  const allNeighbors = [
    neighbors.topLeft,
    neighbors.topRight,
    neighbors.left,
    neighbors.right,
    neighbors.bottomLeft,
    neighbors.bottomRight,
  ];

  for (const neighbor of allNeighbors) {
    if (isValidPosition(neighbor, boardSize)) {
      valid.push(neighbor);
    }
  }

  return valid;
}

/**
 * Convert 2D position to linear index
 */
export function positionToIndex(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): number {
  return pos.r * boardSize.cols + pos.c;
}

/**
 * Convert linear index to 2D position
 */
export function indexToPosition(
  index: number,
  boardSize: { rows: number; cols: number }
): { r: number; c: number } {
  return {
    r: Math.floor(index / boardSize.cols),
    c: index % boardSize.cols,
  };
}

/**
 * Count cells of a specific state
 */
export function countCells(board: BoardState, state: CellState): number {
  let count = 0;
  for (let r = 0; r < board.boardSize.rows; r++) {
    for (let c = 0; c < board.boardSize.cols; c++) {
      if (board.cells[r][c] === state) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Calculate hexagonal distance between two positions
 * Uses offset coordinate system (odd-r layout)
 */
export function getHexDistance(
  pos1: { r: number; c: number },
  pos2: { r: number; c: number }
): number {
  // Convert offset coordinates to cube coordinates
  const x1 = pos1.c - (pos1.r - (pos1.r & 1)) / 2;
  const z1 = pos1.r;
  const y1 = -x1 - z1;
  
  const x2 = pos2.c - (pos2.r - (pos2.r & 1)) / 2;
  const z2 = pos2.r;
  const y2 = -x2 - z2;
  
  // Cube distance
  return (Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(z2 - z1)) / 2;
}

/**
 * Create a deep copy of the board state
 */
export function cloneBoard(board: BoardState): BoardState {
  return {
    boardSize: { ...board.boardSize },
    cells: board.cells.map(row => [...row]),
    turnCount: board.turnCount,
  };
}
