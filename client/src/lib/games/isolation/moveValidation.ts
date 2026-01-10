/**
 * ISOLATION Move Validation
 * 
 * Functions for validating moves in ISOLATION game.
 */

import type { BoardState } from "./types";
import {
  isValidPosition,
  isDestroyed,
  isOccupied,
  getAdjacentPositions,
  getEmptyCells,
} from "./boardUtils";

/**
 * Check if a move is valid
 */
export function isValidMove(
  boardState: BoardState,
  from: { r: number; c: number },
  to: { r: number; c: number },
  isPlayer: boolean
): boolean {
  const { boardSize, playerPos, aiPos, destroyed } = boardState;
  
  // Check if from position is valid
  if (!isValidPosition(from, boardSize)) return false;
  
  // Check if to position is valid
  if (!isValidPosition(to, boardSize)) return false;
  
  // Check if from position matches the correct piece
  const expectedPos = isPlayer ? playerPos : aiPos;
  if (from.r !== expectedPos.r || from.c !== expectedPos.c) {
    return false;
  }
  
  // Check if from position is destroyed
  if (isDestroyed(from, destroyed)) return false;
  
  // Check if to position is destroyed
  if (isDestroyed(to, destroyed)) return false;
  
  // Check if to position is occupied
  if (isOccupied(to, playerPos, aiPos)) return false;
  
  // Isolation game rules: Queen can only move to ADJACENT squares (8 directions)
  // Check if the move is to an adjacent position
  const dr = Math.abs(to.r - from.r);
  const dc = Math.abs(to.c - from.c);
  
  // Must be adjacent: distance of 1 in row, column, or both (diagonal)
  // Valid adjacent moves: (0,1), (1,0), (1,1) - but not (0,0)
  if (dr === 0 && dc === 0) return false; // Same position
  if (dr > 1 || dc > 1) return false; // Not adjacent (must be exactly 1 step away)
  
  // If we reach here, it's a valid adjacent move
  return true;
}

/**
 * Get all valid moves for a piece
 */
export function getValidMoves(
  boardState: BoardState,
  position: { r: number; c: number },
  isPlayer: boolean
): { r: number; c: number }[] {
  const { boardSize, playerPos, aiPos, destroyed } = boardState;
  const validMoves: { r: number; c: number }[] = [];
  
  // First, verify that the position matches the correct piece
  const expectedPos = isPlayer ? playerPos : aiPos;
  if (position.r !== expectedPos.r || position.c !== expectedPos.c) {
    // Position doesn't match the piece, return empty array
    console.warn(`getValidMoves: Position mismatch. Expected ${isPlayer ? 'player' : 'AI'} at (${expectedPos.r}, ${expectedPos.c}), got (${position.r}, ${position.c})`);
    return validMoves;
  }
  
  // Check if the piece's current position is destroyed (shouldn't happen, but safety check)
  if (isDestroyed(position, destroyed)) {
    console.warn(`getValidMoves: Piece is on a destroyed tile at (${position.r}, ${position.c})`);
    return validMoves;
  }
  
  // Get adjacent positions only (8 directions: up, down, left, right, and diagonals)
  // Isolation game rules: Queen can only move to ADJACENT squares, not unlimited distance
  const adjacent = getAdjacentPositions(position, boardSize);
  
  // Filter valid adjacent moves
  for (const next of adjacent) {
    // Check if the adjacent position is valid (not destroyed, not occupied)
    if (
      !isDestroyed(next, destroyed) &&
      !isOccupied(next, playerPos, aiPos)
    ) {
      validMoves.push(next);
    }
  }
  
  return validMoves;
}

/**
 * Get all valid destroy positions (empty cells after move)
 * @param boardState - Current board state (before move)
 * @param afterMove - Position where the piece will be after the move
 * @param isPlayer - Whether the move is made by the player (true) or AI (false)
 */
export function getValidDestroyPositions(
  boardState: BoardState,
  afterMove: { r: number; c: number },
  isPlayer: boolean
): { r: number; c: number }[] {
  // Create temporary board state with the move applied
  // This represents the board state AFTER the move but BEFORE destroy
  const tempBoardState: BoardState = {
    ...boardState,
    playerPos: isPlayer ? afterMove : boardState.playerPos,
    aiPos: isPlayer ? boardState.aiPos : afterMove,
    destroyed: [...boardState.destroyed], // Copy destroyed array
  };
  
  // Get all empty cells (excluding the new piece position)
  const empty = getEmptyCells(tempBoardState);
  
  // Filter out the new piece position (cannot destroy the square you just moved to)
  return empty.filter(pos => !(pos.r === afterMove.r && pos.c === afterMove.c));
}
