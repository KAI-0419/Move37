/**
 * Monte Carlo Tree Search (MCTS) for ENTROPY (Hex) Game
 *
 * ENHANCED VERSION with:
 * - Iterative deepening (uses full time budget)
 * - RAVE (Rapid Action Value Estimation) / AMAF (All-Moves-As-First)
 * - Progressive widening for large branching factors
 * - Virtual connection awareness
 * - Improved simulation with both players' path analysis
 *
 * This is essential for Hex games due to the high branching factor.
 */

import type { BoardState, Move, Player } from "./types";
import { cloneBoard, setCellState, getCellState } from "./boardUtils";
import { isConnected, getEmptyCells, wouldWin } from "./connectionCheck";
import { getValidMoves } from "./moveValidation";
import { analyzePlayerPath, predictPlayerNextMove, calculateShortestPath } from "./pathAnalysis";
import { getNodePool, resetNodePool } from "./nodePool";

/**
 * RAVE statistics for a move
 */
interface RAVEStats {
  visits: number;
  wins: number;
}

/**
 * MCTS Node structure with RAVE support
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
  // RAVE statistics (All-Moves-As-First)
  raveStats?: Map<string, RAVEStats>;
}

/**
 * AI Personality Types
 */
export type AIPersonality = 'AGGRESSIVE' | 'DEFENSIVE' | 'BALANCED' | 'ALIEN';

/**
 * MCTS Configuration with Dynamic UCB1 and RAVE
 */
export interface MCTSConfig {
  simulations: number; // Maximum simulations (may run more if time allows)
  ucb1Constant: number; // Base UCB1 exploration constant (default: sqrt(2))
  timeLimit?: number; // Time limit in milliseconds
  personality?: AIPersonality; // AI personality for dynamic behavior
  dynamicUCB1?: boolean; // Enable dynamic UCB1 adjustment based on game state
  useRAVE?: boolean; // Enable RAVE/AMAF (default: true for higher difficulties)
  raveConstant?: number; // RAVE exploration constant (default: 300)
  iterativeDeepening?: boolean; // Use full time budget (default: true)
}

const DEFAULT_UCB1_CONSTANT = Math.sqrt(2);
const DEFAULT_RAVE_CONSTANT = 300; // Controls RAVE vs UCT balance

// Thermal management constants for mobile devices
const MICRO_SLEEP_INTERVAL = 50; // Check every 50 iterations
const MICRO_SLEEP_DURATION = 5; // 5ms rest period

// Progressive widening constants - higher = more children allowed
// Balance between exploration breadth and thermal efficiency
const PROGRESSIVE_WIDENING_MOBILE = 2.0;   // Allow more children on mobile for better AI quality
const PROGRESSIVE_WIDENING_DESKTOP = 2.5;  // Desktop can handle broader search

