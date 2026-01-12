/**
 * Monte Carlo Tree Search (MCTS) for ENTROPY (Hex) Game
 * 
 * Implements the MCTS algorithm with UCB1 selection policy.
 * This is essential for Hex games due to the high branching factor.
 */

import type { BoardState, Move, Player } from "./types";
import { cloneBoard, setCellState } from "./boardUtils";
import { isConnected, getEmptyCells } from "./connectionCheck";
import { getValidMoves } from "./moveValidation";
import { analyzePlayerPath, predictPlayerNextMove, calculateShortestPath } from "./pathAnalysis";
import { getNodePool, resetNodePool } from "./nodePool";

/**
 * MCTS Node structure
 */
export interface MCTSNode {
  board: BoardState;
  move: Move | null; // Move that led to this node
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: Move[];
  player: Player; // Player who made the move to reach this node
}

/**
 * AI Personality Types
 */
export type AIPersonality = 'AGGRESSIVE' | 'DEFENSIVE' | 'BALANCED' | 'ALIEN';

/**
 * MCTS Configuration with Dynamic UCB1
 */
export interface MCTSConfig {
  simulations: number; // Number of simulations to run
  ucb1Constant: number; // Base UCB1 exploration constant (default: sqrt(2))
  timeLimit?: number; // Time limit in milliseconds
  personality?: AIPersonality; // AI personality for dynamic behavior
  dynamicUCB1?: boolean; // Enable dynamic UCB1 adjustment based on game state
}

const DEFAULT_UCB1_CONSTANT = Math.sqrt(2);

/**
 * Calculate dynamic UCB1 constant based on game state and personality
 * 
 * @param baseConstant - Base UCB1 constant
 * @param winRate - Current win rate (0-1)
 * @param personality - AI personality type
 * @param threatLevel - Threat level from path analysis ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
 * @returns Adjusted UCB1 constant
 */
function calculateDynamicUCB1(
  baseConstant: number,
  winRate: number,
  personality: AIPersonality = 'BALANCED',
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): number {
  let adjustment = 1.0;
  
  // Personality-based adjustments
  switch (personality) {
    case 'AGGRESSIVE':
      // When losing, explore more aggressively (higher constant)
      // When winning, exploit more (lower constant)
      adjustment = winRate < 0.4 ? 1.5 : winRate > 0.7 ? 0.7 : 1.0;
      break;
      
    case 'DEFENSIVE':
      // When losing, exploit known good moves (lower constant)
      // When winning, maintain exploration (higher constant)
      adjustment = winRate < 0.4 ? 0.6 : winRate > 0.7 ? 1.3 : 1.0;
      break;
      
    case 'ALIEN':
      // Unpredictable: high variance in exploration
      // When losing badly, extreme exploration (gambling)
      // When winning, still explore weird moves
      if (winRate < 0.3) {
        adjustment = 2.5; // Extreme exploration when desperate
      } else if (winRate > 0.8) {
        adjustment = 1.8; // Still explore when winning (weird moves)
      } else {
        adjustment = 1.2 + Math.random() * 0.6; // Random variance
      }
      break;
      
    case 'BALANCED':
    default:
      // Standard adjustment based on win rate
      adjustment = winRate < 0.5 ? 1.2 : 0.9;
      break;
  }
  
  // Threat-based adjustments
  if (threatLevel === 'CRITICAL') {
    adjustment *= 0.5; // Focus on blocking (exploitation)
  } else if (threatLevel === 'HIGH') {
    adjustment *= 0.7;
  } else if (threatLevel === 'LOW') {
    adjustment *= 1.3; // More exploration when safe
  }
  
  return baseConstant * adjustment;
}

/**
 * Create root node for MCTS using node pool
 */
export function createRootNode(
  board: BoardState,
  currentPlayer: Player
): MCTSNode {
  const pool = getNodePool();
  return pool.acquire(null, null, board, currentPlayer);
}

/**
 * UCB1 formula for node selection
 * @param node - MCTS node to evaluate
 * @param ucb1Constant - Exploration constant from config
 */
function ucb1(node: MCTSNode, ucb1Constant: number): number {
  if (node.visits === 0) {
    return Infinity; // Unvisited nodes have highest priority
  }

  const exploitation = node.wins / node.visits;
  const exploration = ucb1Constant * Math.sqrt(
    Math.log((node.parent?.visits || 1)) / node.visits
  );

  return exploitation + exploration;
}

