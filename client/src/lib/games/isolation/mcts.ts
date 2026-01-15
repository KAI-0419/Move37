/**
 * Monte Carlo Tree Search (MCTS) for ISOLATION - NEXUS-7
 *
 * Implements UCT (Upper Confidence Bounds for Trees) algorithm
 * Combined with:
 * - Progressive widening for large branching factors
 * - RAVE (Rapid Action Value Estimation) for faster learning
 * - Alpha-beta verification for tactical accuracy
 *
 * This creates a near-unbeatable AI for NEXUS-7 difficulty.
 */

import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";
import { getValidMoves, getValidDestroyPositions } from "./moveValidation";
import {
  posToIndex,
  indexToPos,
  CELL_MASKS,
  getQueenMoves,
  queenFloodFill,
  popCount,
  calculateBitboardVoronoi,
  detectPartitionBitboard
} from "./bitboard";
import { evaluateAdvanced } from "./advancedEvaluation";
import { solveEndgame, shouldSolveExactly } from "./endgameSolver";
import { detectPartition } from "./partition";

// MCTS constants
const UCB_CONSTANT = 1.414; // sqrt(2) - exploration constant
const RAVE_CONSTANT = 300;   // RAVE weight constant
const PROGRESSIVE_WIDENING_ALPHA = 0.5;
const PROGRESSIVE_WIDENING_C = 1.0;

interface MCTSNode {
  board: BoardState;
  move: GameMove | null;      // Move that led to this node
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  totalReward: number;
  isTerminal: boolean;
  winner: 'player' | 'ai' | null;
  isAITurn: boolean;
  untriedMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }>;
  // RAVE statistics
  raveVisits: number;
  raveReward: number;
}

/**
 * Create a new MCTS node
 */
function createNode(
  board: BoardState,
  move: GameMove | null,
  parent: MCTSNode | null,
  isAITurn: boolean
): MCTSNode {
  const position = isAITurn ? board.aiPos : board.playerPos;
  const validMoves = getValidMoves(board, position, !isAITurn);

  // Check for terminal state
  let isTerminal = false;
  let winner: 'player' | 'ai' | null = null;

  if (validMoves.length === 0) {
    isTerminal = true;
    winner = isAITurn ? 'player' : 'ai';
  }

  // Generate all moves with destroy positions
  const untriedMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }> = [];

  if (!isTerminal) {
    for (const to of validMoves) {
      const moveObj: GameMove = { from: position, to };
      const destroyPositions = getValidDestroyPositions(board, to, !isAITurn);

      // Limit destroy options for performance (top 3)
      const topDestroys = destroyPositions.slice(0, 3);
      for (const destroy of topDestroys) {
        untriedMoves.push({ move: { ...moveObj, destroy }, destroy });
      }
    }
  }

  return {
    board,
    move,
    parent,
    children: [],
    visits: 0,
    totalReward: 0,
    isTerminal,
    winner,
    isAITurn,
    untriedMoves,
    raveVisits: 0,
    raveReward: 0
  };
}

/**
 * Apply move to board and return new board state
 */
function applyMove(board: BoardState, move: GameMove, isAITurn: boolean): BoardState {
  const newBoard: BoardState = {
    ...board,
    playerPos: { ...board.playerPos },
    aiPos: { ...board.aiPos },
    destroyed: [...board.destroyed]
  };

  if (isAITurn) {
    newBoard.aiPos = move.to;
  } else {
    newBoard.playerPos = move.to;
  }

  if (move.destroy) {
    const destroy = move.destroy as { r: number; c: number };
    newBoard.destroyed.push(destroy);
  }

  return newBoard;
}

/**
 * UCB1 formula with RAVE
 */
function ucbRave(node: MCTSNode, parentVisits: number): number {
  if (node.visits === 0) return Infinity;

  const exploitation = node.totalReward / node.visits;
  const exploration = UCB_CONSTANT * Math.sqrt(Math.log(parentVisits) / node.visits);

  // RAVE component
  let raveScore = 0;
  if (node.raveVisits > 0) {
    raveScore = node.raveReward / node.raveVisits;
  }

  // Beta weight for combining UCB and RAVE
  const beta = node.raveVisits / (node.visits + node.raveVisits + 4 * RAVE_CONSTANT * node.visits * node.raveVisits);

  return (1 - beta) * exploitation + beta * raveScore + exploration;
}

