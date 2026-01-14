/**
 * Opening Book for ENTROPY (Hex) Game
 *
 * Contains pre-computed strong opening moves for Hex on 11x11 board.
 * Based on theoretical analysis and high-level Hex play.
 *
 * Key Hex principles:
 * 1. Center control is critical (cells near center are most valuable)
 * 2. The first player has a significant advantage (Hex is proven to be first-player win)
 * 3. Acute corners are stronger than obtuse corners
 * 4. Bridge patterns create "virtual connections"
 * 5. The "short diagonal" is stronger than the "long diagonal"
 */

import type { BoardState, Move, Player } from "./types";
import { getCellState } from "./boardUtils";

/**
 * Opening move entry
 */
interface OpeningEntry {
  move: Move;
  priority: number; // Higher = better
  description: string; // For debugging
}

/**
 * Response to specific opening patterns
 */
interface OpeningResponse {
  pattern: { r: number; c: number; player: Player }[];
  responses: OpeningEntry[];
}

/**
 * Get cell value based on position (strategic importance)
 * For 11x11 board: center (5,5) is most valuable
 */
function getCellValue(r: number, c: number, rows: number = 11, cols: number = 11): number {
  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);

  // Distance from center (Manhattan)
  const distR = Math.abs(r - centerR);
  const distC = Math.abs(c - centerC);

  // Center cells are most valuable
  // Value decreases with distance from center
  // Max value at center = 100, decreasing outward
  const baseValue = 100 - (distR * 8 + distC * 8);

  // Bonus for main diagonals (strong connection paths)
  // For AI (top-bottom), vertical center column is important
  const colCenterBonus = (5 - Math.abs(c - centerC)) * 3;

  return Math.max(0, baseValue + colCenterBonus);
}

/**
 * AI opening moves (AI plays second, trying to connect top-bottom)
 * These are responses to common player openings
 */