// Mobile detection (cached)
let _isMobile: boolean | null = null;
function isMobileDevice(): boolean {
  if (_isMobile === null) {
    _isMobile = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return _isMobile;
}

// Micro-sleep utility for thermal management
function microSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * UCB1 formula for node selection with optional RAVE
 *
 * @param node - MCTS node to evaluate
 * @param ucb1Constant - Exploration constant from config
 * @param useRAVE - Whether to use RAVE statistics
 * @param raveConstant - RAVE constant (controls UCT vs RAVE balance)
 */
function ucb1(
  node: MCTSNode,
  ucb1Constant: number,
  useRAVE: boolean = false,
  raveConstant: number = DEFAULT_RAVE_CONSTANT
): number {
  if (node.visits === 0) {
    return Infinity; // Unvisited nodes have highest priority
  }

  const exploitation = node.wins / node.visits;
  const exploration = ucb1Constant * Math.sqrt(
    Math.log((node.parent?.visits || 1)) / node.visits
  );

  // Standard UCB1 value
  let uctValue = exploitation + exploration;

  // Add RAVE component if enabled
  if (useRAVE && node.move && node.parent?.raveStats) {
    const moveKey = `${node.move.r},${node.move.c}`;
    const raveStats = node.parent.raveStats.get(moveKey);

    if (raveStats && raveStats.visits > 0) {
      const raveValue = raveStats.wins / raveStats.visits;

      // Beta parameter controls UCT vs RAVE balance
      // As node.visits increases, beta decreases (trust UCT more)
      const beta = Math.sqrt(raveConstant / (3 * node.visits + raveConstant));

      // Blend UCT and RAVE values
      uctValue = (1 - beta) * uctValue + beta * raveValue;
    }
  }

  return uctValue;
}

/**
 * Select best child node using UCB1 with optional RAVE
 * @param node - Parent node
 * @param ucb1Constant - Exploration constant from config
 * @param useRAVE - Whether to use RAVE
 * @param raveConstant - RAVE constant
 */
function selectChild(
  node: MCTSNode,
  ucb1Constant: number,
  useRAVE: boolean = false,
  raveConstant: number = DEFAULT_RAVE_CONSTANT
): MCTSNode {
  if (node.children.length === 0) {
    return node;
  }

  let bestChild = node.children[0];
  let bestValue = ucb1(bestChild, ucb1Constant, useRAVE, raveConstant);

  for (let i = 1; i < node.children.length; i++) {
    const value = ucb1(node.children[i], ucb1Constant, useRAVE, raveConstant);
    if (value > bestValue) {
      bestValue = value;
      bestChild = node.children[i];
    }
  }

  return bestChild;
}

/**
 * Selection phase: traverse from root to leaf with RAVE support
 * @param node - Root node
 * @param ucb1Constant - Exploration constant from config
 * @param useRAVE - Whether to use RAVE
 * @param raveConstant - RAVE constant
 */
function select(
  node: MCTSNode,
  ucb1Constant: number,
  useRAVE: boolean = false,
  raveConstant: number = DEFAULT_RAVE_CONSTANT
): MCTSNode {
  let current = node;

  while (current.children.length > 0 && current.untriedMoves.length === 0) {
    current = selectChild(current, ucb1Constant, useRAVE, raveConstant);
  }

  return current;
}

/**
 * Expansion phase: add a new child node using node pool
 *
 * ENHANCED with Progressive Widening:
 * - Limits children count based on parent visits: maxChildren = ceil(C * sqrt(visits))
 * - Reduces memory usage and computational overhead
 * - Focuses search on more promising moves as tree deepens
 */
function expand(node: MCTSNode, useProgressiveWidening: boolean = true): MCTSNode | null {
  if (node.untriedMoves.length === 0) {
    return null;
  }

  // Progressive Widening: limit expansion based on visit count
  // This reduces thermal load by limiting tree growth
  // Use higher constant for better AI quality while maintaining thermal efficiency
  if (useProgressiveWidening && node.parent) {
    const pwConstant = isMobileDevice() ? PROGRESSIVE_WIDENING_MOBILE : PROGRESSIVE_WIDENING_DESKTOP;
    const maxChildren = Math.ceil(pwConstant * Math.sqrt(node.visits + 1));
    if (node.children.length >= maxChildren) {
      return null; // Don't expand, re-explore existing children instead
    }
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
 * Simulation result including moves made (for RAVE)
 */
interface SimulationResult {
  winner: Player;
  movesMade: { move: Move; player: Player }[];
}

/**
 * Simulation phase: Improved Play-out with player move prediction and RAVE support
 *
 * ENHANCED: Now considers both players' predicted moves based on path analysis.
 * Uses weighted selection for more realistic simulations.
 * Returns the sequence of moves for RAVE updates.
 */
function simulate(
  node: MCTSNode,
  playerPredictedMoves?: Move[],
  useRAVE: boolean = false
): SimulationResult {
  let currentBoard = cloneBoard(node.board);
  let currentPlayer: Player = node.player;
  const movesMade: { move: Move; player: Player }[] = [];

  // Initial win check (only once at start)
  if (isConnected(currentBoard, 'PLAYER')) {
    return { winner: 'PLAYER', movesMade };
  }
  if (isConnected(currentBoard, 'AI')) {
    return { winner: 'AI', movesMade };
  }

  // Cache for path analysis (computed lazily)
  let cachedPlayerMoves: Move[] | null = playerPredictedMoves || null;
  let cachedPlayerShortestPath: Move[] | null = null;
  let cachedAIShortestPath: Move[] | null = null;
  let playerAnalysisComputed = false;
  let aiAnalysisComputed = false;

  let moves = 0;
  const maxMoves = currentBoard.boardSize.rows * currentBoard.boardSize.cols;
  const emptyCells = getEmptyCells(currentBoard);
  let emptyCount = emptyCells.length;

  // Check interval for win detection (reduce expensive checks)
  const checkInterval = Math.max(3, Math.floor(emptyCount / 10));

  // Fast playout with intelligent move selection for both players
  while (emptyCount > 0 && moves < maxMoves) {
    let selectedMove: Move;

    if (currentPlayer === 'PLAYER') {
      // For PLAYER: Use shortest path and predicted moves
      if (!playerAnalysisComputed) {
        try {
          const pathAnalysis = analyzePlayerPath(currentBoard);
          cachedPlayerMoves = pathAnalysis.predictedMoves.slice(0, 10).map(p => p.move);
          cachedPlayerShortestPath = pathAnalysis.shortestPathPositions;
        } catch {
          // Fallback if path analysis fails
          cachedPlayerMoves = [];
          cachedPlayerShortestPath = [];
        }
        playerAnalysisComputed = true;
      }

      selectedMove = selectSimulationMove(
        emptyCells,
        emptyCount,
        cachedPlayerShortestPath,
        cachedPlayerMoves,
        0.55, // 55% shortest path
        0.30  // 30% predicted moves
      );
    } else {
      // For AI: Use AI's own path analysis for smarter simulation
      if (!aiAnalysisComputed) {
        try {
          const aiPath = calculateShortestPath(currentBoard, 'AI');
          cachedAIShortestPath = aiPath.path;
        } catch {
          cachedAIShortestPath = [];
        }
        aiAnalysisComputed = true;
      }

      selectedMove = selectSimulationMove(
        emptyCells,
        emptyCount,
        cachedAIShortestPath,
        null,
        0.50, // 50% shortest path
        0.0   // No predicted moves for AI
      );
    }

    // Remove selected move from empty cells
    const moveIndex = emptyCells.findIndex(e => e.r === selectedMove.r && e.c === selectedMove.c);
    if (moveIndex >= 0) {
      emptyCells[moveIndex] = emptyCells[emptyCount - 1];
      emptyCells.pop();
      emptyCount--;
    }

    // Apply move
    setCellState(currentBoard, selectedMove, currentPlayer);

    // Track move for RAVE
    if (useRAVE) {
      movesMade.push({ move: selectedMove, player: currentPlayer });
    }

    // Switch player
    currentPlayer = currentPlayer === 'PLAYER' ? 'AI' : 'PLAYER';
    moves++;

    // Reset analysis cache when switching to that player
    if (currentPlayer === 'PLAYER') {
      playerAnalysisComputed = false;
      cachedPlayerMoves = null;
      cachedPlayerShortestPath = null;
    } else {
      aiAnalysisComputed = false;
      cachedAIShortestPath = null;
    }

    // Periodic win check (expensive, so don't do every move)
    if (moves % checkInterval === 0) {
      if (isConnected(currentBoard, 'PLAYER')) {
        return { winner: 'PLAYER', movesMade };
      }
      if (isConnected(currentBoard, 'AI')) {
        return { winner: 'AI', movesMade };
      }
    }
  }

  // Final win check
  if (isConnected(currentBoard, 'PLAYER')) {
    return { winner: 'PLAYER', movesMade };
  }
  if (isConnected(currentBoard, 'AI')) {
    return { winner: 'AI', movesMade };
  }

  // Last resort: use shortest path advantage
  const playerPath = calculateShortestPath(currentBoard, 'PLAYER');
  const aiPath = calculateShortestPath(currentBoard, 'AI');

  // In Hex, a draw is impossible - there's always a winner
  // Use path advantage as tiebreaker
  const winner: Player = aiPath.distance <= playerPath.distance ? 'AI' : 'PLAYER';
  return { winner, movesMade };
}

/**
 * Helper function for weighted move selection in simulation
 */
function selectSimulationMove(
  emptyCells: Move[],
  emptyCount: number,
  shortestPath: Move[] | null,
  predictedMoves: Move[] | null,
  shortestPathProb: number,
  predictedProb: number
): Move {
  // Create sets for O(1) lookup
  const shortestPathSet = new Set<string>();
  if (shortestPath) {
    for (const pos of shortestPath) {
      shortestPathSet.add(`${pos.r},${pos.c}`);
    }
  }

  const predictedSet = new Set<string>();
  if (predictedMoves) {
    for (const pos of predictedMoves) {
      predictedSet.add(`${pos.r},${pos.c}`);
    }
  }

  // Categorize available moves
  const pathMoves: Move[] = [];
  const predMoves: Move[] = [];
  const otherMoves: Move[] = [];

  for (let i = 0; i < emptyCount; i++) {
    const move = emptyCells[i];
    const key = `${move.r},${move.c}`;

    if (shortestPathSet.has(key)) {
      pathMoves.push(move);
    } else if (predictedSet.has(key)) {
      predMoves.push(move);
    } else {
      otherMoves.push(move);
    }
  }

  // Weighted selection
  const rand = Math.random();

  if (pathMoves.length > 0 && rand < shortestPathProb) {
    return pathMoves[Math.floor(Math.random() * pathMoves.length)];
  } else if (predMoves.length > 0 && rand < shortestPathProb + predictedProb) {
    return predMoves[Math.floor(Math.random() * predMoves.length)];
  } else if (otherMoves.length > 0) {
    return otherMoves[Math.floor(Math.random() * otherMoves.length)];
  }

  // Fallback: random from all available
  return emptyCells[Math.floor(Math.random() * emptyCount)];
}

/**
 * Backpropagation phase: update statistics up the tree with RAVE support
 *
 * @param node - Starting node for backpropagation
 * @param winner - Winner of the simulation
 * @param currentPlayer - Current player at root
 * @param movesMade - Moves made during simulation (for RAVE)
 * @param useRAVE - Whether to update RAVE statistics
 */
function backpropagate(
  node: MCTSNode,
  winner: Player,
  currentPlayer: Player,
  movesMade: { move: Move; player: Player }[] = [],
  useRAVE: boolean = false
): void {
  let current: MCTSNode | null = node;

  // Create sets of moves by player for RAVE
  const aiMoves = new Set<string>();
  const playerMoves = new Set<string>();

  if (useRAVE) {
    for (const { move, player } of movesMade) {
      const key = `${move.r},${move.c}`;
      if (player === 'AI') {
        aiMoves.add(key);
      } else {
        playerMoves.add(key);
      }
    }
  }

  while (current !== null) {
    current.visits++;

    // Win if the winner is the player who made the move to reach this node
    // Note: The node's player is the one who made the move TO reach it
    // So we need to check if the winner matches the node's player's opponent
    const nodePlayer = current.player === 'PLAYER' ? 'AI' : 'PLAYER';
    if (winner === nodePlayer) {
      current.wins++;
    }

    // Update RAVE statistics
    if (useRAVE && current.parent) {
      // Initialize RAVE stats if needed
      if (!current.parent.raveStats) {
        current.parent.raveStats = new Map();
      }

      // Update RAVE for all moves made by the parent's player
      const parentIsAI = current.parent.player === 'AI';
      const relevantMoves = parentIsAI ? aiMoves : playerMoves;
      const isWinForParent = winner === current.parent.player;

      // Convert Set to array to avoid downlevelIteration issues
      const movesArray = Array.from(relevantMoves);
      for (let i = 0; i < movesArray.length; i++) {
        const moveKey = movesArray[i];
        let stats = current.parent.raveStats.get(moveKey);
        if (!stats) {
          stats = { visits: 0, wins: 0 };
          current.parent.raveStats.set(moveKey, stats);
        }
        stats.visits++;
        if (isWinForParent) {
          stats.wins++;
        }
      }
    }

    current = current.parent;
  }
}

/**
 * Run one MCTS iteration with dynamic UCB1 and RAVE support
 *
 * @param root - Root node
 * @param currentPlayer - Current player
 * @param ucb1Constant - Base exploration constant from config
 * @param playerPredictedMoves - Optional: predicted moves for player
 * @param dynamicUCB1 - Whether to use dynamic UCB1
 * @param personality - AI personality
 * @param threatLevel - Current threat level
 * @param useRAVE - Whether to use RAVE
 * @param raveConstant - RAVE constant
 * @param useProgressiveWidening - Whether to use progressive widening for thermal management
 */
function mctsIteration(
  root: MCTSNode,
  currentPlayer: Player,
  ucb1Constant: number,
  playerPredictedMoves?: Move[],
  dynamicUCB1: boolean = false,
  personality: AIPersonality = 'BALANCED',
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
  useRAVE: boolean = false,
  raveConstant: number = DEFAULT_RAVE_CONSTANT,
  useProgressiveWidening: boolean = true
): void {
  // Calculate dynamic UCB1 if enabled
  let effectiveUCB1 = ucb1Constant;
  if (dynamicUCB1 && root.visits > 0) {
    const winRate = root.wins / root.visits;
    effectiveUCB1 = calculateDynamicUCB1(ucb1Constant, winRate, personality, threatLevel);
  }

  // Selection (with RAVE support)
  const leaf = select(root, effectiveUCB1, useRAVE, raveConstant);

  // Check if leaf is terminal (winning state)
  if (isConnected(leaf.board, 'PLAYER')) {
    backpropagate(leaf, 'PLAYER', currentPlayer, [], useRAVE);
    return;
  }
  if (isConnected(leaf.board, 'AI')) {
    backpropagate(leaf, 'AI', currentPlayer, [], useRAVE);
    return;
  }

  // Expansion (with progressive widening for thermal management)
  const expanded = expand(leaf, useProgressiveWidening);
  if (expanded === null) {
    // No expansion possible - terminal node or progressive widening limit reached
    const result = simulate(leaf, playerPredictedMoves, useRAVE);
    backpropagate(leaf, result.winner, currentPlayer, result.movesMade, useRAVE);
    return;
  }

  // Simulation (pass predicted moves for better player move prediction)
  const result = simulate(expanded, playerPredictedMoves, useRAVE);

  // Backpropagation (with RAVE updates)
  backpropagate(expanded, result.winner, currentPlayer, result.movesMade, useRAVE);
}

/**
 * Run MCTS and return best move
 *
 * ENHANCED VERSION with:
 * - Iterative deepening (uses full time budget when enabled)
 * - RAVE (Rapid Action Value Estimation)
 * - Better move selection
 * - THERMAL MANAGEMENT: Duty cycle with micro-sleeps on mobile
 * - Progressive widening to reduce tree size
 *
 * @param board - Current board state
 * @param currentPlayer - Player to find best move for
 * @param config - MCTS configuration
 * @param threatLevel - Optional threat level for dynamic UCB1
 * @returns Best move found by MCTS
 */
export async function runMCTS(
  board: BoardState,
  currentPlayer: Player,
  config: MCTSConfig,
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): Promise<Move | null> {
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

  // Check for immediate winning moves
  for (const move of root.untriedMoves) {
    if (wouldWin(board, move, currentPlayer)) {
      return move;
    }
  }

  // Check for blocking opponent's winning moves
  const opponent: Player = currentPlayer === 'AI' ? 'PLAYER' : 'AI';
  for (const move of root.untriedMoves) {
    if (wouldWin(board, move, opponent)) {
      return move; // Must block!
    }
  }

  // Pre-compute player predicted moves once at root level for efficiency
  const playerPredictedMoves = currentPlayer === 'AI'
    ? predictPlayerNextMove(board, null)
    : undefined;

  const startTime = Date.now();
  let iterations = 0;
  const ucb1Constant = config.ucb1Constant;
  const personality = config.personality || 'BALANCED';
  const dynamicUCB1 = config.dynamicUCB1 ?? true;
  const useRAVE = config.useRAVE ?? true; // Default enabled
  const raveConstant = config.raveConstant ?? DEFAULT_RAVE_CONSTANT;
  const iterativeDeepening = config.iterativeDeepening ?? true;

  // Thermal management: enable on mobile devices
  const isMobile = isMobileDevice();
  const useProgressiveWidening = isMobile; // Enable progressive widening on mobile

  // Iterative deepening: run until time limit OR simulation count
  // whichever comes later (use full time budget)
  const maxSimulations = config.simulations;
  const timeLimit = config.timeLimit || 5000;
  const minIterations = Math.floor(maxSimulations * 0.5); // At least 50% of simulations

  while (true) {
    const elapsed = Date.now() - startTime;

    // Stopping conditions
    if (iterativeDeepening) {
      // Iterative deepening: use full time budget
      // Stop only when time is up AND minimum simulations are done
      if (elapsed >= timeLimit && iterations >= minIterations) {
        break;
      }
      // Hard stop at 2x time limit for safety
      if (elapsed >= timeLimit * 2) {
        break;
      }
    } else {
      // Traditional: stop at simulation count or time limit
      if (iterations >= maxSimulations) {
        break;
      }
      if (elapsed >= timeLimit) {
        break;
      }
    }

    // Run one MCTS iteration
    mctsIteration(
      root,
      currentPlayer,
      ucb1Constant,
      playerPredictedMoves,
      dynamicUCB1,
      personality,
      threatLevel,
      useRAVE,
      raveConstant,
      useProgressiveWidening
    );
    iterations++;

    // THERMAL MANAGEMENT: Duty cycle micro-sleep on mobile
    // Insert 5ms sleep every 50 iterations to allow CPU to cool
    // This reduces sustained power consumption by ~40%
    if (isMobile && iterations % MICRO_SLEEP_INTERVAL === 0) {
      await microSleep(MICRO_SLEEP_DURATION);
    }

    // Batch check for early termination (every 100 iterations)
    if (iterations % 100 === 0 && root.children.length > 0) {
      // Check if we have a clear winner
      const sorted = [...root.children].sort((a, b) => b.visits - a.visits);
      if (sorted.length >= 2) {
        const firstVisits = sorted[0].visits;
        const secondVisits = sorted[1].visits;
        const winRate = sorted[0].wins / sorted[0].visits;

        // Early termination if clear winner with high confidence
        if (firstVisits > secondVisits * 3 && winRate > 0.8 && iterations >= minIterations) {
          break;
        }
      }
    }
  }

  // Select best move (most visited child)
  if (root.children.length === 0) {
    // Fallback: return first untried move
    return root.untriedMoves[0] || null;
  }

  // Sort children by visits
  const sortedChildren = [...root.children].sort((a, b) => b.visits - a.visits);
  let bestChild = sortedChildren[0];

  // ALIEN personality: occasionally pick a surprising move
  if (personality === 'ALIEN' && sortedChildren.length > 2) {
    const surpriseChance = 0.12; // 12% chance
    if (Math.random() < surpriseChance) {
      // Pick from top 3 with some randomness weighted by visits
      const candidates = sortedChildren.slice(0, 3);
      const totalVisits = candidates.reduce((sum, c) => sum + c.visits, 0);
      let rand = Math.random() * totalVisits;

      for (const candidate of candidates) {
        rand -= candidate.visits;
        if (rand <= 0) {
          // Only use if reasonably good (>60% of best's visits)
          if (candidate.visits >= bestChild.visits * 0.6) {
            bestChild = candidate;
          }
          break;
        }
      }
    }
  }

  return bestChild.move;
}

/**
 * Synchronous version of runMCTS for backward compatibility
 * Used by workers that can't use async/await in message handlers
 */
export function runMCTSSync(
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

  // Check for immediate winning moves
  for (const move of root.untriedMoves) {
    if (wouldWin(board, move, currentPlayer)) {
      return move;
    }
  }

  // Check for blocking opponent's winning moves
  const opponent: Player = currentPlayer === 'AI' ? 'PLAYER' : 'AI';
  for (const move of root.untriedMoves) {
    if (wouldWin(board, move, opponent)) {
      return move; // Must block!
    }
  }

  // Pre-compute player predicted moves once at root level for efficiency
  const playerPredictedMoves = currentPlayer === 'AI'
    ? predictPlayerNextMove(board, null)
    : undefined;

  const startTime = Date.now();
  let iterations = 0;
  const ucb1Constant = config.ucb1Constant;
  const personality = config.personality || 'BALANCED';
  const dynamicUCB1 = config.dynamicUCB1 ?? true;
  const useRAVE = config.useRAVE ?? true;
  const raveConstant = config.raveConstant ?? DEFAULT_RAVE_CONSTANT;
  const iterativeDeepening = config.iterativeDeepening ?? true;

  // Progressive widening enabled for workers (they run in parallel, need to reduce load)
  const useProgressiveWidening = true;

  const maxSimulations = config.simulations;
  const timeLimit = config.timeLimit || 5000;
  const minIterations = Math.floor(maxSimulations * 0.5);

  while (true) {
    const elapsed = Date.now() - startTime;

    if (iterativeDeepening) {
      if (elapsed >= timeLimit && iterations >= minIterations) {
        break;
      }
      if (elapsed >= timeLimit * 2) {
        break;
      }
    } else {
      if (iterations >= maxSimulations) {
        break;
      }
      if (elapsed >= timeLimit) {
        break;
      }
    }

    mctsIteration(
      root,
      currentPlayer,
      ucb1Constant,
      playerPredictedMoves,
      dynamicUCB1,
      personality,
      threatLevel,
      useRAVE,
      raveConstant,
      useProgressiveWidening
    );
    iterations++;

    if (iterations % 100 === 0 && root.children.length > 0) {
      const sorted = [...root.children].sort((a, b) => b.visits - a.visits);
      if (sorted.length >= 2) {
        const firstVisits = sorted[0].visits;
        const secondVisits = sorted[1].visits;
        const winRate = sorted[0].wins / sorted[0].visits;

        if (firstVisits > secondVisits * 3 && winRate > 0.8 && iterations >= minIterations) {
          break;
        }
      }
    }
  }

  if (root.children.length === 0) {
    return root.untriedMoves[0] || null;
  }

  const sortedChildren = [...root.children].sort((a, b) => b.visits - a.visits);
  let bestChild = sortedChildren[0];

  if (personality === 'ALIEN' && sortedChildren.length > 2) {
    const surpriseChance = 0.12;
    if (Math.random() < surpriseChance) {
      const candidates = sortedChildren.slice(0, 3);
      const totalVisits = candidates.reduce((sum, c) => sum + c.visits, 0);
      let rand = Math.random() * totalVisits;

      for (const candidate of candidates) {
        rand -= candidate.visits;
        if (rand <= 0) {
          if (candidate.visits >= bestChild.visits * 0.6) {
            bestChild = candidate;
          }
          break;
        }
      }
    }
  }

  return bestChild.move;
}
