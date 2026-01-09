// Client-side game logic helpers
// Uses shared game logic but adapts for UI (board string format)
import { parseFen, isValidMove, getValidMoves, type Board } from "@shared/gameLogic";

export type Piece = 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | '.';

// Convert board string (FEN format) to 2D array for UI
export function parseBoardString(boardString: string): Piece[][] {
  const board = parseFen(boardString);
  // Convert null to '.' for UI display
  return board.map(row => row.map(cell => (cell === null ? '.' : cell) as Piece));
}

// Check if move is valid (using shared logic)
export function isValidMoveClient(
  board: Piece[][],
  from: { r: number; c: number },
  to: { r: number; c: number },
  isPlayer: boolean
): boolean {
  // Convert UI board format to shared format
  const sharedBoard: Board = board.map(row => 
    row.map(cell => (cell === '.' ? null : cell) as any)
  );
  
  return isValidMove(sharedBoard, from, to, isPlayer);
}

// Get valid moves (using shared logic)
export function getValidMovesClient(
  board: Piece[][],
  from: { r: number; c: number },
  isPlayer: boolean
): { r: number; c: number }[] {
  // Convert UI board format to shared format
  const sharedBoard: Board = board.map(row => 
    row.map(cell => (cell === '.' ? null : cell) as any)
  );
  
  return getValidMoves(sharedBoard, from, isPlayer);
}