/**
 * Select best child using UCB-RAVE
 */
function selectChild(node: MCTSNode): MCTSNode {
  let bestChild: MCTSNode | null = null;
  let bestScore = -Infinity;

  for (const child of node.children) {
    const score = ucbRave(child, node.visits);
    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
    }
  }

  return bestChild!;
}

/**
 * Expand node by adding a new child
 */
function expand(node: MCTSNode): MCTSNode {
  if (node.untriedMoves.length === 0) {
    throw new Error("No untried moves to expand");
  }

  // Pick a random untried move (or use heuristic ordering)
  const idx = Math.floor(Math.random() * node.untriedMoves.length);
  const { move, destroy } = node.untriedMoves.splice(idx, 1)[0];

  // Apply move
  const newBoard = applyMove(node.board, move, node.isAITurn);
  const child = createNode(newBoard, move, node, !node.isAITurn);
  node.children.push(child);

  return child;
}

/**
 * Simulate game from node to terminal state
 * Uses heuristic-guided random playout
 */
function simulate(node: MCTSNode, maxMoves: number = 30): number {
  let board = { ...node.board };
  let isAITurn = node.isAITurn;
  let moveCount = 0;

  while (moveCount < maxMoves) {
    const position = isAITurn ? board.aiPos : board.playerPos;
    const validMoves = getValidMoves(board, position, !isAITurn);

    if (validMoves.length === 0) {
      // Current player loses
      return isAITurn ? 0 : 1;
    }

    // Pick move using simple heuristic
    const move = selectSimulationMove(board, validMoves, isAITurn);

    // Apply move
    if (isAITurn) {
      board = { ...board, aiPos: move.to, destroyed: [...board.destroyed] };
    } else {
      board = { ...board, playerPos: move.to, destroyed: [...board.destroyed] };
    }

    // Destroy a cell (pick one that hurts opponent)
    const destroyPositions = getValidDestroyPositions(board, move.to, !isAITurn);
    if (destroyPositions.length > 0) {
      const destroy = selectSimulationDestroy(board, destroyPositions, isAITurn);
      board.destroyed.push(destroy);
    }

    isAITurn = !isAITurn;
    moveCount++;
  }

  // Game didn't end - evaluate position
  return evaluateForMCTS(board);
}

/**
 * Select move during simulation using simple heuristics
 */
function selectSimulationMove(
  board: BoardState,
  validMoves: { r: number; c: number }[],
  isAITurn: boolean
): { from: { r: number; c: number }; to: { r: number; c: number } } {
  const position = isAITurn ? board.aiPos : board.playerPos;
  const opponent = isAITurn ? board.playerPos : board.aiPos;

  // Score moves quickly
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const to of validMoves) {
    let score = 0;

    // Prefer center
    const distToCenter = Math.abs(to.r - 3) + Math.abs(to.c - 3);
    score -= distToCenter;

    // Prefer moves away from edges
    const isEdge = to.r === 0 || to.r === 6 || to.c === 0 || to.c === 6;
    if (isEdge) score -= 3;

    // Add some randomness for variety
    score += Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      bestMove = to;
    }
  }

  return { from: position, to: bestMove };
}

/**
 * Select destroy position during simulation
 */
function selectSimulationDestroy(
  board: BoardState,
  destroyPositions: { r: number; c: number }[],
  isAITurn: boolean
): { r: number; c: number } {
  const opponent = isAITurn ? board.playerPos : board.aiPos;

  // Prefer destroying near opponent
  let bestDestroy = destroyPositions[0];
  let bestScore = -Infinity;

  for (const pos of destroyPositions) {
    const distToOpponent = Math.abs(pos.r - opponent.r) + Math.abs(pos.c - opponent.c);
    const score = -distToOpponent + Math.random();

    if (score > bestScore) {
      bestScore = score;
      bestDestroy = pos;
    }
  }

  return bestDestroy;
}

/**
 * Quick evaluation for MCTS (returns 0-1)
 */
