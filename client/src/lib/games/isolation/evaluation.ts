/**
 * ISOLATION AI Evaluation Functions - Ultra-Enhanced Version
 *
 * Implements a powerful multi-level AI using:
 * - Opening book for first 8 moves
 * - Advanced bitboard-based evaluation
 * - Voronoi territory analysis
 * - Partition detection with queen-movement
 * - Transposition table with Zobrist hashing
 * - Enhanced move ordering (killer moves, history heuristic)
 * - Endgame solver with bitboards
 * - MCTS for NEXUS-7
 * - Difficulty-based configuration
 */

import type { BoardState } from "./types";
import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";
import { getValidMoves, getValidDestroyPositions } from "./moveValidation";
import { parseBoardState, generateBoardString, isValidPosition, isDestroyed, isOccupied } from "./boardUtils";
import { posToIndex, CELL_MASKS, popCount, getQueenMoves, queenFloodFill, calculateBitboardVoronoi } from "./bitboard";
import { detectPartition } from "./partition";
import { TranspositionTable, getTranspositionTable, updateHashAfterMove, type TTFlag } from "./transposition";
import { getDifficultyConfig, selectMoveIndex, type Difficulty, type DifficultyConfig } from "./difficultyConfig";
import { solveEndgame, calculateEndgameAdvantage, shouldSolveExactly } from "./endgameSolver";
import { evaluateAdvanced, evaluateBasic, evaluateOpening, evaluateTerminal } from "./advancedEvaluation";
import { getOpeningMove, isOpeningPhase, getOpeningBonus } from "./openingBook";
import { runMCTS, runHybridSearch } from "./mcts";

// History heuristic table: from -> to -> score
const historyTable: number[][] = Array(49).fill(null).map(() => Array(49).fill(0));

// Killer moves per depth level
interface KillerMoves {
  primary: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null;
  secondary: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null;
}
const killerMoves: KillerMoves[] = Array(20).fill(null).map(() => ({
  primary: null,
  secondary: null
}));

/**
 * Main evaluation function - routes to appropriate evaluation based on difficulty
 */
function evaluateBoard(board: BoardState, config: DifficultyConfig, turnCount?: number): number {
  // Check for terminal state
  const terminal = evaluateTerminal(board, 0, config.maxDepth);
  if (terminal !== null) return terminal;

  // Use opening bonus in early game
  if (turnCount !== undefined && turnCount <= 12) {
    const openingBonus = getOpeningBonus(board, turnCount);

    if (config.useVoronoi) {
      const result = evaluateAdvanced(board, config.weights);
      return result.score + openingBonus;
    } else {
      return evaluateBasic(board) + openingBonus;
    }
  }

  // Standard evaluation
  if (config.useVoronoi) {
    const result = evaluateAdvanced(board, config.weights);
    return result.score;
  }

  return evaluateBasic(board);
}

/**
 * Apply a move to the board state
 */
function applyMove(board: BoardState, move: GameMove, isPlayer: boolean): BoardState {
  const newBoard: BoardState = {
    ...board,
    playerPos: { ...board.playerPos },
    aiPos: { ...board.aiPos },
    destroyed: [...board.destroyed],
  };

  if (isPlayer) {
    newBoard.playerPos = move.to;
  } else {
    newBoard.aiPos = move.to;
  }

  if (move.destroy) {
    const destroyPos = move.destroy as { r: number; c: number };
    if (
      isValidPosition(destroyPos, newBoard.boardSize) &&
      !isDestroyed(destroyPos, newBoard.destroyed) &&
      !isOccupied(destroyPos, newBoard.playerPos, newBoard.aiPos)
    ) {
      newBoard.destroyed.push(destroyPos);
    }
  }

  return newBoard;
}

/**
 * Get all possible moves with destroy positions
 */
