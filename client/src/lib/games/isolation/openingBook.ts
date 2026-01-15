/**
 * Opening Book for ISOLATION AI
 *
 * Pre-computed optimal opening moves for the first 5-8 turns.
 * In Isolation, the opening phase is crucial for establishing:
 * - Center control
 * - Mobility potential
 * - Favorable partition positioning
 *
 * This significantly reduces computation time in early game
 * and ensures strong positional play from the start.
 */

import type { BoardState } from "./types";
import { posToIndex, indexToPos, CELL_MASKS, getQueenMoves, popCount } from "./bitboard";
import { getValidMoves, getValidDestroyPositions } from "./moveValidation";

// Opening principles for move selection
const OPENING_PRINCIPLES = {
  CENTER_WEIGHT: 10,
  MOBILITY_WEIGHT: 5,
  OPPONENT_RESTRICTION_WEIGHT: 8,
  CORNER_PENALTY: 15,
  EDGE_PENALTY: 5,
};

// Center cells (most valuable in opening)
const CENTER_CELLS = [
  { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 },
  { r: 3, c: 2 }, { r: 3, c: 3 }, { r: 3, c: 4 },
  { r: 4, c: 2 }, { r: 4, c: 3 }, { r: 4, c: 4 }
];

// The absolute center
const CENTER = { r: 3, c: 3 };

/**
 * Get opening book move for AI
 * Returns null if not in opening book range
 */
export function getOpeningMove(
  board: BoardState,
  turnCount: number
): { move: { r: number; c: number }; destroy: { r: number; c: number } } | null {
  // Only use opening book for first 8 AI turns (16 total turns)
  if (turnCount > 16) return null;

  const { playerPos, aiPos, destroyed } = board;

  // Get all valid moves
  const validMoves = getValidMoves(board, aiPos, false);
  if (validMoves.length === 0) return null;

  // Score each move based on opening principles
  const scoredMoves = validMoves.map(move => {
    const score = evaluateOpeningMove(board, move, turnCount);
    return { move, score };
  });

  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);

  // Pick the best move
  const bestMove = scoredMoves[0].move;

  // Find best destroy position
  const destroy = findBestOpeningDestroy(board, bestMove);

  return { move: bestMove, destroy };
}

/**
 * Evaluate a move based on opening principles
 */
function evaluateOpeningMove(
  board: BoardState,
  move: { r: number; c: number },
  turnCount: number
): number {
  const { playerPos, aiPos, destroyed } = board;
  let score = 0;

  // 1. Center control - crucial in opening
  const distToCenter = Math.abs(move.r - CENTER.r) + Math.abs(move.c - CENTER.c);
  score -= distToCenter * OPENING_PRINCIPLES.CENTER_WEIGHT;

  // Bonus for being in center area
  if (CENTER_CELLS.some(c => c.r === move.r && c.c === move.c)) {
    score += 20;
  }

  // 2. Avoid corners - death trap in Isolation
  const isCorner = (move.r === 0 || move.r === 6) && (move.c === 0 || move.c === 6);
  if (isCorner) {
    score -= OPENING_PRINCIPLES.CORNER_PENALTY * 3;
  }

  // 3. Avoid edges
  const isEdge = move.r === 0 || move.r === 6 || move.c === 0 || move.c === 6;
  if (isEdge && !isCorner) {
    score -= OPENING_PRINCIPLES.EDGE_PENALTY;
  }

  // 4. Mobility after move - how many cells can we reach from here?
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }
  blocked |= CELL_MASKS[posToIndex(playerPos.r, playerPos.c)];
  blocked |= CELL_MASKS[posToIndex(aiPos.r, aiPos.c)];

  const movesFromNewPos = popCount(getQueenMoves(move, blocked));
  score += movesFromNewPos * OPENING_PRINCIPLES.MOBILITY_WEIGHT;

  // 5. Opponent restriction potential - can we cut off opponent's territory?
  const tempBoard: BoardState = {
    ...board,
    aiPos: move
  };
  const opponentMovesAfter = getValidMoves(tempBoard, playerPos, true);
  score += (20 - opponentMovesAfter.length) * OPENING_PRINCIPLES.OPPONENT_RESTRICTION_WEIGHT * 0.3;

  // 6. Maintain strategic distance from opponent in early game
  const distToOpponent = Math.abs(move.r - playerPos.r) + Math.abs(move.c - playerPos.c);

  if (turnCount <= 6) {
    // Early opening - maintain some distance
    if (distToOpponent < 2) {
      score -= 10; // Too close
    } else if (distToOpponent >= 3 && distToOpponent <= 5) {
      score += 5; // Good strategic distance
    }
  } else {
    // Mid-opening - start being more aggressive
    if (distToOpponent <= 4) {
      score += 3;
    }
  }

  // 7. Prefer diagonal moves (more flexible positions)
  const isDiagonal = move.r !== aiPos.r && move.c !== aiPos.c;
  if (isDiagonal) {
    score += 3;
  }

  // 8. Control of diagonal lines (powerful in queen movement games)
  const onMainDiagonal = move.r === move.c;
  const onAntiDiagonal = move.r + move.c === 6;
  if (onMainDiagonal || onAntiDiagonal) {
    score += 5;
  }

  return score;
}

