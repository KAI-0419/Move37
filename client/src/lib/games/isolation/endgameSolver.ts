/**
 * Endgame Solver for ISOLATION
 *
 * When the board is partitioned, the game becomes a "longest path" problem.
 * This module calculates the optimal moves to maximize the number of moves
 * before running out of space.
 *
 * Uses DFS with memoization for efficiency.
 */

import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";
import { getValidMoves, getValidDestroyPositions } from "./moveValidation";

// 8 directions for queen movement
const DIRECTIONS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },                      { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 }
];

export interface EndgameResult {
  move: GameMove | null;
  longestPath: number;      // Maximum moves possible from this position
  solved: boolean;          // True if we computed the exact answer
  confidence: 'exact' | 'heuristic'; // Whether result is exact or estimated
}

/**
 * Solve the endgame for an isolated position
 * Calculates the longest path (maximum moves) from current position
 *
 * @param board Current board state
 * @param reachableCells Set of cells that are reachable by the piece
 * @param isAI Whether solving for AI
 * @param timeLimit Maximum time in milliseconds
 */
export function solveEndgame(
  board: BoardState,
  reachableCells: Set<string>,
  isAI: boolean,
  timeLimit: number = 3000
): EndgameResult {
  const startTime = Date.now();
  const position = isAI ? board.aiPos : board.playerPos;

  // Convert reachable cells to a more efficient representation
  const reachableSet = new Set(reachableCells);

  // Add current position to reachable
  const posKey = `${position.r},${position.c}`;
  reachableSet.add(posKey);

  // Memoization cache: visited state -> longest path from that state
  const memo = new Map<string, number>();

  // Track if we timed out
  let timedOut = false;

  /**
   * DFS to find longest path from current position
   * @param r Current row
   * @param c Current column
   * @param visited Set of visited cell keys
   */
  function longestPath(r: number, c: number, visited: Set<string>): number {
    // Check timeout
    if (Date.now() - startTime > timeLimit) {
      timedOut = true;
      return 0;
    }

    // Create state key for memoization
    const stateKey = `${r},${c}|${Array.from(visited).sort().join(',')}`;
    if (memo.has(stateKey)) {
      return memo.get(stateKey)!;
    }

    let maxLength = 0;

    // Try all queen moves
    for (const dir of DIRECTIONS) {
      let nr = r + dir.dr;
      let nc = c + dir.dc;

      // Slide along direction
      while (nr >= 0 && nr < board.boardSize.rows &&
             nc >= 0 && nc < board.boardSize.cols) {

        const cellKey = `${nr},${nc}`;

        // Check if cell is reachable and not visited
        if (reachableSet.has(cellKey) && !visited.has(cellKey)) {
          // Visit this cell
          const newVisited = new Set(visited);
          newVisited.add(cellKey);

          const pathLength = 1 + longestPath(nr, nc, newVisited);
          maxLength = Math.max(maxLength, pathLength);
        } else if (!reachableSet.has(cellKey)) {
          // Blocked - can't continue in this direction
          break;
        }

        nr += dir.dr;
        nc += dir.dc;
      }
    }

    // Only cache if we didn't time out
    if (!timedOut) {
      memo.set(stateKey, maxLength);
    }

    return maxLength;
  }

  // Find the best first move
  const initialVisited = new Set<string>([posKey]);
  let bestMove: GameMove | null = null;
  let bestPath = -1;

  const validMoves = getValidMoves(board, position, !isAI);

  for (const to of validMoves) {
    if (timedOut) break;

    const cellKey = `${to.r},${to.c}`;

    // Only consider moves within our region
    if (!reachableSet.has(cellKey)) continue;

    const newVisited = new Set(initialVisited);
    newVisited.add(cellKey);

    const pathLength = 1 + longestPath(to.r, to.c, newVisited);

    if (pathLength > bestPath) {
      bestPath = pathLength;

      // Find best destroy position
      // In endgame, destroy should not affect our own path
      const destroyPos = findBestEndgameDestroy(board, to, reachableSet, isAI);

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
    solved: !timedOut,
    confidence: timedOut ? 'heuristic' : 'exact'
  };
}

/**
 * Find the best destroy position in endgame
 * Should not reduce our own path
 */
function findBestEndgameDestroy(
  board: BoardState,
  newPos: { r: number; c: number },
  reachableCells: Set<string>,
  isAI: boolean
): { r: number; c: number } {
  const position = isAI ? board.aiPos : board.playerPos;
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
        const cellKey = `${r},${c}`;
        if (!board.destroyed.some(d => d.r === r && d.c === c) &&
            !(r === newPos.r && c === newPos.c) &&
            !(r === otherPos.r && c === otherPos.c)) {
          return { r, c };
        }
      }
    }
    return { r: 0, c: 0 }; // Should not happen
  }

  // Best destroy: one that's NOT in our reachable cells
  // This preserves our maximum path length
  let bestDestroy = destroyPositions[0];
  let bestScore = -Infinity;

  for (const pos of destroyPositions) {
    const cellKey = `${pos.r},${pos.c}`;
    let score = 0;

    // Prefer destroying cells outside our region
    if (!reachableCells.has(cellKey)) {
      score += 100;
    }

    // Prefer destroying cells far from our new position
    const dist = Math.abs(pos.r - newPos.r) + Math.abs(pos.c - newPos.c);
    score += dist * 2;

    // Prefer destroying cells in opponent's potential region
    // (cells closer to opponent)
    const opponentDist = Math.abs(pos.r - otherPos.r) + Math.abs(pos.c - otherPos.c);
    score += (10 - opponentDist);

    if (score > bestScore) {
      bestScore = score;
      bestDestroy = pos;
    }
  }

  return bestDestroy;
}

/**
 * Quick estimate of longest path using greedy heuristic
 * Used when exact calculation would take too long
 */
export function estimateLongestPath(
  board: BoardState,
  reachableCells: Set<string>,
  isAI: boolean
): number {
  // Simple heuristic: count reachable cells
  // More accurate heuristic could consider board shape
  return reachableCells.size;
}

/**
 * Determine if position is worth solving exactly
 * Small regions can be solved exactly, large ones need heuristics
 */
export function shouldSolveExactly(reachableCells: Set<string>): boolean {
  // For regions up to ~15 cells, we can solve exactly within time limit
  // This threshold is based on empirical testing
  return reachableCells.size <= 15;
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

  // Quick estimate based on region sizes
  if (!shouldSolveExactly(playerRegion) || !shouldSolveExactly(aiRegion)) {
    // Use cell count as proxy for moves remaining
    return aiCells - playerCells;
  }

  // Solve exactly for both
  const halfTime = Math.floor(timeLimit / 2);

  const playerResult = solveEndgame(board, playerRegion, false, halfTime);
  const aiResult = solveEndgame(board, aiRegion, true, halfTime);

  if (playerResult.confidence === 'exact' && aiResult.confidence === 'exact') {
    // Exact calculation
    return aiResult.longestPath - playerResult.longestPath;
  }

  // Fallback to cell count
  return aiCells - playerCells;
}