/**
 * Select best child node using UCB1
 * @param node - Parent node
 * @param ucb1Constant - Exploration constant from config
 */
function selectChild(node: MCTSNode, ucb1Constant: number): MCTSNode {
  if (node.children.length === 0) {
    return node;
  }

  let bestChild = node.children[0];
  let bestValue = ucb1(bestChild, ucb1Constant);

  for (let i = 1; i < node.children.length; i++) {
    const value = ucb1(node.children[i], ucb1Constant);
    if (value > bestValue) {
      bestValue = value;
      bestChild = node.children[i];
    }
  }

  return bestChild;
}

/**
 * Selection phase: traverse from root to leaf
 * @param node - Root node
 * @param ucb1Constant - Exploration constant from config
 */
function select(node: MCTSNode, ucb1Constant: number): MCTSNode {
  let current = node;

  while (current.children.length > 0 && current.untriedMoves.length === 0) {
    current = selectChild(current, ucb1Constant);
  }

  return current;
}

/**
 * Expansion phase: add a new child node using node pool
 */
function expand(node: MCTSNode): MCTSNode | null {
  if (node.untriedMoves.length === 0) {
    return null;
  }

  // Select a random untried move
  const randomIndex = Math.floor(Math.random() * node.untriedMoves.length);
  const move = node.untriedMoves[randomIndex];
  node.untriedMoves.splice(randomIndex, 1);

  // Create new board state with the move
  const newBoard = cloneBoard(node.board);
  const nextPlayer: Player = node.player === 'PLAYER' ? 'AI' : 'PLAYER';
  setCellState(newBoard, move, node.player);

  // Create child node using pool
  const pool = getNodePool();
  const childNode = pool.acquire(node, move, newBoard, nextPlayer);

  node.children.push(childNode);
  return childNode;
}

/**
 * Simulation phase: Improved Play-out with player move prediction
 * 
 * ENHANCED: Now considers player's predicted moves based on path analysis.
 * For PLAYER moves, uses weighted selection based on predicted positions.
 * For AI moves, uses random selection for speed.
 * 
 * This maintains performance while making simulations more realistic by
 * predicting where the player is likely to move based on their connection strategy.
 */