function getAllMoves(
  board: BoardState,
  isPlayer: boolean,
  config: DifficultyConfig
): Array<{ move: GameMove; destroy: { r: number; c: number } }> {
  const position = isPlayer ? board.playerPos : board.aiPos;
  const opponentPos = isPlayer ? board.aiPos : board.playerPos;
  const validMoves = getValidMoves(board, position, isPlayer);
  const allMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }> = [];

  for (const to of validMoves) {
    const move: GameMove = { from: position, to };
    const destroyPositions = getValidDestroyPositions(board, to, isPlayer);

    if (destroyPositions.length === 0) continue;

    // Score and rank destroy positions
    const scoredDestroys = destroyPositions.map(pos => {
      let score = 0;

      // Adjacent to opponent
      const distToOpponent = Math.abs(pos.r - opponentPos.r) + Math.abs(pos.c - opponentPos.c);
      if (distToOpponent === 1) score += 30;
      else if (distToOpponent === 2) score += 15;

      // Blocks opponent's moves
      const tempBoard = { ...board, [isPlayer ? 'playerPos' : 'aiPos']: to };
      const opponentMoves = getValidMoves(tempBoard, opponentPos, !isPlayer);
      if (opponentMoves.some(m => m.r === pos.r && m.c === pos.c)) {
        score += 25;
      }

      // Don't block our own path
      const ourMoves = getValidMoves(tempBoard, to, isPlayer);
      if (ourMoves.some(m => m.r === pos.r && m.c === pos.c)) {
        score -= 20;
      }

      // Center control
      const centerDist = Math.abs(pos.r - 3) + Math.abs(pos.c - 3);
      score += (6 - centerDist) * 0.5;

      return { pos, score };
    });

    scoredDestroys.sort((a, b) => b.score - a.score);
    const topDestroys = scoredDestroys.slice(0, config.destroyCandidateCount);

    for (const { pos } of topDestroys) {
      allMoves.push({
        move: { ...move, destroy: pos },
        destroy: pos,
      });
    }
  }

  return allMoves;
}

/**
 * Update killer moves
 */
function updateKillerMove(depth: number, move: { to: { r: number; c: number }; destroy: { r: number; c: number } }): void {
  if (depth >= killerMoves.length) return;
  const km = killerMoves[depth];
  if (!km.primary || km.primary.to.r !== move.to.r || km.primary.to.c !== move.to.c) {
    km.secondary = km.primary;
    km.primary = { to: { ...move.to }, destroy: { ...move.destroy } };
  }
}

/**
 * Update history heuristic
 */
function updateHistoryHeuristic(from: { r: number; c: number }, to: { r: number; c: number }, depth: number): void {
  const fromIdx = posToIndex(from.r, from.c);
  const toIdx = posToIndex(to.r, to.c);
  if (fromIdx < 49 && toIdx < 49) {
    historyTable[fromIdx][toIdx] += depth * depth;
  }
}

/**
 * Enhanced move ordering
 */
