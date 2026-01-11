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
  
  // Isolation game rules: Queen can move any number of squares in 8 directions
  const dr = Math.abs(to.r - from.r);
  const dc = Math.abs(to.c - from.c);
  
  // Must be in a straight line or diagonal
  const isStraight = dr === 0 || dc === 0;
  const isDiagonal = dr === dc;
  
  if (!isStraight && !isDiagonal) return false;
  if (dr === 0 && dc === 0) return false; // Same position
  
  // Check if the path is clear (no destroyed tiles, no pieces)
  const stepR = to.r === from.r ? 0 : to.r > from.r ? 1 : -1;
  const stepC = to.c === from.c ? 0 : to.c > from.c ? 1 : -1;
  
  let currR = from.r + stepR;
  let currC = from.c + stepC;
  
  while (currR !== to.r || currC !== to.c) {
    const pos = { r: currR, c: currC };
    if (isDestroyed(pos, destroyed) || isOccupied(pos, playerPos, aiPos)) {
      return false; // Path blocked
    }
    currR += stepR;
    currC += stepC;
  }
  
  // If we reach here, it's a valid Queen move
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
  
  // Get all valid moves in 8 directions (Queen-like movement)
  // Isolation game rules: Queen can move any number of squares in 8 directions
  const directions = [
    { r: -1, c: -1 }, { r: -1, c: 0 }, { r: -1, c: 1 },
    { r: 0, c: -1 },                  { r: 0, c: 1 },
    { r: 1, c: -1 }, { r: 1, c: 0 }, { r: 1, c: 1 },
  ];
  
  for (const dir of directions) {
    let nextR = position.r + dir.r;
    let nextC = position.c + dir.c;
    
    while (
      isValidPosition({ r: nextR, c: nextC }, boardSize) &&
      !isDestroyed({ r: nextR, c: nextC }, destroyed) &&
      !isOccupied({ r: nextR, c: nextC }, playerPos, aiPos)
    ) {
      validMoves.push({ r: nextR, c: nextC });
      nextR += dir.r;
      nextC += dir.c;
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
