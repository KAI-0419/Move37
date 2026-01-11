/**
 * ENTROPY (Hex) Game Types
 * 
 * Type definitions specific to the ENTROPY (Hex) game.
 * This is a variant of the classic Hex game where players try to connect
 * opposite sides of a hexagonal board.
 */

export type CellState = 'EMPTY' | 'PLAYER' | 'AI';

export interface BoardState {
  boardSize: { rows: number; cols: number };
  cells: CellState[][]; // 2D array: cells[r][c]
  turnCount: number;
}

export interface Move {
  r: number;
  c: number;
}

export type Player = 'PLAYER' | 'AI';

export const DEFAULT_BOARD_SIZE = { rows: 11, cols: 11 };

/**
 * Hexagonal grid neighbors
 * In a hexagonal grid, each cell has 6 neighbors
 * For offset coordinates (odd-r layout):
 * - Even rows: (r-1,c-1), (r-1,c), (r,c-1), (r,c+1), (r+1,c-1), (r+1,c)
 * - Odd rows: (r-1,c), (r-1,c+1), (r,c-1), (r,c+1), (r+1,c), (r+1,c+1)
 * 
 * Critical symmetry property: A cell's bottom neighbors must exactly match
 * the top neighbors of the cell directly below it (which has opposite row parity).
 * This ensures bidirectional connectivity and prevents ghost connections.
 */
export interface HexNeighbors {
  topLeft: { r: number; c: number };
  topRight: { r: number; c: number };
  left: { r: number; c: number };
  right: { r: number; c: number };
  bottomLeft: { r: number; c: number };
  bottomRight: { r: number; c: number };
}

/**
 * Boundary types for connection checking
 */
export type BoundaryType = 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';
