/**
 * Endgame Solver for ISOLATION - Optimized Version
 *
 * When the board is partitioned, the game becomes a "longest path" problem.
 * This module calculates the optimal moves to maximize the number of moves
 * before running out of space.
 *
 * Uses bitboard-based DFS with alpha-beta pruning for efficiency.
 */

import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";
import { getValidMoves, getValidDestroyPositions } from "./moveValidation";
import {
  posToIndex,
  indexToPos,
  CELL_MASKS,
  getQueenMoves,
  bitboardToIndices,
  popCount,
  longestPathBitboard,
  getValidMovesFromBitboard
} from "./bitboard";

export interface EndgameResult {
  move: GameMove | null;
  longestPath: number;      // Maximum moves possible from this position
  solved: boolean;          // True if we computed the exact answer
  confidence: 'exact' | 'heuristic'; // Whether result is exact or estimated
}

/**
 * Solve the endgame for an isolated position
 * Uses bitboard-based DFS with iterative deepening
 */
export function solveEndgame(
  board: BoardState,
  reachableCells: Set<string>,
  isAI: boolean,
  timeLimit: number = 3000
): EndgameResult {
  const startTime = Date.now();
  const position = isAI ? board.aiPos : board.playerPos;
  const otherPos = isAI ? board.playerPos : board.aiPos;

  // Convert reachable cells to bitboard
  let reachableBB = 0n;
  for (const cellKey of reachableCells) {
    const [r, c] = cellKey.split(',').map(Number);
    reachableBB |= CELL_MASKS[posToIndex(r, c)];
  }

  // Add current position to reachable
  reachableBB |= CELL_MASKS[posToIndex(position.r, position.c)];

  // Create blocked bitboard (destroyed cells + other piece)
  let blocked = 0n;
  for (const d of board.destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }
  blocked |= CELL_MASKS[posToIndex(otherPos.r, otherPos.c)];

  // Find the best first move using longest path calculation
  const validMoves = getValidMoves(board, position, !isAI);
  let bestMove: GameMove | null = null;
  let bestPath = -1;
  let solved = true;

  for (const to of validMoves) {
    // Check timeout
    if (Date.now() - startTime > timeLimit * 0.8) {
      solved = false;
      break;
    }

    const cellKey = `${to.r},${to.c}`;
    const toIdx = posToIndex(to.r, to.c);

    // Only consider moves within our region
    if (!(reachableBB & CELL_MASKS[toIdx])) continue;

    // Calculate longest path from this move
    const visitedBB = CELL_MASKS[posToIndex(position.r, position.c)] | CELL_MASKS[toIdx];
    const result = longestPathFromPosition(
      to,
      reachableBB,
      blocked,
      visitedBB,
      timeLimit - (Date.now() - startTime)
    );

    const pathLength = 1 + result.length;

    if (result.timedOut) {
      solved = false;
    }

    if (pathLength > bestPath) {
      bestPath = pathLength;

      // Find best destroy position
      const destroyPos = findBestEndgameDestroy(board, to, reachableBB, isAI);

      bestMove = {
        from: position,
        to,
        destroy: destroyPos
      };
    }
  }

  return {
    move: bestMove,
    longestPath: bestPath,
    solved,
    confidence: solved ? 'exact' : 'heuristic'
  };
}

/**
 * Calculate longest path from a position using iterative DFS
 */
function longestPathFromPosition(
  startPos: { r: number; c: number },
  reachable: bigint,
  blocked: bigint,
  initialVisited: bigint,
  timeLimit: number
): { length: number; timedOut: boolean } {
  const startTime = Date.now();

  // Use iterative approach with explicit stack
  interface StackFrame {
    idx: number;
    visited: bigint;
    moveIndex: number;
    moves: number[];
    pathLength: number;
    maxSoFar: number;
  }

  const startIdx = posToIndex(startPos.r, startPos.c);
  const validCells = reachable;
  const moveBlocked = blocked | ~validCells;

  // Get initial moves from start position
  const initialMoves = getValidMovesFromBitboard(startPos, moveBlocked | initialVisited)
    .map(p => posToIndex(p.r, p.c))
    .filter(idx => (validCells & CELL_MASKS[idx]) !== 0n);

  if (initialMoves.length === 0) {
    return { length: 0, timedOut: false };
  }

  const stack: StackFrame[] = [{
    idx: startIdx,
    visited: initialVisited,
    moveIndex: 0,
    moves: initialMoves,
    pathLength: 0,
    maxSoFar: 0
  }];

  let maxLength = 0;
  let timedOut = false;

  while (stack.length > 0) {
    // Check timeout
    if (Date.now() - startTime > timeLimit) {
      timedOut = true;
      break;
    }

    const frame = stack[stack.length - 1];

    if (frame.moveIndex >= frame.moves.length) {
      // Backtrack
      maxLength = Math.max(maxLength, frame.pathLength);
      stack.pop();
      continue;
    }

    const nextIdx = frame.moves[frame.moveIndex];
    frame.moveIndex++;

    // Skip if already visited or not in valid cells
    if ((frame.visited & CELL_MASKS[nextIdx]) !== 0n) {
      continue;
    }
    if ((validCells & CELL_MASKS[nextIdx]) === 0n) {
      continue;
    }

    // Make move
    const nextPos = indexToPos(nextIdx);
    const newVisited = frame.visited | CELL_MASKS[nextIdx];

    // Get next moves
    const nextMoves = getValidMovesFromBitboard(nextPos, moveBlocked | newVisited)
      .map(p => posToIndex(p.r, p.c))
      .filter(idx => (validCells & CELL_MASKS[idx]) !== 0n && (newVisited & CELL_MASKS[idx]) === 0n);

    const newPathLength = frame.pathLength + 1;

    if (nextMoves.length === 0) {
      // Dead end - update max
      maxLength = Math.max(maxLength, newPathLength);
    } else {
      stack.push({
        idx: nextIdx,
        visited: newVisited,
        moveIndex: 0,
        moves: nextMoves,
        pathLength: newPathLength,
        maxSoFar: maxLength
      });
    }
  }

  return { length: maxLength, timedOut };
}

