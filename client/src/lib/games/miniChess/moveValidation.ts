/**
 * Mini Chess Move Validation
 * 
 * Functions for validating moves in Mini Chess.
 */

import type { Board } from "./types";

export function isValidMove(
  board: Board, 
  from: { r: number; c: number }, 
  to: { r: number; c: number }, 
  isPlayer: boolean
): boolean {
  if (from.r < 0 || from.r >= 5 || from.c < 0 || from.c >= 5) return false;
  if (to.r < 0 || to.r >= 5 || to.c < 0 || to.c >= 5) return false;

  const piece = board[from.r][from.c];
  if (!piece) return false;

  // Check ownership
  // Player uses lowercase (n, p, k), AI uses uppercase (N, P, K)
  const isPlayerPiece = piece === piece.toLowerCase() && piece !== piece.toUpperCase();
  const isAiPiece = piece === piece.toUpperCase() && piece !== piece.toLowerCase();
  
  if (isPlayer && !isPlayerPiece) return false;
  if (!isPlayer && !isAiPiece) return false;

  // Check target (cannot capture own piece)
  const target = board[to.r][to.c];
  if (target) {
    const isTargetPlayerPiece = target === target.toLowerCase() && target !== target.toUpperCase();
    const isTargetAiPiece = target === target.toUpperCase() && target !== target.toLowerCase();
    if ((isPlayerPiece && isTargetPlayerPiece) || (isAiPiece && isTargetAiPiece)) {
      return false; // Cannot capture own piece
    }
  }

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const type = piece.toLowerCase();

  if (type === 'k') {
    // King: 1 step any direction
    return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
  } else if (type === 'n') {
    // Knight: L shape
    return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
  } else if (type === 'p') {
    // Pawn: Forward 1 step (or capture diagonal)
    // Player (lowercase) moves UP (-1), AI (uppercase) moves DOWN (+1)
    const direction = isPlayerPiece ? -1 : 1;
    
    // Move forward 1
    if (dc === 0 && dr === direction) {
      return target === null;
    }
    // Capture diagonal
    if (Math.abs(dc) === 1 && dr === direction) {
      return target !== null;
    }
  }

  return false;
}

export function getValidMoves(
  board: Board, 
  from: { r: number; c: number }, 
  isPlayer: boolean
): { r: number; c: number }[] {
  const moves: { r: number; c: number }[] = [];
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (isValidMove(board, from, { r, c }, isPlayer)) {
        moves.push({ r, c });
      }
    }
  }
  
  return moves;
}