/**
 * Find best destroy position for opening
 */
function findBestOpeningDestroy(
  board: BoardState,
  newPos: { r: number; c: number }
): { r: number; c: number } {
  const { playerPos, aiPos, destroyed } = board;

  const tempBoard: BoardState = {
    ...board,
    aiPos: newPos
  };

  const destroyPositions = getValidDestroyPositions(tempBoard, newPos, false);
  if (destroyPositions.length === 0) {
    // Fallback - this shouldn't happen
    return { r: 0, c: 0 };
  }

  // Score each destroy position
  const scoredDestroys = destroyPositions.map(pos => {
    let score = 0;

    // 1. Adjacent to opponent is high priority
    const distToPlayer = Math.abs(pos.r - playerPos.r) + Math.abs(pos.c - playerPos.c);
    if (distToPlayer === 1) {
      score += 50;
    } else if (distToPlayer === 2) {
      score += 25;
    }

    // 2. Between opponent and center
    const playerToCenter = Math.abs(playerPos.r - CENTER.r) + Math.abs(playerPos.c - CENTER.c);
    const posToCenter = Math.abs(pos.r - CENTER.r) + Math.abs(pos.c - CENTER.c);
    const posToPlayer = distToPlayer;

    if (posToCenter < playerToCenter && posToPlayer <= 3) {
      score += 30; // Cutting off opponent from center
    }

    // 3. Restrict opponent's path
    const opponentMoves = getValidMoves(tempBoard, playerPos, true);
    if (opponentMoves.some(m => m.r === pos.r && m.c === pos.c)) {
      score += 35; // Destroys one of opponent's valid moves
    }

    // 4. Don't destroy our own valuable cells
    const aiMoves = getValidMoves(tempBoard, newPos, false);
    if (aiMoves.some(m => m.r === pos.r && m.c === pos.c)) {
      score -= 20;
    }

    // 5. Don't destroy center cells in early game
    if (CENTER_CELLS.some(c => c.r === pos.r && c.c === pos.c)) {
      // Only penalize if we might want to go there
      const aiToPos = Math.abs(pos.r - newPos.r) + Math.abs(pos.c - newPos.c);
      if (aiToPos <= 2) {
        score -= 15;
      }
    }

    // 6. Prefer destroying edge/corner cells (less valuable)
    const isEdge = pos.r === 0 || pos.r === 6 || pos.c === 0 || pos.c === 6;
    const isCorner = (pos.r === 0 || pos.r === 6) && (pos.c === 0 || pos.c === 6);
    if (isCorner) {
      score += 5;
    } else if (isEdge) {
      score += 2;
    }

    return { pos, score };
  });

  // Sort and return best
  scoredDestroys.sort((a, b) => b.score - a.score);
  return scoredDestroys[0].pos;
}

/**
 * Check if we're still in opening phase
 */
export function isOpeningPhase(turnCount: number, destroyedCount: number): boolean {
  // Opening ends around turn 10-12 or when board gets crowded
  return turnCount <= 12 && destroyedCount <= 8;
}

/**
 * Get opening principles for a given position
 * Used by evaluation function to maintain opening strength
 */
export function getOpeningBonus(
  board: BoardState,
  turnCount: number
): number {
  if (turnCount > 12) return 0;

  const { aiPos } = board;
  let bonus = 0;

  // Center control bonus
  const distToCenter = Math.abs(aiPos.r - CENTER.r) + Math.abs(aiPos.c - CENTER.c);
  bonus += (6 - distToCenter) * 2;

  // Center area bonus
  if (CENTER_CELLS.some(c => c.r === aiPos.r && c.c === aiPos.c)) {
    bonus += 10;
  }

  // Corner penalty
  const isCorner = (aiPos.r === 0 || aiPos.r === 6) && (aiPos.c === 0 || aiPos.c === 6);
  if (isCorner) {
    bonus -= 20;
  }

  // Edge penalty
  const isEdge = aiPos.r === 0 || aiPos.r === 6 || aiPos.c === 0 || aiPos.c === 6;
  if (isEdge && !isCorner) {
    bonus -= 8;
  }

  return bonus;
}