/**
 * Find the best destroy position in endgame
 * Prioritizes destroying cells outside our reachable region
 */
function findBestEndgameDestroy(
  board: BoardState,
  newPos: { r: number; c: number },
  reachableBB: bigint,
  isAI: boolean
): { r: number; c: number } {
  const otherPos = isAI ? board.playerPos : board.aiPos;

  // Get valid destroy positions
  const destroyPositions = getValidDestroyPositions(
    {
      ...board,
      [isAI ? 'aiPos' : 'playerPos']: newPos
    },
    newPos,
    !isAI
  );

  if (destroyPositions.length === 0) {
    // Fallback: find any destroyable cell
    for (let r = 0; r < board.boardSize.rows; r++) {
      for (let c = 0; c < board.boardSize.cols; c++) {
        if (!board.destroyed.some(d => d.r === r && d.c === c) &&
            !(r === newPos.r && c === newPos.c) &&
            !(r === otherPos.r && c === otherPos.c)) {
          return { r, c };
        }
      }
    }
    return { r: 0, c: 0 };
  }

  let bestDestroy = destroyPositions[0];
  let bestScore = -Infinity;

  for (const pos of destroyPositions) {
    const idx = posToIndex(pos.r, pos.c);
    let score = 0;

    // Strongly prefer destroying cells outside our region
    if ((reachableBB & CELL_MASKS[idx]) === 0n) {
      score += 200;
    }

    // Prefer cells far from our new position
    const dist = Math.abs(pos.r - newPos.r) + Math.abs(pos.c - newPos.c);
    score += dist * 5;

    // Prefer cells closer to opponent
    const opponentDist = Math.abs(pos.r - otherPos.r) + Math.abs(pos.c - otherPos.c);
    score += (10 - opponentDist) * 3;

    if (score > bestScore) {
      bestScore = score;
      bestDestroy = pos;
    }
  }

  return bestDestroy;
}

/**
 * Quick estimate of longest path using cell count and shape analysis
 */
export function estimateLongestPath(
  board: BoardState,
  reachableCells: Set<string>,
  isAI: boolean
): number {
  const cellCount = reachableCells.size;

  // Basic heuristic: cells * efficiency factor
  // More linear regions allow longer paths, more compact regions are worse
  const position = isAI ? board.aiPos : board.playerPos;

  // Calculate region "linearity" - longer regions allow more efficient paths
  let minR = 7, maxR = 0, minC = 7, maxC = 0;
  for (const cellKey of reachableCells) {
    const [r, c] = cellKey.split(',').map(Number);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }

  const width = maxC - minC + 1;
  const height = maxR - minR + 1;
  const area = width * height;
  const density = cellCount / area;

  // Higher density means more compact region, generally allows longer path
  // But very high density can mean trapped in corner
  const efficiencyFactor = 0.7 + (density * 0.3);

  return Math.floor(cellCount * efficiencyFactor);
}

/**
 * Determine if position is worth solving exactly
 * Based on region size and time available
 */
export function shouldSolveExactly(reachableCells: Set<string>): boolean {
  // For regions up to 18 cells, we can usually solve exactly
  // This is more aggressive than before due to bitboard optimization
  return reachableCells.size <= 18;
}

/**
 * Calculate the endgame advantage
 * Positive = AI advantage, Negative = Player advantage
 */
export function calculateEndgameAdvantage(
  board: BoardState,
  playerRegion: Set<string>,
  aiRegion: Set<string>,
  timeLimit: number = 2000
): number {
  const playerCells = playerRegion.size;
  const aiCells = aiRegion.size;

  // Quick check based on cell count difference
  const cellDiff = aiCells - playerCells;

  // If one side has significantly more cells, that's likely decisive
  if (Math.abs(cellDiff) >= 5) {
    return cellDiff * 1.5; // Weight the advantage
  }

  // For closer games, try exact calculation if regions are small enough
  if (!shouldSolveExactly(playerRegion) || !shouldSolveExactly(aiRegion)) {
    return cellDiff;
  }

  const halfTime = Math.floor(timeLimit / 2);

  const playerResult = solveEndgame(board, playerRegion, false, halfTime);
  const aiResult = solveEndgame(board, aiRegion, true, halfTime);

  if (playerResult.confidence === 'exact' && aiResult.confidence === 'exact') {
    return aiResult.longestPath - playerResult.longestPath;
  }

  // Weighted estimate if not fully solved
  const playerEstimate = playerResult.confidence === 'exact'
    ? playerResult.longestPath
    : estimateLongestPath(board, playerRegion, false);
  const aiEstimate = aiResult.confidence === 'exact'
    ? aiResult.longestPath
    : estimateLongestPath(board, aiRegion, true);

  return aiEstimate - playerEstimate;
}
