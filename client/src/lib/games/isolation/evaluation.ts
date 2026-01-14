/**
 * ISOLATION AI Evaluation Functions - Enhanced Version
 *
 * Implements a powerful AI using:
 * - Voronoi territory analysis
 * - Partition detection
 * - Transposition table with Zobrist hashing
 * - Enhanced move ordering (killer moves, history heuristic)
 * - Endgame solver for partitioned positions
 * - Difficulty-based configuration
 */

import type { BoardState } from "./types";
import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";
import {
  getValidMoves,
  getValidDestroyPositions,
} from "./moveValidation";
import {
  parseBoardState,
  generateBoardString,
  floodFill,
  isValidPosition,
  isDestroyed,
  isOccupied,
  getAdjacentPositions,
} from "./boardUtils";

// Import new modules
import { calculateVoronoi, calculateImmediateMobility } from "./voronoi";
import { detectPartition, wouldCausePartition } from "./partition";
import {
  TranspositionTable,
  getTranspositionTable,
  updateHashAfterMove,
  type TTFlag
} from "./transposition";
import {
  getDifficultyConfig,
  selectMoveIndex,
  type Difficulty,
  type DifficultyConfig
} from "./difficultyConfig";
import { solveEndgame, calculateEndgameAdvantage, shouldSolveExactly } from "./endgameSolver";

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
 * Basic evaluation function (used for NEXUS-3)
 * Simple flood-fill based evaluation
 */
function evaluateBoardBasic(board: BoardState): number {
  const playerArea = floodFill(board.playerPos, board);
  const aiArea = floodFill(board.aiPos, board);
  let score = (aiArea - playerArea) * 1.0;

  // Center control
  const centerR = board.boardSize.rows / 2;
  const centerC = board.boardSize.cols / 2;
  const aiDistToCenter = Math.abs(board.aiPos.r - centerR) + Math.abs(board.aiPos.c - centerC);
  const playerDistToCenter = Math.abs(board.playerPos.r - centerR) + Math.abs(board.playerPos.c - centerC);
  score += (playerDistToCenter - aiDistToCenter) * 0.3;

  // Isolation penalty
  if (playerArea < 10) {
    score += (10 - playerArea) * 3.0;
  }
  if (aiArea < 10) {
    score -= (10 - aiArea) * 3.0;
  }

  return score;
}

/**
 * Enhanced evaluation function (used for NEXUS-5 and NEXUS-7)
 * Uses Voronoi territory analysis and partition detection
 */
