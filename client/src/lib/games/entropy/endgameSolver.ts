/**
 * Endgame Solver for ENTROPY (Hex) Game
 *
 * Uses alpha-beta minimax to perfectly solve positions when few empty cells remain.
 * This is critical for NEXUS-7 difficulty to ensure perfect play in endgames.
 *
 * Key optimizations:
 * 1. Transposition table for caching evaluated positions
 * 2. Move ordering based on connection potential
 * 3. Early termination when winner is found
 * 4. Virtual connection awareness
 */

import type { BoardState, Move, Player, CellState } from "./types";
import { cloneBoard, setCellState, getCellState } from "./boardUtils";
import { isConnected, getEmptyCells, wouldWin } from "./connectionCheck";
import { calculateShortestPath } from "./pathAnalysis";
import { detectAllBridges, getVirtualConnectionCarriers } from "./virtualConnections";

/**
 * Transposition table entry
 */
interface TranspositionEntry {
  depth: number;
  score: number;
  bestMove: Move | null;
  flag: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';
}

/**
 * Endgame solver result
 */
export interface EndgameSolverResult {
  move: Move | null;
  score: number; // Positive = AI wins, Negative = Player wins
  solved: boolean; // True if position was completely solved
  nodesEvaluated: number;
}

// Transposition table (global cache)
const transpositionTable = new Map<string, TranspositionEntry>();
const MAX_TRANSPOSITION_SIZE = 100000; // Limit memory usage

/**
 * Clear transposition table
 */
export function clearTranspositionTable(): void {
  transpositionTable.clear();
}

/**
 * Generate board hash for transposition table
 */
function getBoardHash(board: BoardState, player: Player): string {
  let hash = player;
  for (let r = 0; r < board.boardSize.rows; r++) {
    for (let c = 0; c < board.boardSize.cols; c++) {
      const cell = board.cells[r][c];
      hash += cell === 'EMPTY' ? '0' : cell === 'PLAYER' ? '1' : '2';
    }
  }
  return hash;
}

/**
 * Evaluate board position (heuristic score)
 *
 * Returns:
 * - Large positive value if AI has won
 * - Large negative value if Player has won
 * - Smaller values based on shortest path difference
 */
function evaluatePosition(board: BoardState): number {
  // Check for wins
  if (isConnected(board, 'AI')) {
    return 10000;
  }
  if (isConnected(board, 'PLAYER')) {
    return -10000;
  }

  // Calculate shortest path distances
  const aiPath = calculateShortestPath(board, 'AI');
  const playerPath = calculateShortestPath(board, 'PLAYER');

  // Score based on path advantage
  // Lower distance = better, so we want (playerPath - aiPath)
  const pathDifference = playerPath.distance - aiPath.distance;

  // Consider virtual connections
  const aiBridges = detectAllBridges(board, 'AI').length;
  const playerBridges = detectAllBridges(board, 'PLAYER').length;
  const bridgeBonus = (aiBridges - playerBridges) * 10;

  return pathDifference * 100 + bridgeBonus;
}

/**
 * Order moves for better alpha-beta pruning
 *
 * Better moves first = more pruning = faster search
 */