const AI_OPENING_RESPONSES: OpeningResponse[] = [
  // Response to player center opening (5,5)
  {
    pattern: [{ r: 5, c: 5, player: 'PLAYER' }],
    responses: [
      { move: { r: 4, c: 5 }, priority: 100, description: "Block center, extend toward top" },
      { move: { r: 6, c: 5 }, priority: 95, description: "Block center, extend toward bottom" },
      { move: { r: 5, c: 4 }, priority: 90, description: "Adjacent to center" },
      { move: { r: 5, c: 6 }, priority: 90, description: "Adjacent to center" },
    ]
  },
  // Response to player near-center openings
  {
    pattern: [{ r: 5, c: 4, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center" },
      { move: { r: 4, c: 5 }, priority: 95, description: "Block and advance" },
    ]
  },
  {
    pattern: [{ r: 5, c: 6, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center" },
      { move: { r: 4, c: 5 }, priority: 95, description: "Block and advance" },
    ]
  },
  // Response to player edge openings (common beginner moves)
  {
    pattern: [{ r: 5, c: 0, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center (opponent wasted move on edge)" },
      { move: { r: 4, c: 5 }, priority: 95, description: "Near center" },
    ]
  },
  {
    pattern: [{ r: 5, c: 10, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center" },
      { move: { r: 4, c: 5 }, priority: 95, description: "Near center" },
    ]
  },
  // Response to corner openings
  {
    pattern: [{ r: 0, c: 0, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center (corner is weak)" },
    ]
  },
  // Response to acute corner area (stronger corner)
  {
    pattern: [{ r: 0, c: 10, player: 'PLAYER' }],
    responses: [
      { move: { r: 5, c: 5 }, priority: 100, description: "Take center" },
      { move: { r: 1, c: 9 }, priority: 80, description: "Block acute corner extension" },
    ]
  },
];

/**
 * AI first moves (if AI plays first - rare in this game)
 */
const AI_FIRST_MOVES: OpeningEntry[] = [
  { move: { r: 5, c: 5 }, priority: 100, description: "Center is optimal first move" },
  { move: { r: 4, c: 5 }, priority: 95, description: "Near center, toward AI goal" },
  { move: { r: 6, c: 5 }, priority: 95, description: "Near center, toward AI goal" },
  { move: { r: 5, c: 4 }, priority: 90, description: "Near center" },
  { move: { r: 5, c: 6 }, priority: 90, description: "Near center" },
];

/**
 * Strategic positions for AI mid-game (when no specific pattern matches)
 * Sorted by strategic value for top-bottom connection
 */
const AI_STRATEGIC_POSITIONS: OpeningEntry[] = [
  // Center column (most important for top-bottom)
  { move: { r: 5, c: 5 }, priority: 100, description: "Center" },
  { move: { r: 4, c: 5 }, priority: 95, description: "Upper center" },
  { move: { r: 6, c: 5 }, priority: 95, description: "Lower center" },
  { move: { r: 3, c: 5 }, priority: 90, description: "Upper mid" },
  { move: { r: 7, c: 5 }, priority: 90, description: "Lower mid" },
  { move: { r: 2, c: 5 }, priority: 85, description: "Upper quarter" },
  { move: { r: 8, c: 5 }, priority: 85, description: "Lower quarter" },

  // Adjacent columns
  { move: { r: 5, c: 4 }, priority: 88, description: "Center-left" },
  { move: { r: 5, c: 6 }, priority: 88, description: "Center-right" },
  { move: { r: 4, c: 4 }, priority: 83, description: "Upper center-left" },
  { move: { r: 4, c: 6 }, priority: 83, description: "Upper center-right" },
  { move: { r: 6, c: 4 }, priority: 83, description: "Lower center-left" },
  { move: { r: 6, c: 6 }, priority: 83, description: "Lower center-right" },

  // Diagonal bridge positions (for virtual connections)
  { move: { r: 3, c: 4 }, priority: 78, description: "Upper diagonal" },
  { move: { r: 3, c: 6 }, priority: 78, description: "Upper diagonal" },
  { move: { r: 7, c: 4 }, priority: 78, description: "Lower diagonal" },
  { move: { r: 7, c: 6 }, priority: 78, description: "Lower diagonal" },
];

/**
 * Check if board matches a specific pattern
 */
function matchesPattern(
  board: BoardState,
  pattern: { r: number; c: number; player: Player }[]
): boolean {
  for (const p of pattern) {
    const cellState = getCellState(board, { r: p.r, c: p.c });
    if (cellState !== p.player) {
      return false;
    }
  }
  return true;
}

/**
 * Count pieces on board
 */
function countPieces(board: BoardState): { player: number; ai: number } {
  const { rows, cols } = board.boardSize;
  let player = 0;
  let ai = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const state = board.cells[r][c];
      if (state === 'PLAYER') player++;
      else if (state === 'AI') ai++;
    }
  }

  return { player, ai };
}

/**
 * Check if a position is empty
 */
function isPositionEmpty(board: BoardState, move: Move): boolean {
  return getCellState(board, move) === 'EMPTY';
}

/**
 * Get opening book move for AI
 *
 * @param board - Current board state
 * @param difficulty - AI difficulty level
 * @returns Opening book move or null if not in opening phase
 */
export function getOpeningBookMove(
  board: BoardState,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): Move | null {
  const { rows, cols } = board.boardSize;

  // Only use opening book for standard 11x11 board
  if (rows !== 11 || cols !== 11) {
    return null;
  }

  const pieces = countPieces(board);
  const totalPieces = pieces.player + pieces.ai;

  // Opening book phase limits based on difficulty
  // NEXUS-3: First 2 moves only (limited book knowledge)
  // NEXUS-5: First 5 moves
  // NEXUS-7: First 8 moves (deep book knowledge)
  const maxBookMoves = difficulty === 'NEXUS-3' ? 2 :
                        difficulty === 'NEXUS-5' ? 5 : 8;

  if (totalPieces >= maxBookMoves * 2) {
    return null; // Out of opening book phase
  }

  // NEXUS-3: Add randomness to opening (intentionally weaker)
  if (difficulty === 'NEXUS-3' && Math.random() < 0.3) {
    return null; // 30% chance to skip opening book
  }

  // If board is empty (AI plays first - rare)
  if (totalPieces === 0) {
    const candidates = AI_FIRST_MOVES.filter(e => isPositionEmpty(board, e.move));
    if (candidates.length > 0) {
      // NEXUS-7: Always pick best move
      // NEXUS-5: Pick from top 2
      // NEXUS-3: Pick from top 3 with some randomness
      if (difficulty === 'NEXUS-7') {
        return candidates[0].move;
      } else if (difficulty === 'NEXUS-5') {
        const topN = candidates.slice(0, 2);
        return topN[Math.floor(Math.random() * topN.length)].move;
      } else {
        const topN = candidates.slice(0, 3);
        return topN[Math.floor(Math.random() * topN.length)].move;
      }
    }
  }

  // Check for pattern-specific responses
  for (const response of AI_OPENING_RESPONSES) {
    if (matchesPattern(board, response.pattern)) {
      const validResponses = response.responses.filter(e => isPositionEmpty(board, e.move));
      if (validResponses.length > 0) {
        // NEXUS-7: Best response
        // NEXUS-5: Top 2 responses
        // NEXUS-3: Any valid response (with noise)
        if (difficulty === 'NEXUS-7') {
          return validResponses[0].move;
        } else if (difficulty === 'NEXUS-5') {
          const topN = validResponses.slice(0, 2);
          return topN[Math.floor(Math.random() * topN.length)].move;
        } else {
          return validResponses[Math.floor(Math.random() * validResponses.length)].move;
        }
      }
    }
  }

  // Fallback: Use strategic positions
  const strategicCandidates = AI_STRATEGIC_POSITIONS.filter(e => isPositionEmpty(board, e.move));
  if (strategicCandidates.length > 0) {
    if (difficulty === 'NEXUS-7') {
      // NEXUS-7: Best strategic position
      return strategicCandidates[0].move;
    } else if (difficulty === 'NEXUS-5') {
      // NEXUS-5: Top 3 strategic positions
      const topN = strategicCandidates.slice(0, 3);
      return topN[Math.floor(Math.random() * topN.length)].move;
    } else {
      // NEXUS-3: Top 5 with randomness
      const topN = strategicCandidates.slice(0, 5);
      return topN[Math.floor(Math.random() * topN.length)].move;
    }
  }

  return null;
}

/**
 * Calculate strategic value of a position for AI (top-bottom connection)
 * Used when opening book doesn't have a specific response
 *
 * @param board - Current board state
 * @param move - Position to evaluate
 * @returns Strategic value (higher = better)
 */
export function getPositionStrategicValue(
  board: BoardState,
  move: Move
): number {
  const { rows, cols } = board.boardSize;

  // Base value from position
  let value = getCellValue(move.r, move.c, rows, cols);

  // Bonus for center column (AI's main connection axis)
  const centerC = Math.floor(cols / 2);
  if (move.c === centerC) {
    value += 20;
  } else if (Math.abs(move.c - centerC) === 1) {
    value += 10;
  }

  // Bonus for positions that help connect to boundaries
  // Top boundary connection
  if (move.r <= 2) {
    value += 15;
  }
  // Bottom boundary connection
  if (move.r >= rows - 3) {
    value += 15;
  }

  // Penalty for edge columns (less useful for top-bottom connection)
  if (move.c === 0 || move.c === cols - 1) {
    value -= 20;
  }

  return value;
}

/**
 * Check if we're still in opening phase
 */
export function isOpeningPhase(board: BoardState): boolean {
  const pieces = countPieces(board);
  return pieces.player + pieces.ai <= 10; // First 5 moves each
}