function evaluateBoardEnhanced(board: BoardState, config: DifficultyConfig): number {
  // 1. Check for partition first (most important in endgame)
  if (config.usePartitionDetection) {
    const partition = detectPartition(board);

    if (partition.isPartitioned) {
      // Partitioned game: region size determines winner
      const diff = partition.aiRegionSize - partition.playerRegionSize;

      // If endgame solver is enabled and regions are small, solve exactly
      if (config.useEndgameSolver &&
          shouldSolveExactly(partition.playerReachableCells) &&
          shouldSolveExactly(partition.aiReachableCells)) {

        const advantage = calculateEndgameAdvantage(
          board,
          partition.playerReachableCells,
          partition.aiReachableCells,
          1000 // 1 second for endgame calculation
        );
        return advantage * config.weights.partitionBonus;
      }

      return diff * config.weights.partitionBonus;
    }
  }

  let score = 0;

  // 2. Voronoi territory analysis
  if (config.useVoronoi) {
    const voronoi = calculateVoronoi(board);
    const territoryDiff = voronoi.aiTerritory - voronoi.playerTerritory;
    score += territoryDiff * config.weights.voronoiTerritory;

    // Contested cells slightly favor the player who moves second (AI)
    score += voronoi.contested * 0.3;
  } else {
    // Fallback to basic flood-fill
    const playerArea = floodFill(board.playerPos, board);
    const aiArea = floodFill(board.aiPos, board);
    score += (aiArea - playerArea) * config.weights.voronoiTerritory;
  }

  // 3. Immediate mobility (number of legal moves)
  const playerMoves = calculateImmediateMobility(
    board.playerPos, board.aiPos, board.boardSize, board.destroyed
  );
  const aiMoves = calculateImmediateMobility(
    board.aiPos, board.playerPos, board.boardSize, board.destroyed
  );
  score += (aiMoves - playerMoves) * config.weights.immediateMobility;

  // 4. Center control
  const centerR = board.boardSize.rows / 2;
  const centerC = board.boardSize.cols / 2;
  const playerCenterDist = Math.abs(board.playerPos.r - centerR) + Math.abs(board.playerPos.c - centerC);
  const aiCenterDist = Math.abs(board.aiPos.r - centerR) + Math.abs(board.aiPos.c - centerC);
  score += (playerCenterDist - aiCenterDist) * config.weights.centerControl;

  // 5. Wall proximity penalty
  const playerWallPenalty = calculateWallProximity(board.playerPos, board.boardSize);
  const aiWallPenalty = calculateWallProximity(board.aiPos, board.boardSize);
  score += (playerWallPenalty - aiWallPenalty) * config.weights.wallPenalty;

  // 6. Isolation penalty when area is very small
  const playerArea = floodFill(board.playerPos, board);
  const aiArea = floodFill(board.aiPos, board);

  if (playerArea < 8) {
    score += (8 - playerArea) * config.weights.isolationPenalty;
  }
  if (aiArea < 8) {
    score -= (8 - aiArea) * config.weights.isolationPenalty;
  }

  return score;
}

/**
 * Calculate wall proximity penalty
 */
function calculateWallProximity(
  pos: { r: number; c: number },
  boardSize: { rows: number; cols: number }
): number {
  const distToWall = Math.min(
    pos.r,
    pos.c,
    boardSize.rows - 1 - pos.r,
    boardSize.cols - 1 - pos.c
  );
  // Penalty for being within 2 cells of wall
  return Math.max(0, 2 - distToWall);
}

/**
 * Choose evaluation function based on difficulty
 */
function evaluateBoard(board: BoardState, config: DifficultyConfig): number {
  if (config.useVoronoi || config.usePartitionDetection) {
    return evaluateBoardEnhanced(board, config);
  }
  return evaluateBoardBasic(board);
}

/**
 * Apply a move to the board state (returns new board state)
 */