function orderMoves(
  board: BoardState,
  moves: Move[],
  player: Player
): Move[] {
  // Score each move
  const scoredMoves = moves.map(move => {
    let score = 0;

    // Immediate win is best
    if (wouldWin(board, move, player)) {
      score += 10000;
    }

    // Block opponent's win
    const opponent: Player = player === 'AI' ? 'PLAYER' : 'AI';
    if (wouldWin(board, move, opponent)) {
      score += 5000;
    }

    // Prefer center moves
    const { rows, cols } = board.boardSize;
    const centerR = Math.floor(rows / 2);
    const centerC = Math.floor(cols / 2);
    const distFromCenter = Math.abs(move.r - centerR) + Math.abs(move.c - centerC);
    score += 100 - distFromCenter * 5;

    // Prefer moves on player's shortest path
    const shortestPath = calculateShortestPath(board, player);
    const onPath = shortestPath.path.some(p => p.r === move.r && p.c === move.c);
    if (onPath) {
      score += 200;
    }

    // Consider virtual connection carriers (blocking bridges)
    const opponentCarriers = getVirtualConnectionCarriers(board, opponent);
    const blocksCarrier = opponentCarriers.some(c => c.r === move.r && c.c === move.c);
    if (blocksCarrier) {
      score += 150;
    }

    return { move, score };
  });

  // Sort by score (highest first)
  scoredMoves.sort((a, b) => b.score - a.score);

  return scoredMoves.map(sm => sm.move);
}

/**
 * Alpha-beta minimax with transposition table
 *
 * @param board - Current board state
 * @param depth - Remaining depth to search
 * @param alpha - Alpha bound
 * @param beta - Beta bound
 * @param maximizingPlayer - True if AI is to move
 * @param nodesEvaluated - Counter for nodes evaluated
 * @returns Score and best move
 */
function alphabeta(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  nodesEvaluated: { count: number }
): { score: number; bestMove: Move | null } {
  nodesEvaluated.count++;

  // Check transposition table
  const currentPlayer: Player = maximizingPlayer ? 'AI' : 'PLAYER';
  const hash = getBoardHash(board, currentPlayer);
  const cached = transpositionTable.get(hash);

  if (cached && cached.depth >= depth) {
    if (cached.flag === 'EXACT') {
      return { score: cached.score, bestMove: cached.bestMove };
    } else if (cached.flag === 'LOWERBOUND') {
      alpha = Math.max(alpha, cached.score);
    } else if (cached.flag === 'UPPERBOUND') {
      beta = Math.min(beta, cached.score);
    }

    if (alpha >= beta) {
      return { score: cached.score, bestMove: cached.bestMove };
    }
  }

  // Terminal node checks
  if (isConnected(board, 'AI')) {
    return { score: 10000 + depth, bestMove: null }; // Prefer faster wins
  }
  if (isConnected(board, 'PLAYER')) {
    return { score: -10000 - depth, bestMove: null }; // Prefer later losses
  }

  const emptyCells = getEmptyCells(board);

  // Depth limit or no moves
  if (depth === 0 || emptyCells.length === 0) {
    return { score: evaluatePosition(board), bestMove: null };
  }

  // Order moves for better pruning
  const orderedMoves = orderMoves(board, emptyCells, currentPlayer);

  let bestMove: Move | null = null;
  let bestScore: number;
  let flag: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';

  if (maximizingPlayer) {
    bestScore = -Infinity;
    flag = 'UPPERBOUND';

    for (const move of orderedMoves) {
      // Make move
      const newBoard = cloneBoard(board);
      setCellState(newBoard, move, 'AI');

      // Recurse
      const result = alphabeta(newBoard, depth - 1, alpha, beta, false, nodesEvaluated);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);

      if (beta <= alpha) {
        flag = 'LOWERBOUND';
        break; // Beta cutoff
      }
    }

    if (bestScore > -Infinity && bestScore < beta) {
      flag = 'EXACT';
    }
  } else {
    bestScore = Infinity;
    flag = 'LOWERBOUND';

    for (const move of orderedMoves) {
      // Make move
      const newBoard = cloneBoard(board);
      setCellState(newBoard, move, 'PLAYER');

      // Recurse
      const result = alphabeta(newBoard, depth - 1, alpha, beta, true, nodesEvaluated);

      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }

      beta = Math.min(beta, bestScore);

      if (beta <= alpha) {
        flag = 'UPPERBOUND';
        break; // Alpha cutoff
      }
    }

    if (bestScore < Infinity && bestScore > alpha) {
      flag = 'EXACT';
    }
  }

  // Store in transposition table
  if (transpositionTable.size < MAX_TRANSPOSITION_SIZE) {
    transpositionTable.set(hash, {
      depth,
      score: bestScore,
      bestMove,
      flag,
    });
  }

  return { score: bestScore, bestMove };
}

