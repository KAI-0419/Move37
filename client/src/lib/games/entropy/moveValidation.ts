/**
 * Move Validation for ENTROPY (Hex) Game
 * 
 * Validates moves and provides utility functions for move generation.
 */

import type { BoardState, Move, Player } from "./types";
import { isValidPosition, getCellState, setCellState, cloneBoard } from "./boardUtils";
import { getEmptyCells, isConnected } from "./connectionCheck";
import { analyzePlayerPath, findCriticalPositions } from "./pathAnalysis";

/**
 * Check if a move is valid
 * 
 * @param board - Current board state
 * @param move - Move to validate
 * @param player - Player making the move
 * @returns True if the move is valid
 */
export function isValidMove(
  board: BoardState,
  move: Move,
  player: Player
): boolean {
  // Check if position is within bounds
  if (!isValidPosition(move, board.boardSize)) {
    return false;
  }

  // Check if cell is empty
  const cellState = getCellState(board, move);
  if (cellState !== 'EMPTY') {
    return false;
  }

  return true;
}

/**
 * Get all valid moves for a player
 * 
 * @param board - Current board state
 * @returns Array of valid moves
 */
export function getValidMoves(board: BoardState): Move[] {
  return getEmptyCells(board);
}

/**
 * Check if a move would block the opponent's connection
 * 
 * @param board - Current board state
 * @param move - Move to check
 * @param player - Player making the move
 * @returns True if the move would block opponent
 */
export function wouldBlockOpponent(
  board: BoardState,
  move: Move,
  player: Player
): boolean {
  const opponent: Player = player === 'PLAYER' ? 'AI' : 'PLAYER';
  
  // Check if opponent can currently connect
  const canConnectBefore = isConnected(board, opponent);
  if (!canConnectBefore) {
    // Opponent can't connect yet, but check if this move blocks critical positions
    const criticalPositions = findCriticalPositions(board);
    for (const critical of criticalPositions) {
      if (critical.r === move.r && critical.c === move.c) {
        return true; // This move blocks a critical connection point
      }
    }
  }
  
  // Create temporary board with the move applied
  const tempBoard = cloneBoard(board);
  const cellState: 'PLAYER' | 'AI' = player === 'PLAYER' ? 'PLAYER' : 'AI';
  setCellState(tempBoard, move, cellState);
  
  // Check if opponent can still connect after this move
  const canConnectAfter = isConnected(tempBoard, opponent);
  
  // If opponent could connect before but can't after, this move blocks them
  if (canConnectBefore && !canConnectAfter) {
    return true;
  }
  
  // Analyze opponent's path to see if this move significantly reduces their options
  const analysisBefore = analyzePlayerPath(board);
  const analysisAfter = analyzePlayerPath(tempBoard);
  
  // If critical positions decreased, this move is blocking
  if (analysisAfter.criticalPositions.length < analysisBefore.criticalPositions.length) {
    return true;
  }
  
  // If threat level decreased, this move is blocking
  const threatLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const beforeThreatIndex = threatLevels.indexOf(analysisBefore.threatLevel);
  const afterThreatIndex = threatLevels.indexOf(analysisAfter.threatLevel);
  
  if (afterThreatIndex < beforeThreatIndex) {
    return true; // Threat level decreased, so this move blocks
  }
  
  // Check if this move is on a predicted opponent path
  const predictedMoves = analysisBefore.predictedMoves;
  for (const predicted of predictedMoves.slice(0, 3)) { // Top 3 predicted moves
    if (predicted.move.r === move.r && predicted.move.c === move.c) {
      return true; // This move blocks a predicted opponent move
    }
  }
  
  return false;
}

/**
 * Find threat moves - moves that would create a winning threat for the opponent
 * 
 * @param board - Current board state
 * @param player - Player making the move (to find threats for opponent)
 * @returns Array of threat moves that should be blocked
 */
export function findThreatMoves(board: BoardState, player: Player): Move[] {
  const opponent: Player = player === 'PLAYER' ? 'AI' : 'PLAYER';
  
  // Analyze opponent's path
  const analysis = analyzePlayerPath(board);
  
  // Critical positions are immediate threats
  const threats: Move[] = [...analysis.criticalPositions];
  
  // Add top predicted moves as potential threats
  const predictedThreats = analysis.predictedMoves
    .slice(0, 5)
    .filter(p => p.score >= 50) // Only high-scoring predictions
    .map(p => p.move);
  
  // Add predicted threats that aren't already in critical positions
  for (const threat of predictedThreats) {
    const isDuplicate = threats.some(
      t => t.r === threat.r && t.c === threat.c
    );
    if (!isDuplicate) {
      threats.push(threat);
    }
  }
  
  return threats;
}

/**
 * Get moves that are near opponent's pieces
 * Useful for blocking strategies
 * 
 * @param board - Current board state
 * @param player - Player making the move
 * @returns Array of moves near opponent pieces
 */
export function getMovesNearOpponent(
  board: BoardState,
  player: Player
): Move[] {
  const opponent: Player = player === 'PLAYER' ? 'AI' : 'PLAYER';
  const opponentCells: Move[] = [];
  const { rows, cols } = board.boardSize;
  
  // Find all opponent cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.cells[r][c] === opponent) {
        opponentCells.push({ r, c });
      }
    }
  }
  
  // Find empty cells adjacent to opponent cells
  const nearMoves: Move[] = [];
  const emptyCells = getEmptyCells(board);
  
  for (const empty of emptyCells) {
    // Check if this empty cell is adjacent to any opponent cell
    for (const opponentCell of opponentCells) {
      const dr = Math.abs(empty.r - opponentCell.r);
      const dc = Math.abs(empty.c - opponentCell.c);
      
      // In hexagonal grid, neighbors are at distance 1
      // For offset coordinates, we need to check hex distance
      const hexDistance = getHexDistance(empty, opponentCell);
      
      if (hexDistance === 1) {
        nearMoves.push(empty);
        break; // Already found, no need to check other opponent cells
      }
    }
  }
  
  return nearMoves;
}

/**
 * Calculate hexagonal distance between two positions
 * Uses offset coordinate system
 */
function getHexDistance(
  pos1: { r: number; c: number },
  pos2: { r: number; c: number }
): number {
  const dr = pos2.r - pos1.r;
  const dc = pos2.c - pos1.c;
  
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