function applyMove(
  board: BoardState,
  move: GameMove,
  isPlayer: boolean
): BoardState {
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

    if (destroyPositions.length === 0) {
      continue;
    }

    // Evaluate and rank destroy positions
    const tempBoardAfterMove: BoardState = {
      ...board,
      [isPlayer ? 'playerPos' : 'aiPos']: to,
    };

    const opponentNextMoves = getValidMoves(tempBoardAfterMove, opponentPos, !isPlayer);
    const opponentCurrentArea = floodFill(opponentPos, board);

    const destroyCandidates = destroyPositions.map(pos => {
      let score = 0;

      // Priority 1: Adjacent to opponent
      const distToOpponent = Math.abs(pos.r - opponentPos.r) + Math.abs(pos.c - opponentPos.c);
      if (distToOpponent === 1) {
        score += 25;
      } else if (distToOpponent === 2) {
        score += 10;
      }

      // Priority 2: Blocks opponent's next moves
      if (opponentNextMoves.some(m => m.r === pos.r && m.c === pos.c)) {
        score += 20;
      }

      // Priority 3: Center control
      const centerR = board.boardSize.rows / 2;
      const centerC = board.boardSize.cols / 2;
      const distToCenter = Math.abs(pos.r - centerR) + Math.abs(pos.c - centerC);
      score += (5 - distToCenter) * 0.5;

      // Priority 4: Area reduction
      const tempBoardWithDestroy: BoardState = {
        ...tempBoardAfterMove,
        destroyed: [...tempBoardAfterMove.destroyed, pos],
      };
      const opponentAreaAfterDestroy = floodFill(opponentPos, tempBoardWithDestroy);
      const areaReduction = opponentCurrentArea - opponentAreaAfterDestroy;
      score += areaReduction * 4;

      // Priority 5: Don't block our own path
      const ourNextMoves = getValidMoves(tempBoardAfterMove, to, isPlayer);
      if (ourNextMoves.some(m => m.r === pos.r && m.c === pos.c)) {
        score -= 15;
      }

      // Bonus: Would cause advantageous partition (for higher difficulties)
      if (config.usePartitionDetection) {
        if (wouldCausePartition(tempBoardAfterMove, pos)) {
          const tempPartition = detectPartition({
            ...tempBoardAfterMove,
            destroyed: [...tempBoardAfterMove.destroyed, pos]
          });
          if (!isPlayer && tempPartition.aiRegionSize > tempPartition.playerRegionSize) {
            score += 50; // AI wants advantageous partition
          } else if (isPlayer && tempPartition.playerRegionSize > tempPartition.aiRegionSize) {
            score += 50; // Player wants advantageous partition
          }
        }
      }

      return { pos, score };
    });

    destroyCandidates.sort((a, b) => b.score - a.score);
    const topDestroys = destroyCandidates.slice(0, config.destroyCandidateCount);

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
 * Update killer moves at a given depth
 */
function updateKillerMove(
  depth: number,
  move: { to: { r: number; c: number }; destroy: { r: number; c: number } }
): void {
  if (depth >= killerMoves.length) return;

  const km = killerMoves[depth];
  if (!km.primary ||
      km.primary.to.r !== move.to.r ||
      km.primary.to.c !== move.to.c) {
    km.secondary = km.primary;
    km.primary = { to: { ...move.to }, destroy: { ...move.destroy } };
  }
}

/**
 * Update history heuristic
 */
function updateHistoryHeuristic(
  from: { r: number; c: number },
  to: { r: number; c: number },
  depth: number,
  boardSize: { rows: number; cols: number }
): void {
  const fromIdx = from.r * boardSize.cols + from.c;
  const toIdx = to.r * boardSize.cols + to.c;
  if (fromIdx < 49 && toIdx < 49) {
    historyTable[fromIdx][toIdx] += depth * depth;
  }
}

/**
 * Enhanced move ordering
 */
function orderMovesEnhanced(
  moves: Array<{ move: GameMove; destroy: { r: number; c: number } }>,
  board: BoardState,
  isPlayer: boolean,
  depth: number,
  config: DifficultyConfig,
  pvMove?: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null
): Array<{ move: GameMove; destroy: { r: number; c: number }; score: number }> {

  const position = isPlayer ? board.playerPos : board.aiPos;
  const fromIdx = position.r * board.boardSize.cols + position.c;

  return moves.map(moveData => {
    let score = 0;
    const toIdx = moveData.move.to.r * board.boardSize.cols + moveData.move.to.c;

    // PV move gets highest priority
    if (pvMove &&
        moveData.move.to.r === pvMove.to.r &&
        moveData.move.to.c === pvMove.to.c) {
      score += 100000;
    }

    // Killer move bonus
    if (config.useKillerMoves && depth < killerMoves.length) {
      const km = killerMoves[depth];
      if (km.primary &&
          moveData.move.to.r === km.primary.to.r &&
          moveData.move.to.c === km.primary.to.c) {
        score += 9000;
      } else if (km.secondary &&
                 moveData.move.to.r === km.secondary.to.r &&
                 moveData.move.to.c === km.secondary.to.c) {
        score += 8000;
      }
    }

    // History heuristic
    if (config.useHistoryHeuristic && fromIdx < 49 && toIdx < 49) {
      score += historyTable[fromIdx][toIdx];
    }

    // Winning move detection
    const newBoard = applyMove(board, moveData.move, isPlayer);
    const opponentMoves = getValidMoves(
      newBoard,
      isPlayer ? newBoard.aiPos : newBoard.playerPos,
      !isPlayer
    );
    if (opponentMoves.length === 0) {
      score += 50000; // Winning move
    }

    // Basic evaluation score
    const evalScore = evaluateBoard(newBoard, config);
    score += isPlayer ? -evalScore * 0.1 : evalScore * 0.1;

    return { ...moveData, score };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Minimax with alpha-beta pruning and transposition table
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
  currentHash: number
): number {
  // Time check
  if (Date.now() - startTime > config.timeLimit * 0.85) {
    return evaluateBoard(board, config);
  }

  // Terminal conditions
  const playerMoves = getValidMoves(board, board.playerPos, true);
  const aiMoves = getValidMoves(board, board.aiPos, false);

  if (playerMoves.length === 0) {
    return 10000 - (config.maxDepth - depth); // AI wins (depth bonus for faster win)
  }
  if (aiMoves.length === 0) {
    return -10000 + (config.maxDepth - depth); // Player wins
  }

  if (depth === 0) {
    return evaluateBoard(board, config);
  }

  // Transposition table lookup
  let pvMove: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null = null;

  if (tt && config.useTranspositionTable) {
    const ttEntry = tt.probe(currentHash, depth, alpha, beta);
    if (ttEntry) {
      pvMove = ttEntry.bestMove;

      // Use cached score if depth is sufficient and bounds allow
      if (ttEntry.flag === 'EXACT') {
        return ttEntry.score;
      } else if (ttEntry.flag === 'LOWER' && ttEntry.score >= beta) {
        return ttEntry.score;
      } else if (ttEntry.flag === 'UPPER' && ttEntry.score <= alpha) {
        return ttEntry.score;
      }
    }
  }

  let moves = getAllMoves(board, !isMaximizing, config);
  if (moves.length === 0) {
    return isMaximizing ? -5000 : 5000;
  }

  // Move ordering
  const orderedMoves = orderMovesEnhanced(moves, board, !isMaximizing, depth, config, pvMove);
  moves = orderedMoves.map(m => ({ move: m.move, destroy: m.destroy }));

  let bestScore = isMaximizing ? -Infinity : Infinity;
  let bestMove: { to: { r: number; c: number }; destroy: { r: number; c: number } } | null = null;
  let flag: TTFlag = isMaximizing ? 'UPPER' : 'LOWER';

  for (const { move, destroy } of moves) {
    const newBoard = applyMove(board, move, !isMaximizing);
    const newHash = tt ? updateHashAfterMove(currentHash, board, move, !isMaximizing) : 0;

    const score = minimax(
      newBoard,
      depth - 1,
      alpha,
      beta,
      !isMaximizing,
      startTime,
      config,
      tt,
      newHash
    );

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
      // Update killer moves and history on cutoff
      if (config.useKillerMoves) {
        updateKillerMove(depth, { to: move.to, destroy });
      }
      if (config.useHistoryHeuristic) {
        updateHistoryHeuristic(move.from, move.to, depth, board.boardSize);
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
 * Analyze player psychology based on their move
 */
function analyzePlayerPsychology(
  board: BoardState,
  playerMove: PlayerMove | null,
  turnCount?: number
): string {
  if (!playerMove) {
    return "gameRoom.log.isolation.initializing";
  }

  const moveTimeSeconds = playerMove.moveTimeSeconds;
  const hoverCount = playerMove.hoverCount ?? 0;
  const destroyPos = playerMove.destroy as { r: number; c: number } | undefined;

  // Movement metrics
  const dr = playerMove.to.r - playerMove.from.r;
  const dc = playerMove.to.c - playerMove.from.c;
  const moveDistance = Math.max(Math.abs(dr), Math.abs(dc));

  // Direction towards AI
  const aiDirR = board.aiPos.r - playerMove.from.r;
  const aiDirC = board.aiPos.c - playerMove.from.c;
  const dotProduct = dr * aiDirR + dc * aiDirC;
  const isMovingTowardsAI = dotProduct > 0;
  const isMovingAwayFromAI = dotProduct < 0;

  // Center control
  const centerR = board.boardSize.rows / 2;
  const centerC = board.boardSize.cols / 2;
  const distToCenterBefore = Math.abs(playerMove.from.r - centerR) + Math.abs(playerMove.from.c - centerC);
  const distToCenterAfter = Math.abs(playerMove.to.r - centerR) + Math.abs(playerMove.to.c - centerC);
  const isMovingToCenter = distToCenterAfter < distToCenterBefore;

  // Area control
  const playerArea = floodFill(board.playerPos, board);
  const aiArea = floodFill(board.aiPos, board);
  const areaDifference = playerArea - aiArea;

  // Time thresholds
  const hasTimeData = moveTimeSeconds !== undefined;
  const isQuickMove = hasTimeData && moveTimeSeconds <= 3.0;
  const isLongThink = hasTimeData && moveTimeSeconds >= 10.0;
  const hasHesitation = hoverCount >= 3;

  // Movement patterns
  const isShortMove = moveDistance <= 2;
  const isLongMove = moveDistance >= 4;
  const isAggressiveMove = isMovingTowardsAI && moveDistance >= 3;
  const isDefensiveMove = isMovingAwayFromAI || (isShortMove && !isMovingTowardsAI);

  // Game phase
  const currentTurn = turnCount || 0;
  const isEarlyGame = currentTurn <= 5;
  const isMidGame = currentTurn > 5 && currentTurn <= 15;
  const isLateGame = currentTurn > 15;

  // Build psychology messages
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
  } else if (isAggressiveMove && isMovingToCenter) {
    messages.push(
      "gameRoom.log.isolation.psychology.aggressiveCenter1",
      "gameRoom.log.isolation.psychology.aggressiveCenter2",
      "gameRoom.log.isolation.psychology.aggressiveCenter3"
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
  } else if (isLongMove) {
    messages.push(
      "gameRoom.log.isolation.psychology.longMove1",
      "gameRoom.log.isolation.psychology.longMove2",
      "gameRoom.log.isolation.psychology.longMove3"
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
  } else if (isLateGame) {
    messages.push(
      "gameRoom.log.isolation.psychology.lateBalanced1",
      "gameRoom.log.isolation.psychology.lateBalanced2",
      "gameRoom.log.isolation.psychology.lateBalanced3"
    );
  } else {
    messages.push("gameRoom.log.isolation.playerBalanced");
  }

  const hash = board.destroyed.length + playerMove.from.r + playerMove.from.c + (turnCount || 0);
  return messages[hash % messages.length];
}

/**
 * Synchronous minimax search (for Web Worker)
 */
export function runMinimaxSearch(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: Difficulty = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): {
  move: GameMove | null;
  logs: string[];
  depth?: number;
  nodesEvaluated?: number;
} {
  try {
    if (!board || !board.boardSize || !board.playerPos || !board.aiPos) {
      return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
    }

    if (!isValidPosition(board.aiPos, board.boardSize)) {
      return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
    }

    const config = getDifficultyConfig(difficulty);
    const startTime = Date.now();

    // Initialize transposition table
    const tt = config.useTranspositionTable ? getTranspositionTable(100000) : null;
    if (tt) {
      tt.newSearch();
    }

    // Check for partitioned endgame (NEXUS-5 and NEXUS-7)
    if (config.useEndgameSolver && config.usePartitionDetection) {
      const partition = detectPartition(board);

      if (partition.isPartitioned && shouldSolveExactly(partition.aiReachableCells)) {
        console.log(`runMinimaxSearch: Partition detected, solving endgame (AI region: ${partition.aiRegionSize})`);

        const endgameResult = solveEndgame(
          board,
          partition.aiReachableCells,
          true,
          Math.min(config.timeLimit * 0.5, 3000)
        );

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

    // Get all possible moves
    const aiMoves = getValidMoves(board, board.aiPos, false);
    if (aiMoves.length === 0) {
      return { move: null, logs: ["gameRoom.log.isolation.noMoves"] };
    }

    let allMoves = getAllMoves(board, false, config);
    if (allMoves.length === 0) {
      return { move: null, logs: ["gameRoom.log.isolation.noMoves"] };
    }

    // Iterative deepening
    let movesWithScores: Array<{
      move: GameMove;
      destroy: { r: number; c: number };
      score: number;
    }> = [];

    let bestDepth = 1;
    const initialHash = tt ? tt.computeHash(board, true) : 0;

    for (let currentDepth = config.minDepth; currentDepth <= config.maxDepth; currentDepth++) {
      if (Date.now() - startTime > config.timeLimit * 0.75) {
        break;
      }

      const currentMovesWithScores: Array<{
        move: GameMove;
        destroy: { r: number; c: number };
        score: number;
      }> = [];

      // Use previous iteration's order if available
      const orderedMoves = movesWithScores.length > 0
        ? movesWithScores.map(m => ({ move: m.move, destroy: m.destroy }))
        : allMoves;

      for (const { move, destroy } of orderedMoves) {
        const newBoard = applyMove(board, move, false);
        const newHash = tt ? updateHashAfterMove(initialHash, board, move, false) : 0;

        const score = minimax(
          newBoard,
          currentDepth - 1,
          -Infinity,
          Infinity,
          false, // AI just moved, now player's turn (minimizing)
          startTime,
          config,
          tt,
          newHash
        );

        currentMovesWithScores.push({ move, destroy, score });

        if (Date.now() - startTime > config.timeLimit * 0.8) {
          break;
        }
      }

      currentMovesWithScores.sort((a, b) => b.score - a.score);

      const validMoves = currentMovesWithScores.filter(m => m.score > -Infinity);
      if (validMoves.length > 0) {
        movesWithScores = validMoves;
        bestDepth = currentDepth;
      }

      // Early termination if winning move found
      if (movesWithScores[0]?.score > config.earlyTerminationThreshold) {
        console.log(`runMinimaxSearch: Winning move found at depth ${currentDepth}`);
        break;
      }

      if (Date.now() - startTime > config.timeLimit * 0.85) {
        break;
      }
    }

    console.log(`runMinimaxSearch: Depth ${bestDepth}, time ${Date.now() - startTime}ms, difficulty ${difficulty}`);

    // Filter valid moves
    const validMovesWithScores = movesWithScores.filter(m =>
      m.score > -Infinity &&
      m.destroy &&
      m.destroy.r >= 0 &&
      m.destroy.c >= 0
    );

    if (validMovesWithScores.length === 0) {
      // Fallback
      const fallbackMoves = getAllMoves(board, false, config);
      if (fallbackMoves.length > 0 && fallbackMoves[0].destroy.r >= 0) {
        return { move: fallbackMoves[0].move, logs: ["gameRoom.log.moveExecuted"] };
      }
      return { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
    }

    validMovesWithScores.sort((a, b) => b.score - a.score);

    // Select move based on difficulty
    const selectedIndex = selectMoveIndex(validMovesWithScores.length, difficulty);
    const selectedMove = validMovesWithScores[selectedIndex];

    // Generate logs
    const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);

    const playerArea = floodFill(board.playerPos, board);
    const aiArea = floodFill(board.aiPos, board);
    const areaDiff = aiArea - playerArea;

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

    const finalMove: GameMove = {
      ...selectedMove.move,
      destroy: selectedMove.destroy,
    };

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
): Promise<{
  move: GameMove | null;
  logs: string[];
}> {
  const { getMinimaxWorkerPool } = await import("./minimaxWorkerPool");

  try {
    const workerPool = getMinimaxWorkerPool();
    const result = await workerPool.calculateMove(
      board,
      playerLastMove,
      difficulty,
      turnCount,
      boardHistory
    );

    return result;
  } catch (error) {
    console.warn('[getAIMove] Worker failed, falling back to synchronous:', error);
    const result = runMinimaxSearch(board, playerLastMove, difficulty, turnCount, boardHistory);
    return { move: result.move, logs: result.logs };
  }
}