/**
 * Solve endgame position
 *
 * @param board - Current board state
 * @param maxDepth - Maximum search depth (0 = unlimited)
 * @param maxTime - Maximum time in milliseconds
 * @returns Solver result with best move
 */
export function solveEndgame(
  board: BoardState,
  maxDepth: number = 0,
  maxTime: number = 5000
): EndgameSolverResult {
  const emptyCells = getEmptyCells(board);
  const nodesEvaluated = { count: 0 };

  // Determine search depth
  // For Hex, we can solve completely with up to ~15 empty cells
  // with good move ordering and transposition table
  let depth = maxDepth > 0 ? maxDepth : Math.min(emptyCells.length, 12);

  // Check for immediate win/block
  for (const move of emptyCells) {
    if (wouldWin(board, move, 'AI')) {
      return {
        move,
        score: 10000,
        solved: true,
        nodesEvaluated: 1,
      };
    }
  }

  for (const move of emptyCells) {
    if (wouldWin(board, move, 'PLAYER')) {
      return {
        move,
        score: -5000, // Must block
        solved: true,
        nodesEvaluated: 2,
      };
    }
  }

  // Iterative deepening for better time control
  let bestResult: { score: number; bestMove: Move | null } = {
    score: 0,
    bestMove: null,
  };

  const startTime = Date.now();

  for (let d = 2; d <= depth; d += 2) {
    // Check time
    if (Date.now() - startTime > maxTime * 0.8) {
      break; // Leave time margin
    }

    const result = alphabeta(
      board,
      d,
      -Infinity,
      Infinity,
      true, // AI is maximizing
      nodesEvaluated
    );

    bestResult = result;

    // If we found a winning/losing move, stop
    if (Math.abs(result.score) >= 9000) {
      break;
    }
  }

  return {
    move: bestResult.bestMove,
    score: bestResult.score,
    solved: Math.abs(bestResult.score) >= 9000,
    nodesEvaluated: nodesEvaluated.count,
  };
}

/**
 * Check if endgame solver should be used
 *
 * @param board - Current board state
 * @param difficulty - AI difficulty level
 * @returns True if endgame solver should be used
 */
export function shouldUseEndgameSolver(
  board: BoardState,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): boolean {
  const emptyCells = getEmptyCells(board);

  // Endgame thresholds based on difficulty
  // NEXUS-3: Don't use endgame solver (intentionally weaker)
  // NEXUS-5: Use when <= 8 empty cells
  // NEXUS-7: Use when <= 15 empty cells (can solve larger positions)
  const threshold =
    difficulty === 'NEXUS-3' ? 0 :
    difficulty === 'NEXUS-5' ? 8 :
    15;

  return emptyCells.length <= threshold && emptyCells.length > 0;
}

/**
 * Get endgame solver depth based on difficulty
 */
export function getEndgameDepth(
  emptyCells: number,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): number {
  // NEXUS-3: Never uses solver
  if (difficulty === 'NEXUS-3') return 0;

  // NEXUS-5: Moderate depth
  if (difficulty === 'NEXUS-5') {
    return Math.min(emptyCells, 8);
  }

  // NEXUS-7: Maximum depth (complete solution)
  return Math.min(emptyCells, 15);
}

/**
 * Get endgame solver time limit based on difficulty
 */
export function getEndgameTimeLimit(
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): number {
  // NEXUS-3: N/A
  if (difficulty === 'NEXUS-3') return 0;

  // NEXUS-5: 2 seconds
  if (difficulty === 'NEXUS-5') return 2000;

  // NEXUS-7: 5 seconds (more time for deeper search)
  return 5000;
}