function orderMoves(
  moves: Array<{ move: GameMove; destroy: { r: number; c: number } }>,
  board: BoardState,
  isPlayer: boolean,
  depth: number,
  config: DifficultyConfig,
  pvMove?: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null
): Array<{ move: GameMove; destroy: { r: number; c: number }; score: number }> {
  const position = isPlayer ? board.playerPos : board.aiPos;
  const fromIdx = posToIndex(position.r, position.c);

  return moves.map(moveData => {
    let score = 0;
    const toIdx = posToIndex(moveData.move.to.r, moveData.move.to.c);

    // PV move highest priority
    if (pvMove && moveData.move.to.r === pvMove.to.r && moveData.move.to.c === pvMove.to.c) {
      score += 100000;
    }

    // Killer move bonus
    if (config.useKillerMoves && depth < killerMoves.length) {
      const km = killerMoves[depth];
      if (km.primary && moveData.move.to.r === km.primary.to.r && moveData.move.to.c === km.primary.to.c) {
        score += 9000;
      } else if (km.secondary && moveData.move.to.r === km.secondary.to.r && moveData.move.to.c === km.secondary.to.c) {
        score += 8000;
      }
    }

    // History heuristic
    if (config.useHistoryHeuristic && fromIdx < 49 && toIdx < 49) {
      score += historyTable[fromIdx][toIdx];
    }

    // Winning move detection
    const newBoard = applyMove(board, moveData.move, isPlayer);
    const opponentMoves = getValidMoves(newBoard, isPlayer ? newBoard.aiPos : newBoard.playerPos, !isPlayer);
    if (opponentMoves.length === 0) {
      score += 50000;
    }

    // Evaluation score
    const evalScore = evaluateBoard(newBoard, config);
    score += isPlayer ? -evalScore * 0.1 : evalScore * 0.1;

    return { ...moveData, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Minimax with alpha-beta pruning
 */
function minimax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  startTime: number,
  config: DifficultyConfig,
  tt: TranspositionTable | null,
  currentHash: number,
  turnCount?: number
): number {
  // Time check
  if (Date.now() - startTime > config.timeLimit * 0.85) {
    return evaluateBoard(board, config, turnCount);
  }

  // Terminal conditions
  const terminal = evaluateTerminal(board, depth, config.maxDepth);
  if (terminal !== null) return terminal;

  if (depth === 0) {
    return evaluateBoard(board, config, turnCount);
  }

  // Transposition table lookup
  let pvMove: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null = null;
  if (tt && config.useTranspositionTable) {
    const ttEntry = tt.probe(currentHash, depth, alpha, beta);
    if (ttEntry) {
      pvMove = ttEntry.bestMove;
      if (ttEntry.flag === 'EXACT') return ttEntry.score;
      if (ttEntry.flag === 'LOWER' && ttEntry.score >= beta) return ttEntry.score;
      if (ttEntry.flag === 'UPPER' && ttEntry.score <= alpha) return ttEntry.score;
    }
  }

  let moves = getAllMoves(board, !isMaximizing, config);
  if (moves.length === 0) {
    return isMaximizing ? -5000 : 5000;
  }

  // Move ordering
  const orderedMoves = orderMoves(moves, board, !isMaximizing, depth, config, pvMove);
  moves = orderedMoves.map(m => ({ move: m.move, destroy: m.destroy }));

  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMove: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null = null;
  let flag: TTFlag = isMaximizing ? 'UPPER' : 'LOWER';

  for (const { move, destroy } of moves) {
    const newBoard = applyMove(board, move, !isMaximizing);
    const newHash = tt ? updateHashAfterMove(currentHash, board, move, !isMaximizing) : 0;

    const score = minimax(newBoard, depth - 1, alpha, beta, !isMaximizing, startTime, config, tt, newHash, turnCount);

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = { to: move.to, destroy };
      }
      if (score > alpha) {
        alpha = score;
        flag = 'EXACT';
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = { to: move.to, destroy };
      }
      if (score < beta) {
        beta = score;
        flag = 'EXACT';
      }
    }

    if (beta <= alpha) {
      if (config.useKillerMoves) {
        updateKillerMove(depth, { to: move.to, destroy });
      }
      if (config.useHistoryHeuristic) {
        updateHistoryHeuristic(move.from, move.to, depth);
      }
      flag = isMaximizing ? 'LOWER' : 'UPPER';
      break;
    }
  }

  // Store in transposition table
  if (tt && config.useTranspositionTable && bestMove) {
    tt.store(currentHash, depth, bestScore, flag, bestMove);
  }

  return bestScore;
}

/**
 * Analyze player psychology
 */
function analyzePlayerPsychology(board: BoardState, playerMove: PlayerMove | null, turnCount?: number): string {
  if (!playerMove) return "gameRoom.log.isolation.initializing";

  const moveTimeSeconds = playerMove.moveTimeSeconds;
  const hoverCount = playerMove.hoverCount ?? 0;

  const dr = playerMove.to.r - playerMove.from.r;
  const dc = playerMove.to.c - playerMove.from.c;
  const moveDistance = Math.max(Math.abs(dr), Math.abs(dc));

  const aiDirR = board.aiPos.r - playerMove.from.r;
  const aiDirC = board.aiPos.c - playerMove.from.c;
  const dotProduct = dr * aiDirR + dc * aiDirC;
  const isMovingTowardsAI = dotProduct > 0;
  const isMovingAwayFromAI = dotProduct < 0;

  const hasTimeData = moveTimeSeconds !== undefined;
  const isQuickMove = hasTimeData && moveTimeSeconds <= 3.0;
  const isLongThink = hasTimeData && moveTimeSeconds >= 10.0;
  const hasHesitation = hoverCount >= 3;

  const isAggressiveMove = isMovingTowardsAI && moveDistance >= 3;
  const isDefensiveMove = isMovingAwayFromAI || moveDistance <= 2;

  const currentTurn = turnCount || 0;
  const isEarlyGame = currentTurn <= 5;
  const isMidGame = currentTurn > 5 && currentTurn <= 15;
  const isLateGame = currentTurn > 15;

  const messages: string[] = [];

  if (isLongThink && hasHesitation) {
    messages.push(
      "gameRoom.log.isolation.psychology.longHesitation1",
      "gameRoom.log.isolation.psychology.longHesitation2",
      "gameRoom.log.isolation.psychology.longHesitation3"
    );
  } else if (isQuickMove && isAggressiveMove) {
    messages.push(
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal",
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal2",
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal3"
    );
  } else if (isLongThink) {
    messages.push(
      "gameRoom.log.isolation.psychology.longThink1",
      "gameRoom.log.isolation.psychology.longThink2",
      "gameRoom.log.isolation.psychology.longThink3"
    );
  } else if (hasHesitation) {
    messages.push(
      "gameRoom.log.isolation.psychology.hesitation1",
      "gameRoom.log.isolation.psychology.hesitation2",
      "gameRoom.log.isolation.psychology.hesitation3"
    );
  } else if (isQuickMove) {
    messages.push(
      "gameRoom.log.isolation.psychology.quickMove1",
      "gameRoom.log.isolation.psychology.quickMove2",
      "gameRoom.log.isolation.psychology.quickMove3"
    );
  } else if (isAggressiveMove) {
    messages.push(
      "gameRoom.log.isolation.psychology.aggressive1",
      "gameRoom.log.isolation.psychology.aggressive2",
      "gameRoom.log.isolation.psychology.aggressive3"
    );
  } else if (isDefensiveMove) {
    messages.push(
      "gameRoom.log.isolation.psychology.defensive1",
      "gameRoom.log.isolation.psychology.defensive2",
      "gameRoom.log.isolation.psychology.defensive3"
    );
  } else if (isEarlyGame) {
    messages.push(
      "gameRoom.log.isolation.psychology.earlyBalanced1",
      "gameRoom.log.isolation.psychology.earlyBalanced2",
      "gameRoom.log.isolation.psychology.earlyBalanced3"
    );
  } else if (isMidGame) {
    messages.push(
      "gameRoom.log.isolation.psychology.midBalanced1",
      "gameRoom.log.isolation.psychology.midBalanced2",
      "gameRoom.log.isolation.psychology.midBalanced3"
    );
  } else {
    messages.push("gameRoom.log.isolation.playerBalanced");
  }

  const hash = board.destroyed.length + playerMove.from.r + playerMove.from.c + (turnCount || 0);
  return messages[hash % messages.length];
}

/**
 * Synchronous minimax search
 */
export function runMinimaxSearch(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: Difficulty = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): { move: GameMove | null; logs: string[]; depth?: number; nodesEvaluated?: number } {
  try {
    if (!board || !board.boardSize || !board.playerPos || !board.aiPos) {
      return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
    }

    const config = getDifficultyConfig(difficulty);
    const startTime = Date.now();

    // 1. Check for opening book move (NEXUS-5 and NEXUS-7)
    if (config.useOpeningBook && turnCount !== undefined && isOpeningPhase(turnCount, board.destroyed.length)) {
      const openingMove = getOpeningMove(board, turnCount);
      if (openingMove) {
        const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);
        return {
          move: {
            from: board.aiPos,
            to: openingMove.move,
            destroy: openingMove.destroy
          },
          logs: [psychologicalInsight, "gameRoom.log.isolation.strategy.openingBook"],
          depth: 0
        };
      }
    }

    // 2. Check for endgame (partitioned board)
    if (config.useEndgameSolver && config.usePartitionDetection) {
      const partition = detectPartition(board);
      if (partition.isPartitioned && shouldSolveExactly(partition.aiReachableCells)) {
        const endgameResult = solveEndgame(board, partition.aiReachableCells, true, Math.min(config.timeLimit * 0.5, 4000));
        if (endgameResult.move && endgameResult.solved) {
          const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);
          return {
            move: endgameResult.move,
            logs: [psychologicalInsight, "gameRoom.log.isolation.strategy.endgameSolved"],
            depth: endgameResult.longestPath
          };
        }
      }
    }

    // 3. Use MCTS for NEXUS-7
    if (config.useMCTS) {
      const mctsResult = runHybridSearch(board, config.timeLimit * 0.8);
      if (mctsResult.move) {
        const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);
        return {
          move: mctsResult.move,
          logs: [psychologicalInsight, `gameRoom.log.isolation.strategy.${mctsResult.method}`],
          depth: config.maxDepth
        };
      }
    }

    // 4. Standard minimax search
    const aiMoves = getValidMoves(board, board.aiPos, false);
    if (aiMoves.length === 0) {
      return { move: null, logs: ["gameRoom.log.isolation.noMoves"] };
    }

    let allMoves = getAllMoves(board, false, config);
    if (allMoves.length === 0) {
      return { move: null, logs: ["gameRoom.log.isolation.noMoves"] };
    }

    // Initialize transposition table
    const tt = config.useTranspositionTable ? getTranspositionTable(100000) : null;
    if (tt) tt.newSearch();

    // Iterative deepening
    let movesWithScores: Array<{ move: GameMove; destroy: { r: number; c: number }; score: number }> = [];
    let bestDepth = 1;
    const initialHash = tt ? tt.computeHash(board, true) : 0;

    for (let currentDepth = config.minDepth; currentDepth <= config.maxDepth; currentDepth++) {
      if (Date.now() - startTime > config.timeLimit * 0.75) break;

      const currentMovesWithScores: Array<{ move: GameMove; destroy: { r: number; c: number }; score: number }> = [];
      const orderedMoves = movesWithScores.length > 0
        ? movesWithScores.map(m => ({ move: m.move, destroy: m.destroy }))
        : allMoves;

      for (const { move, destroy } of orderedMoves) {
        const newBoard = applyMove(board, move, false);
        const newHash = tt ? updateHashAfterMove(initialHash, board, move, false) : 0;

        const score = minimax(newBoard, currentDepth - 1, -Infinity, Infinity, false, startTime, config, tt, newHash, turnCount);
        currentMovesWithScores.push({ move, destroy, score });

        if (Date.now() - startTime > config.timeLimit * 0.8) break;
      }

      currentMovesWithScores.sort((a, b) => b.score - a.score);
      const validMoves = currentMovesWithScores.filter(m => m.score > -Infinity);

      if (validMoves.length > 0) {
        movesWithScores = validMoves;
        bestDepth = currentDepth;
      }

      if (movesWithScores[0]?.score > config.earlyTerminationThreshold) break;
      if (Date.now() - startTime > config.timeLimit * 0.85) break;
    }

    // Filter and select move
    const validMovesWithScores = movesWithScores.filter(m =>
      m.score > -Infinity && m.destroy && m.destroy.r >= 0 && m.destroy.c >= 0
    );

    if (validMovesWithScores.length === 0) {
      const fallbackMoves = getAllMoves(board, false, config);
      if (fallbackMoves.length > 0 && fallbackMoves[0].destroy.r >= 0) {
        return { move: fallbackMoves[0].move, logs: ["gameRoom.log.moveExecuted"] };
      }
      return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
    }

    validMovesWithScores.sort((a, b) => b.score - a.score);

    // Select move based on difficulty (with blunder prevention)
    const scores = validMovesWithScores.map(m => m.score);
    const selectedIndex = selectMoveIndex(validMovesWithScores.length, difficulty, scores);
    const selectedMove = validMovesWithScores[selectedIndex];

    // Generate logs
    const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);
    const voronoi = calculateBitboardVoronoi(board.playerPos, board.aiPos, board.destroyed);
    const areaDiff = voronoi.aiCount - voronoi.playerCount;

    let strategicLog: string;
    if (selectedMove.score > 5000) {
      strategicLog = "gameRoom.log.isolation.strategy.winningPosition";
    } else if (areaDiff > 10) {
      strategicLog = "gameRoom.log.isolation.strategy.aiDominant";
    } else if (areaDiff > 5) {
      strategicLog = "gameRoom.log.isolation.aiAdvantage";
    } else if (areaDiff < -10) {
      strategicLog = "gameRoom.log.isolation.strategy.playerDominant";
    } else if (areaDiff < -5) {
      strategicLog = "gameRoom.log.isolation.playerAdvantage";
    } else {
      strategicLog = "gameRoom.log.isolation.balanced";
    }

    const finalMove: GameMove = { ...selectedMove.move, destroy: selectedMove.destroy };

    // Validate destroy
    if (!finalMove.destroy || finalMove.destroy.r < 0 || finalMove.destroy.c < 0) {
      const destroyPositions = getValidDestroyPositions(board, finalMove.to, false);
      if (destroyPositions.length > 0) {
        finalMove.destroy = destroyPositions[0];
      } else {
        return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
      }
    }

    return {
      move: finalMove,
      logs: [psychologicalInsight, strategicLog],
      depth: bestDepth,
    };
  } catch (error) {
    console.error("runMinimaxSearch: Fatal error", error);
    try {
      const aiMoves = getValidMoves(board, board.aiPos, false);
      if (aiMoves.length > 0) {
        const destroyPositions = getValidDestroyPositions(board, aiMoves[0], false);
        return {
          move: {
            from: board.aiPos,
            to: aiMoves[0],
            destroy: destroyPositions[0] || { r: 0, c: 0 }
          },
          logs: ["gameRoom.log.moveExecuted"],
        };
      }
    } catch (e) {
      console.error("Fallback failed:", e);
    }
    return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
  }
}

/**
 * Async AI move calculation (uses Web Worker)
 */
export async function getAIMove(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: Difficulty = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): Promise<{ move: GameMove | null; logs: string[] }> {
  const { getMinimaxWorkerPool } = await import("./minimaxWorkerPool");

  try {
    const workerPool = getMinimaxWorkerPool();
    const result = await workerPool.calculateMove(board, playerLastMove, difficulty, turnCount, boardHistory);
    return result;
  } catch (error) {
    console.warn('[getAIMove] Worker failed, falling back to synchronous:', error);
    const result = runMinimaxSearch(board, playerLastMove, difficulty, turnCount, boardHistory);
    return { move: result.move, logs: result.logs };
  }
}