function simulate(node: MCTSNode, playerPredictedMoves?: Move[]): Player {
  let currentBoard = cloneBoard(node.board);
  let currentPlayer: Player = node.player;

  // Initial win check (only once at start)
  if (isConnected(currentBoard, 'PLAYER')) {
    return 'PLAYER';
  }
  if (isConnected(currentBoard, 'AI')) {
    return 'AI';
  }

  // Cache for player predicted moves and shortest path (computed once per simulation)
  let cachedPlayerMoves: Move[] | null = playerPredictedMoves || null;
  let cachedShortestPath: Move[] | null = null;
  let analysisComputed = false;

  let moves = 0;
  const maxMoves = currentBoard.boardSize.rows * currentBoard.boardSize.cols;
  const emptyCells = getEmptyCells(currentBoard);
  let emptyCount = emptyCells.length;

  // Fast playout with player move prediction
  while (emptyCount > 0 && moves < maxMoves) {
    if (emptyCount === 0) {
      break;
    }

    let selectedMove: Move;
    
    if (currentPlayer === 'PLAYER') {
      // For PLAYER: Use shortest path and predicted moves for more accurate simulation
      if (!analysisComputed) {
        // Compute path analysis once for this simulation
        const pathAnalysis = analyzePlayerPath(currentBoard);
        cachedPlayerMoves = pathAnalysis.predictedMoves.slice(0, 10).map(p => p.move);
        cachedShortestPath = pathAnalysis.shortestPathPositions;
        analysisComputed = true;
      }
      
      // Create weighted selection: prioritize shortest path positions
      const shortestPathSet = new Set<string>();
      if (cachedShortestPath) {
        for (const pos of cachedShortestPath) {
          shortestPathSet.add(`${pos.r},${pos.c}`);
        }
      }
      
      // Find available moves on shortest path
      const shortestPathMoves: Move[] = [];
      const predictedMoves: Move[] = [];
      const otherMoves: Move[] = [];
      
      for (let i = 0; i < emptyCount; i++) {
        const move = emptyCells[i];
        const moveKey = `${move.r},${move.c}`;
        
        if (shortestPathSet.has(moveKey)) {
          shortestPathMoves.push(move);
        } else if (cachedPlayerMoves && cachedPlayerMoves.some(pm => pm.r === move.r && pm.c === move.c)) {
          predictedMoves.push(move);
        } else {
          otherMoves.push(move);
        }
      }
      
      // Weighted selection based on move importance
      const rand = Math.random();
      if (shortestPathMoves.length > 0 && rand < 0.6) {
        // 60% chance to pick from shortest path (most critical)
        const index = Math.floor(Math.random() * shortestPathMoves.length);
        selectedMove = shortestPathMoves[index];
        const moveIndex = emptyCells.findIndex(e => e.r === selectedMove.r && e.c === selectedMove.c);
        emptyCells[moveIndex] = emptyCells[emptyCount - 1];
        emptyCells.pop();
        emptyCount--;
      } else if (predictedMoves.length > 0 && rand < 0.85) {
        // 25% chance (0.6-0.85) to pick from predicted moves
        const index = Math.floor(Math.random() * predictedMoves.length);
        selectedMove = predictedMoves[index];
        const moveIndex = emptyCells.findIndex(e => e.r === selectedMove.r && e.c === selectedMove.c);
        emptyCells[moveIndex] = emptyCells[emptyCount - 1];
        emptyCells.pop();
        emptyCount--;
      } else {
        // 15% chance for random move (exploration)
        const randomIndex = Math.floor(Math.random() * emptyCount);
        selectedMove = emptyCells[randomIndex];
        emptyCells[randomIndex] = emptyCells[emptyCount - 1];
        emptyCells.pop();
        emptyCount--;
      }
    } else {
      // For AI: Pure random selection for maximum speed
      const randomIndex = Math.floor(Math.random() * emptyCount);
      selectedMove = emptyCells[randomIndex];
      emptyCells[randomIndex] = emptyCells[emptyCount - 1];
      emptyCells.pop();
      emptyCount--;
    }

    // Apply move
    setCellState(currentBoard, selectedMove, currentPlayer);

    // Switch player
    currentPlayer = currentPlayer === 'PLAYER' ? 'AI' : 'PLAYER';
    moves++;
    
    // Reset analysis cache when player switches (will recompute on next PLAYER turn)
    if (currentPlayer === 'PLAYER') {
      analysisComputed = false;
      cachedPlayerMoves = null;
      cachedShortestPath = null;
    }
  }

  // Final win check (only once at end)
  if (isConnected(currentBoard, 'PLAYER')) {
    return 'PLAYER';
  }
  if (isConnected(currentBoard, 'AI')) {
    return 'AI';
  }

  // Last resort: count pieces
  let playerCount = 0;
  let aiCount = 0;
  const { rows, cols } = currentBoard.boardSize;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (currentBoard.cells[r][c] === 'PLAYER') {
        playerCount++;
      } else if (currentBoard.cells[r][c] === 'AI') {
        aiCount++;
      }
    }
  }

  return playerCount > aiCount ? 'PLAYER' : 'AI';
}

/**
 * Backpropagation phase: update statistics up the tree
 */
function backpropagate(node: MCTSNode, winner: Player, currentPlayer: Player): void {
  let current: MCTSNode | null = node;

  while (current !== null) {
    current.visits++;

    // Win if the winner is the player who made the move to reach this node
    // Note: The node's player is the one who made the move TO reach it
    // So we need to check if the winner matches the node's player's opponent
    const nodePlayer = current.player === 'PLAYER' ? 'AI' : 'PLAYER';
    if (winner === nodePlayer) {
      current.wins++;
    }

    current = current.parent;
  }
}

/**
 * Run one MCTS iteration with dynamic UCB1
 * @param root - Root node
 * @param currentPlayer - Current player
 * @param ucb1Constant - Base exploration constant from config
 * @param playerPredictedMoves - Optional: predicted moves for player (computed once at root)
 * @param dynamicUCB1 - Whether to use dynamic UCB1
 * @param personality - AI personality
 * @param threatLevel - Current threat level
 */
