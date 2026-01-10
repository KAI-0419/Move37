/**
 * ISOLATION Game Types
 * 
 * Type definitions specific to the ISOLATION game.
 */

export interface BoardState {
  boardSize: { rows: number; cols: number };
  playerPos: { r: number; c: number };
  aiPos: { r: number; c: number };
  destroyed: { r: number; c: number }[];
}

export interface MoveWithDestroy {
  from: { r: number; c: number };
  to: { r: number; c: number };
  destroy: { r: number; c: number };
}

export const DEFAULT_BOARD_SIZE = { rows: 7, cols: 7 };