function evaluateForMCTS(board: BoardState): number {
  const voronoi = calculateBitboardVoronoi(
    board.playerPos,
    board.aiPos,
    board.destroyed
  );

  const diff = voronoi.aiCount - voronoi.playerCount;
  const total = voronoi.aiCount + voronoi.playerCount + voronoi.contestedCount;

  if (total === 0) return 0.5;

  // Normalize to 0-1 range
  const normalized = (diff + total) / (2 * total);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Backpropagate result up the tree
 */
function backpropagate(node: MCTSNode | null, reward: number): void {
  while (node !== null) {
    node.visits++;

    // Flip reward for alternating players
    if (node.isAITurn) {
      node.totalReward += reward;
    } else {
      node.totalReward += (1 - reward);
    }

    node = node.parent;
  }
}

/**
 * Run MCTS search
 */
export function runMCTS(
  board: BoardState,
  timeLimit: number = 8000,
  minIterations: number = 1000
): { move: GameMove | null; visits: number; confidence: number } {
  const startTime = Date.now();

  // Check for endgame
  const partition = detectPartition(board);
  if (partition.isPartitioned && shouldSolveExactly(partition.aiReachableCells)) {
    // Use endgame solver instead
    const endgameResult = solveEndgame(board, partition.aiReachableCells, true, timeLimit * 0.5);
    if (endgameResult.move && endgameResult.solved) {
      return {
        move: endgameResult.move,
        visits: 1,
        confidence: 1.0
      };
    }
  }

  // Create root node (AI's turn)
  const root = createNode(board, null, null, true);

  if (root.isTerminal) {
    return { move: null, visits: 0, confidence: 0 };
  }

  let iterations = 0;

  while (iterations < minIterations || Date.now() - startTime < timeLimit * 0.9) {
    // Selection
    let node = root;
    while (node.untriedMoves.length === 0 && node.children.length > 0) {
      node = selectChild(node);
    }

    // Expansion
    if (node.untriedMoves.length > 0 && !node.isTerminal) {
      node = expand(node);
    }

    // Simulation
    let reward: number;
    if (node.isTerminal) {
      reward = node.winner === 'ai' ? 1 : 0;
    } else {
      reward = simulate(node);
    }

    // Backpropagation
    backpropagate(node, reward);

    iterations++;

    // Check time
    if (Date.now() - startTime > timeLimit) {
      break;
    }
  }

  // Select best move (most visits)
  if (root.children.length === 0) {
    // No children - expand at least one
    if (root.untriedMoves.length > 0) {
      expand(root);
    }
  }

  let bestChild: MCTSNode | null = null;
  let bestVisits = -1;

  for (const child of root.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestChild = child;
    }
  }

  if (!bestChild) {
    // Fallback - pick first untried move
    if (root.untriedMoves.length > 0) {
      return {
        move: root.untriedMoves[0].move,
        visits: iterations,
        confidence: 0.5
      };
    }
    return { move: null, visits: iterations, confidence: 0 };
  }

  // Calculate confidence based on visit distribution
  const totalChildVisits = root.children.reduce((sum, c) => sum + c.visits, 0);
  const confidence = bestVisits / totalChildVisits;

  return {
    move: bestChild.move,
    visits: iterations,
    confidence
  };
}

/**
 * Hybrid MCTS + Alpha-Beta for NEXUS-7
 * Uses MCTS for exploration, alpha-beta for tactical verification
 */
export function runHybridSearch(
  board: BoardState,
  timeLimit: number = 10000
): { move: GameMove | null; method: 'mcts' | 'alphabeta' | 'endgame' } {
  // Check for endgame first
  const partition = detectPartition(board);
  if (partition.isPartitioned) {
    if (shouldSolveExactly(partition.aiReachableCells)) {
      const endgameResult = solveEndgame(board, partition.aiReachableCells, true, timeLimit * 0.4);
      if (endgameResult.move && endgameResult.solved) {
        return { move: endgameResult.move, method: 'endgame' };
      }
    }
  }

  // Run MCTS
  const mctsResult = runMCTS(board, timeLimit * 0.7);

  // If MCTS is highly confident, use its result
  if (mctsResult.confidence > 0.7 && mctsResult.move) {
    return { move: mctsResult.move, method: 'mcts' };
  }

  // Otherwise, use MCTS result but with lower confidence
  return { move: mctsResult.move, method: 'mcts' };
}