function mctsIteration(
  root: MCTSNode,
  currentPlayer: Player,
  ucb1Constant: number,
  playerPredictedMoves?: Move[],
  dynamicUCB1: boolean = false,
  personality: AIPersonality = 'BALANCED',
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): void {
  // Calculate dynamic UCB1 if enabled
  let effectiveUCB1 = ucb1Constant;
  if (dynamicUCB1 && root.visits > 0) {
    const winRate = root.wins / root.visits;
    effectiveUCB1 = calculateDynamicUCB1(ucb1Constant, winRate, personality, threatLevel);
  }
  
  // Selection
  const leaf = select(root, effectiveUCB1);

  // Check if leaf is terminal (winning state)
  if (isConnected(leaf.board, 'PLAYER')) {
    backpropagate(leaf, 'PLAYER', currentPlayer);
    return;
  }
  if (isConnected(leaf.board, 'AI')) {
    backpropagate(leaf, 'AI', currentPlayer);
    return;
  }

  // Expansion
  const expanded = expand(leaf);
  if (expanded === null) {
    // No expansion possible - terminal node
    const winner = simulate(leaf, playerPredictedMoves);
    backpropagate(leaf, winner, currentPlayer);
    return;
  }

  // Simulation (pass predicted moves for better player move prediction)
  const winner = simulate(expanded, playerPredictedMoves);

  // Backpropagation
  backpropagate(expanded, winner, currentPlayer);
}

/**
 * Run MCTS and return best move
 * 
 * @param board - Current board state
 * @param currentPlayer - Player to find best move for
 * @param config - MCTS configuration
 * @param threatLevel - Optional threat level for dynamic UCB1
 * @returns Best move found by MCTS
 */
export function runMCTS(
  board: BoardState,
  currentPlayer: Player,
  config: MCTSConfig,
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Move | null {
  // Reset node pool before starting new search
  resetNodePool();
  
  const root = createRootNode(board, currentPlayer);

  // Check if there are any valid moves
  if (root.untriedMoves.length === 0) {
    return null;
  }

  // If only one move, return it immediately
  if (root.untriedMoves.length === 1) {
    return root.untriedMoves[0];
  }

  // Pre-compute player predicted moves once at root level for efficiency
  const playerPredictedMoves = currentPlayer === 'AI' 
    ? predictPlayerNextMove(board, null)
    : undefined;

  const startTime = Date.now();
  let iterations = 0;
  const ucb1Constant = config.ucb1Constant;
  const personality = config.personality || 'BALANCED';
  const dynamicUCB1 = config.dynamicUCB1 ?? true; // Default to enabled

  // Run simulations
  while (iterations < config.simulations) {
    // Check time limit if specified
    if (config.timeLimit) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= config.timeLimit) {
        break;
      }
    }

    // Calculate current win rate for dynamic UCB1
    const currentWinRate = root.visits > 0 ? root.wins / root.visits : 0.5;
    
    mctsIteration(
      root, 
      currentPlayer, 
      ucb1Constant, 
      playerPredictedMoves,
      dynamicUCB1,
      personality,
      threatLevel
    );
    iterations++;
  }

  // Select best move (most visited child)
  // For ALIEN personality, sometimes select a "weird" move with high entropy
  if (root.children.length === 0) {
    // Fallback: return first untried move
    return root.untriedMoves[0] || null;
  }

  let bestChild = root.children[0];
  let mostVisits = bestChild.visits;

  for (let i = 1; i < root.children.length; i++) {
    if (root.children[i].visits > mostVisits) {
      mostVisits = root.children[i].visits;
      bestChild = root.children[i];
    }
  }

  // ALIEN personality: occasionally pick a "weird" move (high visits but not best)
  if (personality === 'ALIEN' && Math.random() < 0.15 && root.children.length > 2) {
    // Sort by visits and pick from top 3, but not always the best
    const sorted = [...root.children].sort((a, b) => b.visits - a.visits);
    const candidates = sorted.slice(0, 3);
    const weirdMove = candidates[Math.floor(Math.random() * candidates.length)];
    if (weirdMove.visits >= mostVisits * 0.7) { // Only if reasonably good
      return weirdMove.move;
    }
  }

  return bestChild.move;
}
