/**
 * ENTROPY Evaluation Functions
 *
 * ENHANCED VERSION with:
 * - Opening book integration
 * - Endgame solver for perfect late-game play
 * - Virtual connections awareness
 * - RAVE-enhanced MCTS
 * - Iterative deepening for full time budget utilization
 *
 * Implements "Move 37" strategy for advanced play.
 */

import type { BoardState, Move, Player } from "./types";
import type { GameMove, PlayerMove, AIMoveResult } from "@shared/gameEngineInterface";
import { parseBoardState } from "./boardUtils";
import { isConnected, wouldWin, getEmptyCells } from "./connectionCheck";
import { getValidMoves, getMovesNearOpponent, wouldBlockOpponent, findThreatMoves } from "./moveValidation";
import { runMCTS, type MCTSConfig, type AIPersonality } from "./mcts";
import { getValidNeighbors } from "./boardUtils";
import { analyzePlayerPath, findCriticalPositions, predictPlayerNextMove, calculateShortestPath } from "./pathAnalysis";
import { getMCTSWorkerPool } from "./mctsWorkerPool";
import { getOpeningBookMove, isOpeningPhase } from "./openingBook";
import { solveEndgame, shouldUseEndgameSolver, getEndgameDepth, getEndgameTimeLimit, clearTranspositionTable } from "./endgameSolver";
import { getVirtualConnectionCarriers, hasVirtualWin } from "./virtualConnections";

// Mobile detection (cached)
let _isMobileDevice: boolean | null = null;
function isMobileDevice(): boolean {
  if (_isMobileDevice === null) {
    _isMobileDevice = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  return _isMobileDevice;
}

/**
 * Mobile-optimized MCTS configurations
 * Reduces simulation count and time limits to prevent thermal throttling
 * while maintaining strong AI quality through algorithmic improvements
 *
 * NEXUS-7 Strategy: Compensate for reduced simulations with:
 * - Lower UCB1 constant (stronger exploitation)
 * - Higher RAVE constant (faster convergence)
 * - Optimized progressive widening
 */
const MOBILE_CONFIG_OVERRIDES = {
  "NEXUS-3": {
    simulations: 600,    // -25% from 800
    timeLimit: 1500,     // -25% from 2000ms
  },
  "NEXUS-5": {
    simulations: 2500,   // -37.5% from 4000
    timeLimit: 4000,     // -33% from 6000ms
  },
  "NEXUS-7": {
    simulations: 8000,   // -20% from 10000 (increased from 6000 for stronger play)
    timeLimit: 8500,     // -15% from 10000ms (increased from 7000 for better analysis)
    // Additional overrides for stronger play
    ucb1Constant: Math.sqrt(2) * 0.7,  // Stronger exploitation (was 0.85)
    raveConstant: 550,                  // Faster convergence (was 400)
  },
} as const;

/**
 * Get MCTS configuration based on difficulty
 *
 * REDESIGNED for three distinct difficulty levels:
 *
 * - NEXUS-3 (일반인): Beatable by casual players
 *   - Low simulation count, no RAVE, limited opening book
 *   - Some intentional randomness for weaker play
 *
 * - NEXUS-5 (HEX 전문가): Challenging but beatable by experts
 *   - Medium simulation count, RAVE enabled, opening book
 *   - Strong tactical play, endgame solver for close games
 *
 * - NEXUS-7 (인간 초월): Nearly impossible to beat
 *   - Maximum simulation count, full time budget utilization
 *   - Complete opening book, deep endgame solver
 *   - RAVE + iterative deepening for optimal play
 *
 * THERMAL MANAGEMENT:
 * - On mobile devices, automatically applies reduced settings
 * - Prevents overheating while maintaining AI quality
 */
function getMCTSConfig(
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): MCTSConfig {
  const isMobile = isMobileDevice();

  // Base configurations for desktop
  let config: MCTSConfig;

  switch (difficulty) {
    case "NEXUS-3":
      // 일반인 수준: 캐주얼 플레이어가 이길 수 있음
      // Intentionally weak for learning the game
      config = {
        simulations: 800, // Low simulation count
        ucb1Constant: Math.sqrt(2) * 1.3, // High exploration = more random
        timeLimit: 2000, // Short time limit
        personality: 'BALANCED',
        dynamicUCB1: false, // Disable for simpler play
        useRAVE: false, // No RAVE (weaker)
        raveConstant: 0,
        iterativeDeepening: false, // Don't use full time
      };
      break;

    case "NEXUS-5":
      // HEX 전문가 수준: 강하지만 전문가에게는 패배 가능
      // Strong tactical play with solid strategy
      config = {
        simulations: 4000, // Medium-high simulation count
        ucb1Constant: Math.sqrt(2) * 0.95, // Slightly favor exploitation
        timeLimit: 6000, // 6 seconds
        personality: 'AGGRESSIVE',
        dynamicUCB1: true,
        useRAVE: true, // RAVE enabled
        raveConstant: 250,
        iterativeDeepening: true, // Use full time budget
      };
      break;

    case "NEXUS-7":
      // 인간 초월: 거의 이길 수 없는 최상위 레벨
      // Maximum strength with all optimizations
      config = {
        simulations: 10000, // Very high simulation count
        ucb1Constant: Math.sqrt(2) * 0.85, // Strong exploitation
        timeLimit: 10000, // 10 seconds (full budget)
        personality: 'ALIEN', // Unpredictable genius moves
        dynamicUCB1: true,
        useRAVE: true, // Full RAVE
        raveConstant: 400, // Higher RAVE weight
        iterativeDeepening: true, // Use full time budget
      };
      break;
  }

  // Apply mobile overrides for thermal management
  if (isMobile) {
    const mobileOverride = MOBILE_CONFIG_OVERRIDES[difficulty];
    config = {
      ...config,
      simulations: mobileOverride.simulations,
      timeLimit: mobileOverride.timeLimit,
    };

    // NEXUS-7 specific: Apply additional algorithmic improvements to compensate for reduced simulations
    if (difficulty === "NEXUS-7" && 'ucb1Constant' in mobileOverride) {
      config.ucb1Constant = mobileOverride.ucb1Constant;
      config.raveConstant = mobileOverride.raveConstant;
      console.log(`[MCTS] Mobile NEXUS-7: Enhanced config - UCB1=${config.ucb1Constant.toFixed(3)}, RAVE=${config.raveConstant}`);
    }

    console.log(`[MCTS] Mobile device detected - using optimized config for ${difficulty}: ${mobileOverride.simulations} sims, ${mobileOverride.timeLimit}ms`);
  }

  return config;
}

/**
 * Detect strategic "Move 37" pattern: Find moves that create strategic pressure
 * based on path analysis of player's connection attempts.
 * 
 * ENHANCED: Now uses path analysis to understand player's connection strategy
 * and find moves that block their path while maintaining strategic positioning.
 * 
 * @param board - Current board state
 * @param playerLastMove - Player's last move
 * @returns Array of strategic candidate moves with scores, or empty array
 */
function detectStrategicMoves(
  board: BoardState,
  playerLastMove: PlayerMove | null
): Array<{ move: Move; score: number }> {
  // Analyze player's path to understand their connection strategy
  const pathAnalysis = analyzePlayerPath(board);
  
  // Calculate shortest paths for both players
  const playerShortestPath = calculateShortestPath(board, 'PLAYER');
  const aiShortestPath = calculateShortestPath(board, 'AI');
  
  const emptyCells = getEmptyCells(board);
  const candidates: Array<{ move: Move; score: number }> = [];
  
  const { rows, cols } = board.boardSize;
  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);

  // Create sets for quick lookup
  const playerPathSet = new Set<string>();
  for (const pos of playerShortestPath.path) {
    playerPathSet.add(`${pos.r},${pos.c}`);
  }
  
  const aiPathSet = new Set<string>();
  for (const pos of aiShortestPath.path) {
    aiPathSet.add(`${pos.r},${pos.c}`);
  }

  // Find threat moves that should be blocked
  const threatMoves = findThreatMoves(board, 'AI');
  const threatSet = new Set(threatMoves.map(t => `${t.r},${t.c}`));

  for (const empty of emptyCells) {
    let score = 0;
    const moveKey = `${empty.r},${empty.c}`;
    
    // ULTIMATE PRIORITY: Block player's shortest path positions
    // This is the most critical defensive move
    if (playerPathSet.has(moveKey)) {
      // Higher score if player is close to winning
      if (playerShortestPath.distance <= 2) {
        score += 200; // Critical - player can win in 2 moves
      } else if (playerShortestPath.distance <= 3) {
        score += 150; // Very high - player can win in 3 moves
      } else {
        score += 120; // High - blocking shortest path
      }
    }
    
    // HIGHEST PRIORITY: Block critical positions (positions that would connect player's left and right groups)
    if (pathAnalysis.criticalPositions.some(cp => cp.r === empty.r && cp.c === empty.c)) {
      score += 100; // Critical blocking move
    }
    
    // HIGH PRIORITY: Block predicted player moves (especially those on shortest path)
    if (threatSet.has(moveKey)) {
      score += 50; // Blocking a threat move
    }
    
    // Check if this move would block opponent
    if (wouldBlockOpponent(board, empty, 'AI')) {
      score += 30; // This move blocks player's connection
    }
    
    // OFFENSIVE: If threat level is not critical, also consider advancing AI's own path
    if (pathAnalysis.threatLevel !== 'CRITICAL' && pathAnalysis.threatLevel !== 'HIGH') {
      // Boost score if this move is on AI's shortest path
      if (aiPathSet.has(moveKey)) {
        score += 40; // This advances AI's own connection
      }
      
      // Bonus if adjacent to AI's shortest path
      for (const aiPathPos of aiShortestPath.path) {
        const distance = getHexDistance(empty, aiPathPos);
        if (distance === 1) {
          score += 15; // Adjacent to AI's path - good extension
          break;
        }
      }
    }
    
    // MEDIUM PRIORITY: Block predicted next moves
    const predictedMoves = pathAnalysis.predictedMoves;
    for (let i = 0; i < Math.min(3, predictedMoves.length); i++) {
      const predicted = predictedMoves[i];
      if (predicted.move.r === empty.r && predicted.move.c === empty.c) {
        // Higher score for top predicted moves, especially if on shortest path
        let baseScore = 20 - (i * 5); // 20, 15, 10 for top 3
        if (playerPathSet.has(moveKey)) {
          baseScore *= 2; // Double if also on shortest path
        }
        score += baseScore;
        break;
      }
    }
    
    // STRATEGIC POSITIONING: Only when threat is low
    // When threat is high, focus purely on blocking
    if (pathAnalysis.threatLevel === 'LOW' || pathAnalysis.threatLevel === 'MEDIUM') {
      // Find distance to player's existing pieces
      let minDistanceToPlayer = Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (board.cells[r][c] === 'PLAYER') {
            const distance = getHexDistance(empty, { r, c });
            minDistanceToPlayer = Math.min(minDistanceToPlayer, distance);
          }
        }
      }
      
      // Prefer moves that are 2-3 hex distance from player pieces
      // This creates pressure without being too obvious
      if (minDistanceToPlayer >= 2 && minDistanceToPlayer <= 3) {
        if (minDistanceToPlayer === 2) {
          score += 5;
        } else if (minDistanceToPlayer === 3) {
          score += 3;
        }
      }
      
      // Center control: moves near center are strategically valuable
      const centerDistance = getHexDistance(empty, { r: centerR, c: centerC });
      if (centerDistance <= 2) {
        score += 3;
      }
      
      // Proximity to player pieces: creates pressure
      let nearbyPlayerPieces = 0;
      const neighbors = getValidNeighbors(empty, board.boardSize);
      for (const neighbor of neighbors) {
        if (board.cells[neighbor.r]?.[neighbor.c] === 'PLAYER') {
          nearbyPlayerPieces++;
        }
      }
      if (nearbyPlayerPieces >= 1 && nearbyPlayerPieces <= 2) {
        score += 2; // Some pressure, but not too obvious
      }
    }
    
    // Consider threat level: if threat is high, prioritize blocking over creativity
    if (pathAnalysis.threatLevel === 'CRITICAL' || pathAnalysis.threatLevel === 'HIGH') {
      // Boost scores for blocking moves when threat is high
      // But reduce scores for non-blocking moves
      if (playerPathSet.has(moveKey) || pathAnalysis.criticalPositions.some(cp => cp.r === empty.r && cp.c === empty.c)) {
        score *= 2.0; // Double boost for blocking moves under high threat
      } else {
        score *= 0.3; // Severely reduce non-blocking moves when threat is high
      }
    }
    
    // Consider player's last move for additional context
    if (playerLastMove) {
      const playerMove: Move = { r: playerLastMove.to.r, c: playerLastMove.to.c };
      const distanceToLastMove = getHexDistance(empty, playerMove);
      
      // If player just made a move, consider moves near it (but not too close)
      // Only if threat is not critical
      if (pathAnalysis.threatLevel !== 'CRITICAL' && distanceToLastMove >= 2 && distanceToLastMove <= 4) {
        score += 2;
      }
    }
    
    if (score > 0) {
      candidates.push({ move: empty, score });
    }
  }

  // Sort by score (highest first) and return top candidates
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 10); // Return top 10 candidates (increased from 5 for better selection)
}


/**
 * Calculate hexagonal distance between two positions
 */
function getHexDistance(
  pos1: { r: number; c: number },
  pos2: { r: number; c: number }
): number {
  const dr = pos2.r - pos1.r;
  const dc = pos2.c - pos1.c;
  
  // Convert offset coordinates to cube coordinates
  const x1 = pos1.c - (pos1.r - (pos1.r & 1)) / 2;
  const z1 = pos1.r;
  const y1 = -x1 - z1;
  
  const x2 = pos2.c - (pos2.r - (pos2.r & 1)) / 2;
  const z2 = pos2.r;
  const y2 = -x2 - z2;
  
  // Cube distance
  return (Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(z2 - z1)) / 2;
}

/**
 * Advanced AI Insight Generator
 *
 * Generates sophisticated, intimidating AI insights based on:
 * - MCTS simulation results
 * - Path analysis data
 * - Game state analysis
 * - Player behavior patterns
 *
 * Performance optimized: Uses only pre-calculated data, no additional computation
 */
interface AdvancedInsightData {
  pathAnalysis: {
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    shortestPathDistance: number;
    criticalPositionsCount: number;
    predictedMovesCount: number;
  };
  gameState: {
    turnCount: number;
    emptyCount: number;
    totalCells: number;
    gameProgress: number; // 0-1
    gamePhase: 'early' | 'mid' | 'late' | 'endgame';
  };
  playerBehavior: {
    moveTimeSeconds: number;
    hoverCount: number;
    isBlocking: boolean;
    isExpanding: boolean;
    isCenterMove: boolean;
    isEdgeMove: boolean;
    consecutiveQuickMoves?: number;
    consecutiveSlowMoves?: number;
  };
  aiAnalysis: {
    playerShortestPath: number;
    aiShortestPath: number;
    pathAdvantage: number; // positive = AI advantage
    winProbabilityEstimate: number; // 0-100
    simulationsRun: number;
    branchingFactor: number;
  };
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
}

/**
 * Generate advanced AI insights based on comprehensive game analysis
 * Returns array of insight message keys with optional parameters
 */
function generateAdvancedInsights(data: AdvancedInsightData): string[] {
  const insights: string[] = [];
  const { pathAnalysis, gameState, playerBehavior, aiAnalysis, difficulty } = data;

  // Only generate advanced insights for NEXUS-5 and NEXUS-7
  if (difficulty === "NEXUS-3") {
    return generateBasicInsights(data);
  }

  // ============================================================================
  // PHASE 1: Strategic Analysis Insights (Most Important)
  // ============================================================================

  // Critical threat detection with detailed analysis
  if (pathAnalysis.threatLevel === 'CRITICAL') {
    if (pathAnalysis.shortestPathDistance <= 1) {
      insights.push("gameRoom.log.entropy.advanced.immediateThreat");
    } else if (pathAnalysis.shortestPathDistance <= 2) {
      insights.push(`gameRoom.log.entropy.advanced.criticalPath|${pathAnalysis.shortestPathDistance}`);
    }

    if (pathAnalysis.criticalPositionsCount >= 2) {
      insights.push(`gameRoom.log.entropy.advanced.multipleWinPaths|${pathAnalysis.criticalPositionsCount}`);
    }
  }

  // Path advantage analysis
  if (aiAnalysis.pathAdvantage > 3) {
    insights.push(`gameRoom.log.entropy.advanced.dominantPosition|${aiAnalysis.pathAdvantage}`);
  } else if (aiAnalysis.pathAdvantage < -3) {
    insights.push(`gameRoom.log.entropy.advanced.defensiveMode|${Math.abs(aiAnalysis.pathAdvantage)}`);
  }

  // ============================================================================
  // PHASE 2: Player Behavior Pattern Analysis
  // ============================================================================

  // Quick move patterns
  if (playerBehavior.moveTimeSeconds < 2) {
    if (playerBehavior.isBlocking) {
      insights.push("gameRoom.log.entropy.advanced.panicBlock");
    } else if (playerBehavior.isExpanding) {
      insights.push("gameRoom.log.entropy.advanced.rushExpansion");
    } else {
      insights.push("gameRoom.log.entropy.advanced.impulsiveMove");
    }
  }

  // Long thinking patterns
  if (playerBehavior.moveTimeSeconds > 25) {
    if (playerBehavior.hoverCount > 8) {
      insights.push("gameRoom.log.entropy.advanced.deepUncertainty");
    } else if (playerBehavior.isBlocking) {
      insights.push("gameRoom.log.entropy.advanced.calculatedDefense");
    } else {
      insights.push("gameRoom.log.entropy.advanced.prolongedAnalysis");
    }
  }

  // Hesitation patterns
  if (playerBehavior.hoverCount > 5 && playerBehavior.hoverCount <= 10) {
    insights.push("gameRoom.log.entropy.advanced.visibleHesitation");
  } else if (playerBehavior.hoverCount > 10) {
    insights.push(`gameRoom.log.entropy.advanced.extremeHesitation|${playerBehavior.hoverCount}`);
  }

  // ============================================================================
  // PHASE 3: Game Phase Specific Insights
  // ============================================================================

  if (gameState.gamePhase === 'early') {
    if (playerBehavior.isCenterMove) {
      insights.push("gameRoom.log.entropy.advanced.earlyCenter");
    } else if (playerBehavior.isEdgeMove) {
      insights.push("gameRoom.log.entropy.advanced.earlyEdge");
    }
  } else if (gameState.gamePhase === 'late' || gameState.gamePhase === 'endgame') {
    if (gameState.emptyCount <= 15) {
      insights.push(`gameRoom.log.entropy.advanced.endgameCalculation|${gameState.emptyCount}`);
    }
    if (aiAnalysis.winProbabilityEstimate > 70) {
      insights.push(`gameRoom.log.entropy.advanced.highWinProbability|${aiAnalysis.winProbabilityEstimate.toFixed(1)}`);
    } else if (aiAnalysis.winProbabilityEstimate < 30) {
      insights.push(`gameRoom.log.entropy.advanced.lowWinProbability|${aiAnalysis.winProbabilityEstimate.toFixed(1)}`);
    }
  }

  // ============================================================================
  // PHASE 4: NEXUS-7 Exclusive "Alien" Insights
  // ============================================================================

  if (difficulty === "NEXUS-7") {
    insights.push(...generateAlienInsights(data));
  }

  // Return top 2-3 most relevant insights to avoid message flooding
  return insights.slice(0, 3);
}

/**
 * Generate NEXUS-7 exclusive "Alien" style insights
 * These are designed to feel uncanny and unsettling
 */
function generateAlienInsights(data: AdvancedInsightData): string[] {
  const insights: string[] = [];
  const { pathAnalysis, gameState, playerBehavior, aiAnalysis } = data;

  // Probability-based observations
  if (aiAnalysis.winProbabilityEstimate > 0) {
    const prob = aiAnalysis.winProbabilityEstimate;

    if (prob > 85) {
      insights.push(`gameRoom.log.entropy.alien.inevitableVictory|${prob.toFixed(1)}`);
    } else if (prob > 65) {
      insights.push(`gameRoom.log.entropy.alien.favorableOutcome|${prob.toFixed(1)}`);
    } else if (prob < 35) {
      insights.push(`gameRoom.log.entropy.alien.unexpectedResistance|${prob.toFixed(1)}`);
    }
  }

  // Pattern recognition observations
  if (playerBehavior.moveTimeSeconds < 3 && playerBehavior.hoverCount < 2) {
    insights.push("gameRoom.log.entropy.alien.instinctivePattern");
  } else if (playerBehavior.moveTimeSeconds > 20 && playerBehavior.hoverCount > 5) {
    insights.push("gameRoom.log.entropy.alien.deliberatePattern");
  }

  // Path analysis observations
  if (pathAnalysis.shortestPathDistance <= 3) {
    insights.push(`gameRoom.log.entropy.alien.pathConvergence|${pathAnalysis.shortestPathDistance}`);
  }

  // Simulation depth observations
  if (aiAnalysis.simulationsRun > 5000) {
    insights.push(`gameRoom.log.entropy.alien.deepSimulation|${Math.floor(aiAnalysis.simulationsRun / 1000)}`);
  }

  // Game progress observations
  if (gameState.gameProgress > 0.7) {
    const movesRemaining = gameState.emptyCount;
    insights.push(`gameRoom.log.entropy.alien.endgameProjection|${movesRemaining}`);
  }

  // Branching factor observations (complexity awareness)
  if (aiAnalysis.branchingFactor > 50) {
    insights.push(`gameRoom.log.entropy.alien.complexityAnalysis|${aiAnalysis.branchingFactor}`);
  }

  return insights;
}

/**
 * Generate basic insights for NEXUS-3 difficulty
 */
function generateBasicInsights(data: AdvancedInsightData): string[] {
  const insights: string[] = [];
  const { pathAnalysis, playerBehavior } = data;

  if (pathAnalysis.threatLevel === 'CRITICAL' || pathAnalysis.threatLevel === 'HIGH') {
    insights.push("gameRoom.log.entropy.basic.defensivePlay");
  }

  if (playerBehavior.moveTimeSeconds < 3) {
    insights.push("gameRoom.log.entropy.basic.quickDecision");
  } else if (playerBehavior.moveTimeSeconds > 20) {
    insights.push("gameRoom.log.entropy.basic.carefulThinking");
  }

  return insights.slice(0, 1); // Only 1 insight for NEXUS-3
}

/**
 * Calculate win probability estimate based on path analysis
 * This is a heuristic estimate, not actual MCTS win rate
 * Performance: O(1) - uses pre-calculated path distances
 */
function estimateWinProbability(
  playerShortestPath: number,
  aiShortestPath: number,
  gameProgress: number,
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): number {
  // Base probability from path advantage
  const pathDiff = playerShortestPath - aiShortestPath;
  let baseProbability = 50 + (pathDiff * 5);

  // Adjust based on threat level
  switch (threatLevel) {
    case 'CRITICAL':
      baseProbability -= 25;
      break;
    case 'HIGH':
      baseProbability -= 15;
      break;
    case 'MEDIUM':
      baseProbability -= 5;
      break;
    case 'LOW':
      baseProbability += 10;
      break;
  }

  // Game progress affects certainty
  const progressMultiplier = 0.5 + (gameProgress * 0.5);
  baseProbability = 50 + (baseProbability - 50) * progressMultiplier;

  // Clamp to valid range
  return Math.max(5, Math.min(95, baseProbability));
}

/**
 * Analyze player psychology based on their move
 * Enhanced with strategic context, game phase, and board state analysis
 */
function analyzePlayerPsychology(
  board: BoardState,
  playerMove: PlayerMove | null,
  turnCount?: number
): string {
  if (!playerMove) {
    return "gameRoom.log.entropy.observing";
  }

  const moveTime = playerMove.moveTimeSeconds || 0;
  const hoverCount = playerMove.hoverCount || 0;
  const playerMovePos: Move = { r: playerMove.to.r, c: playerMove.to.c };
  
  // Analyze strategic context of the move
  const pathAnalysis = analyzePlayerPath(board);
  const aiShortestPath = calculateShortestPath(board, 'AI');
  const playerShortestPath = calculateShortestPath(board, 'PLAYER');
  
  // Check if player's move blocks AI's path
  const blocksAI = wouldBlockOpponent(board, playerMovePos, 'PLAYER');
  
  // Check if player's move is on their own shortest path
  const onPlayerPath = playerShortestPath.path.some(
    pos => pos.r === playerMovePos.r && pos.c === playerMovePos.c
  );
  
  // Check if player's move is on AI's shortest path (blocking)
  const onAIPath = aiShortestPath.path.some(
    pos => pos.r === playerMovePos.r && pos.c === playerMovePos.c
  );
  
  // Check if move is in center or edge
  const { rows, cols } = board.boardSize;
  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);
  const distanceFromCenter = getHexDistance(playerMovePos, { r: centerR, c: centerC });
  const isCenterMove = distanceFromCenter <= 2;
  const isEdgeMove = playerMovePos.c === 0 || playerMovePos.c === cols - 1 || 
                     playerMovePos.r === 0 || playerMovePos.r === rows - 1;
  
  // Determine game phase
  const totalCells = rows * cols;
  const emptyCells = getEmptyCells(board);
  const emptyCount = emptyCells.length;
  const gamePhase = turnCount && turnCount < totalCells * 0.3 ? 'early' :
                   turnCount && turnCount < totalCells * 0.7 ? 'mid' : 'late';
  
  // Check if move is on critical position
  const isCritical = pathAnalysis.criticalPositions.some(
    cp => cp.r === playerMovePos.r && cp.c === playerMovePos.c
  );
  
  // Strategic move analysis with priority order
  
  // 1. Critical blocking move (highest priority)
  if (blocksAI && isCritical) {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.quickBlocking";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.hesitationBlocking";
    }
    if (moveTime > 30) {
      return "gameRoom.log.entropy.psychology.longThinkBlocking";
    }
    return "gameRoom.log.entropy.psychology.blockingMove";
  }
  
  // 2. AI path blocking (not critical but still blocking)
  if (blocksAI || onAIPath) {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.quickAIBlock";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.hesitationAIBlock";
    }
    return "gameRoom.log.entropy.psychology.aiBlocking";
  }
  
  // 3. Player path extension (aggressive)
  if (onPlayerPath) {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.quickExpansion";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.hesitationExpansion";
    }
    if (moveTime > 30) {
      return "gameRoom.log.entropy.psychology.longThinkExpansion";
    }
    return "gameRoom.log.entropy.psychology.pathExtension";
  }
  
  // 4. Center control (aggressive)
  if (isCenterMove && !isEdgeMove) {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.quickCenter";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.hesitationCenter";
    }
    return "gameRoom.log.entropy.psychology.centerControl";
  }
  
  // 5. Edge move (defensive)
  if (isEdgeMove) {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.quickEdge";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.hesitationEdge";
    }
    if (moveTime > 30) {
      return "gameRoom.log.entropy.psychology.longThinkEdge";
    }
    return "gameRoom.log.entropy.psychology.defensiveEdge";
  }
  
  // 6. Game phase specific analysis
  if (gamePhase === 'early') {
    if (moveTime < 3 && hoverCount < 3) {
      return "gameRoom.log.entropy.psychology.earlyQuick";
    }
    if (hoverCount > 5) {
      return "gameRoom.log.entropy.psychology.earlyHesitation";
    }
    return "gameRoom.log.entropy.psychology.earlyGame";
  }
  
  if (gamePhase === 'late') {
    if (emptyCount <= 10) {
      if (moveTime < 3 && hoverCount < 3) {
        return "gameRoom.log.entropy.psychology.lateQuick";
      }
      if (hoverCount > 5) {
        return "gameRoom.log.entropy.psychology.lateHesitation";
      }
      if (moveTime > 30) {
        return "gameRoom.log.entropy.psychology.lateLongThink";
      }
      return "gameRoom.log.entropy.psychology.endgame";
    }
  }
  
  // 7. Fallback to time-based analysis
  if (moveTime < 3 && hoverCount < 3) {
    return "gameRoom.log.entropy.psychology.quickMove";
  }
  
  if (hoverCount > 5) {
    return "gameRoom.log.entropy.psychology.hesitation";
  }
  
  if (moveTime > 30) {
    return "gameRoom.log.entropy.psychology.longThink";
  }
  
  return "gameRoom.log.entropy.observing";
}

/**
 * Get AI move using enhanced MCTS algorithm
 *
 * ENHANCED with:
 * - Opening book for first moves
 * - Endgame solver for perfect late-game play
 * - Virtual connection awareness
 * - RAVE-enhanced MCTS with iterative deepening
 *
 * @param board - Current board state
 * @param playerLastMove - Player's last move (for psychological analysis)
 * @param difficulty - AI difficulty level
 * @param turnCount - Current turn count
 * @param boardHistory - History of board states
 * @returns AI move result with reasoning
 */
export async function getAIMove(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): Promise<AIMoveResult> {
  try {
    // Validate board state
    if (!board || !board.boardSize || !board.cells) {
      console.error("getAIMove: Invalid board state", board);
      return {
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }

    // Check if AI has already won
    if (isConnected(board, 'AI')) {
      return {
        move: null,
        logs: ["gameRoom.log.entropy.aiWon"],
      };
    }

    // Check if player has already won
    if (isConnected(board, 'PLAYER')) {
      return {
        move: null,
        logs: ["gameRoom.log.entropy.playerWon"],
      };
    }

    const validMoves = getValidMoves(board);

    if (validMoves.length === 0) {
      return {
        move: null,
        logs: ["gameRoom.log.entropy.noMoves"],
      };
    }

    // If only one move available, return it
    if (validMoves.length === 1) {
      const move: GameMove = {
        from: { r: -1, c: -1 }, // No from position in Hex
        to: validMoves[0],
      };
      return {
        move,
        logs: ["gameRoom.log.moveExecuted"],
      };
    }

    // Check for immediate win
    for (const move of validMoves) {
      if (wouldWin(board, move, 'AI')) {
        const gameMove: GameMove = {
          from: { r: -1, c: -1 },
          to: move,
        };
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.winningMove"],
        };
      }
    }

    // Check for blocking opponent's immediate win
    for (const move of validMoves) {
      if (wouldWin(board, move, 'PLAYER')) {
        const gameMove: GameMove = {
          from: { r: -1, c: -1 },
          to: move,
        };
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.blockingWin"],
        };
      }
    }

    // ==========================================================================
    // PHASE 0: Opening Book (for early game)
    // ==========================================================================
    if (isOpeningPhase(board)) {
      const openingMove = getOpeningBookMove(board, difficulty);
      if (openingMove) {
        // Verify the move is valid
        const isValid = validMoves.some(m => m.r === openingMove.r && m.c === openingMove.c);
        if (isValid) {
          const gameMove: GameMove = {
            from: { r: -1, c: -1 },
            to: openingMove,
          };
          return {
            move: gameMove,
            logs: ["gameRoom.log.entropy.openingBook"],
          };
        }
      }
    }

    // ==========================================================================
    // PHASE 1: Endgame Solver (for late game - NEXUS-5 and NEXUS-7 only)
    // ==========================================================================
    if (shouldUseEndgameSolver(board, difficulty)) {
      try {
        const emptyCells = getEmptyCells(board);
        const depth = getEndgameDepth(emptyCells.length, difficulty);
        const timeLimit = getEndgameTimeLimit(difficulty);

        const endgameResult = solveEndgame(board, depth, timeLimit);

        if (endgameResult.move && endgameResult.solved) {
          const gameMove: GameMove = {
            from: { r: -1, c: -1 },
            to: endgameResult.move,
          };

          // Clear transposition table to free memory
          clearTranspositionTable();

          const logMessage = endgameResult.score > 0
            ? "gameRoom.log.entropy.endgameSolved"
            : "gameRoom.log.entropy.endgameDefense";

          return {
            move: gameMove,
            logs: [logMessage],
          };
        }

        // Clear transposition table even if not solved
        clearTranspositionTable();
      } catch (error) {
        console.warn('[Evaluation] Endgame solver failed:', error);
        // Continue to MCTS if endgame solver fails
      }
    }

    // Analyze player's path to understand their connection strategy
    const pathAnalysis = analyzePlayerPath(board);
    
    // Determine game phase and board state for contextual logging
    const { rows, cols } = board.boardSize;
    const totalCells = rows * cols;
    const emptyCount = validMoves.length;
    const filledCount = totalCells - emptyCount;
    const gamePhase = turnCount && turnCount < totalCells * 0.3 ? 'early' :
                     turnCount && turnCount < totalCells * 0.7 ? 'mid' : 'late';
    const boardDensity = filledCount / totalCells;
    
    // Generate game phase log message
    let phaseLogMessage: string | null = null;
    if (gamePhase === 'early' && turnCount && turnCount <= 5) {
      phaseLogMessage = "gameRoom.log.entropy.phase.early";
    } else if (gamePhase === 'mid') {
      phaseLogMessage = "gameRoom.log.entropy.phase.mid";
    } else if (gamePhase === 'late') {
      if (emptyCount <= 10) {
        phaseLogMessage = "gameRoom.log.entropy.phase.lateCritical";
      } else {
        phaseLogMessage = "gameRoom.log.entropy.phase.late";
      }
    }
    
    // Generate threat level log message
    let threatLogMessage: string | null = null;
    if (pathAnalysis.threatLevel === 'CRITICAL') {
      threatLogMessage = "gameRoom.log.entropy.threat.critical";
    } else if (pathAnalysis.threatLevel === 'HIGH') {
      threatLogMessage = "gameRoom.log.entropy.threat.high";
    } else if (pathAnalysis.threatLevel === 'MEDIUM') {
      threatLogMessage = "gameRoom.log.entropy.threat.medium";
    }
    
    // Check for immediate block (prevent player from winning)
    // PRIORITY 1: Block critical positions that would connect player's left and right groups
    if (pathAnalysis.criticalPositions.length > 0) {
      // Find the best blocking move among critical positions
      let bestBlockingMove: Move | null = null;
      let bestBlockingScore = -1;
      
      for (const critical of pathAnalysis.criticalPositions) {
        // Check if this critical position is a valid move
        const isValid = validMoves.some(m => m.r === critical.r && m.c === critical.c);
        if (isValid) {
          // Score based on how well this blocks
          const blockingScore = wouldBlockOpponent(board, critical, 'AI') ? 100 : 50;
          if (blockingScore > bestBlockingScore) {
            bestBlockingScore = blockingScore;
            bestBlockingMove = critical;
          }
        }
      }
      
      if (bestBlockingMove) {
        const gameMove: GameMove = {
          from: { r: -1, c: -1 },
          to: bestBlockingMove,
        };
        // Critical position blocking - more specific log message
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.blockingCritical"],
        };
      }
    }
    
    // PRIORITY 2: Block immediate winning moves
    for (const move of validMoves) {
      if (wouldWin(board, move, 'PLAYER')) {
        const gameMove: GameMove = {
          from: { r: -1, c: -1 },
          to: move,
        };
        // Immediate win prevention - urgent blocking message
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.blockingWin"],
        };
      }
    }
    
    // PRIORITY 3: Block high-threat moves based on path analysis and shortest path
    if (pathAnalysis.threatLevel === 'CRITICAL' || pathAnalysis.threatLevel === 'HIGH') {
      // Calculate player's shortest path to find the most critical blocking positions
      const playerShortestPath = calculateShortestPath(board, 'PLAYER');
      const playerPathSet = new Set<string>();
      for (const pos of playerShortestPath.path) {
        playerPathSet.add(`${pos.r},${pos.c}`);
      }
      
      // First, try to block positions on player's shortest path
      for (const pathPos of playerShortestPath.path) {
        const isValid = validMoves.some(m => m.r === pathPos.r && m.c === pathPos.c);
        if (isValid) {
          const gameMove: GameMove = {
            from: { r: -1, c: -1 },
            to: pathPos,
          };
          // Shortest path blocking - strategic blocking message
          const blockingLog = pathAnalysis.threatLevel === 'CRITICAL' 
            ? "gameRoom.log.entropy.blockingPathCritical"
            : "gameRoom.log.entropy.blockingPath";
          return {
            move: gameMove,
            logs: [blockingLog],
          };
        }
      }
      
      // Fallback: Block other threat moves
      const threatMoves = findThreatMoves(board, 'AI');
      // Find the best blocking move among threats
      for (const threat of threatMoves.slice(0, 3)) { // Top 3 threats
        const isValid = validMoves.some(m => m.r === threat.r && m.c === threat.c);
        if (isValid && wouldBlockOpponent(board, threat, 'AI')) {
          const gameMove: GameMove = {
            from: { r: -1, c: -1 },
            to: threat,
          };
          // Threat move blocking - defensive message
          return {
            move: gameMove,
            logs: ["gameRoom.log.entropy.blockingThreat"],
          };
        }
      }
    }

    // Use MCTS to find best move (primary decision maker)
    // MCTS now uses path analysis to predict player moves in simulations
    const config = getMCTSConfig(difficulty);

    // Use Worker Pool for parallel MCTS computation (async)
    // This will distribute simulations across 4-8 Workers for 2-4x speedup
    let bestMove: Move | null = null;

    try {
      const workerPool = getMCTSWorkerPool();
      bestMove = await workerPool.calculateMove(board, 'AI', config, pathAnalysis.threatLevel);
    } catch (error) {
      // Fallback to async MCTS if Worker Pool fails
      console.warn('[Evaluation] Worker Pool failed, using fallback MCTS:', error);
      bestMove = await runMCTS(board, 'AI', config, pathAnalysis.threatLevel);
    }
    
    // Analyze MCTS result quality
    let mctsLogMessage: string | null = null;
    if (bestMove) {
      // Check if MCTS found a winning move
      if (wouldWin(board, bestMove, 'AI')) {
        mctsLogMessage = "gameRoom.log.entropy.mcts.winningPath";
      } else if (validMoves.length > 10) {
        // Many candidates - MCTS evaluated multiple options
        mctsLogMessage = "gameRoom.log.entropy.mcts.multipleCandidates";
      } else {
        // Few candidates - more focused analysis
        mctsLogMessage = "gameRoom.log.entropy.mcts.focusedAnalysis";
      }
    } else {
      // MCTS returned null - will use fallback
      mctsLogMessage = "gameRoom.log.entropy.mcts.noResult";
    }

    // For NEXUS-5 and NEXUS-7, integrate path analysis with MCTS result
    // IMPORTANT: When threat is high, prioritize blocking over "Move 37" creativity
    let selectedMove: Move | null = bestMove;
    let logMessage = "gameRoom.log.moveExecuted";
    
    // Add difficulty-specific analysis depth log
    let difficultyLogMessage: string | null = null;
    if (difficulty === "NEXUS-3") {
      difficultyLogMessage = "gameRoom.log.entropy.difficulty.nexus3";
    } else if (difficulty === "NEXUS-5") {
      difficultyLogMessage = "gameRoom.log.entropy.difficulty.nexus5";
    } else if (difficulty === "NEXUS-7") {
      difficultyLogMessage = "gameRoom.log.entropy.difficulty.nexus7";
    }
    
    // Priority: MCTS log > phase log > threat log > difficulty log > default
    if (mctsLogMessage) {
      logMessage = mctsLogMessage;
    } else if (phaseLogMessage) {
      logMessage = phaseLogMessage;
    } else if (threatLogMessage) {
      logMessage = threatLogMessage;
    } else if (difficultyLogMessage) {
      logMessage = difficultyLogMessage;
    }

    if (bestMove && (difficulty === "NEXUS-5" || difficulty === "NEXUS-7")) {
      const strategicMoves = detectStrategicMoves(board, playerLastMove);
      
      // When threat is high, prioritize blocking moves over creative moves
      if (pathAnalysis.threatLevel === 'CRITICAL' || pathAnalysis.threatLevel === 'HIGH') {
        // Find the highest scoring blocking move
        for (const strategic of strategicMoves) {
          // Only consider moves that actually block (high score from blocking)
          if (strategic.score >= 100) { // High score indicates blocking move
            selectedMove = strategic.move;
            // Use more specific blocking message based on threat level
            logMessage = pathAnalysis.threatLevel === 'CRITICAL'
              ? "gameRoom.log.entropy.blockingStrategicCritical"
              : "gameRoom.log.entropy.blockingStrategic";
            break;
          }
        }
      } else {
        // When threat is low, allow "Move 37" style creativity
        // Check if any strategic move (based on path analysis) aligns with MCTS result
        // This indicates MCTS found a similar strategic position, confirming its value
        for (const strategic of strategicMoves) {
          const distance = getHexDistance(strategic.move, bestMove);
          if (distance <= 1 && strategic.score >= 20) {
            // MCTS and path analysis agree - this is a high-quality strategic move
            selectedMove = strategic.move;
            logMessage = "gameRoom.log.entropy.move37";
            break;
          }
        }
        
        // For NEXUS-7: If we have a very high-scoring strategic move that blocks threats,
        // consider it even if MCTS didn't find it (rare but important for defense)
        if (selectedMove === bestMove && difficulty === "NEXUS-7" && strategicMoves.length > 0) {
          const topStrategic = strategicMoves[0];
          // Use if strategic move has very high score (blocking critical positions or threats)
          if (topStrategic.score >= 50) {
            const distance = getHexDistance(topStrategic.move, bestMove);
            // If strategic move is reasonably close (within 3 hex), it's a valid alternative
            // This ensures we don't miss critical blocking opportunities
            if (distance <= 3) {
              selectedMove = topStrategic.move;
              logMessage = "gameRoom.log.entropy.move37";
            }
          }
        }
      }
    }
    
    // For NEXUS-3: Use simpler path analysis for blocking
    if (difficulty === "NEXUS-3" && pathAnalysis.threatLevel !== 'LOW') {
      const strategicMoves = detectStrategicMoves(board, playerLastMove);
      if (strategicMoves.length > 0 && strategicMoves[0].score >= 30) {
        // Use top strategic move if it's a clear blocking move
        const topStrategic = strategicMoves[0];
        if (wouldBlockOpponent(board, topStrategic.move, 'AI')) {
          selectedMove = topStrategic.move;
          // Use simpler blocking message for NEXUS-3
          logMessage = "gameRoom.log.entropy.blockingBasic";
        }
      }
    }
    
    // Fallback: if MCTS failed, use first valid move
    if (!selectedMove) {
      if (validMoves.length > 0) {
        selectedMove = validMoves[0];
        // MCTS failed, using fallback
        logMessage = "gameRoom.log.entropy.mctsFallback";
      } else {
        // No valid moves available - this should not happen
        return {
          move: null,
          logs: ["gameRoom.log.entropy.error.noValidMoves"],
        };
      }
    }

    if (!selectedMove) {
      return {
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }

    const gameMove: GameMove = {
      from: { r: -1, c: -1 },
      to: selectedMove,
    };

    // Generate psychological analysis
    const psychology = analyzePlayerPsychology(board, playerLastMove, turnCount);

    // ============================================================================
    // ADVANCED AI INSIGHT SYSTEM
    // Generates sophisticated, intimidating insights based on game analysis
    // Performance optimized: Uses only pre-calculated data
    // ============================================================================

    // Calculate comprehensive game state data for insight generation
    const currentEmptyCount = validMoves.length;
    const currentTotalCells = board.boardSize.rows * board.boardSize.cols;
    const currentFilledCount = currentTotalCells - currentEmptyCount;
    const currentGameProgress = currentFilledCount / currentTotalCells;

    // Calculate path distances for win probability estimation
    const currentPlayerShortestPath = calculateShortestPath(board, 'PLAYER');
    const currentAiShortestPath = calculateShortestPath(board, 'AI');
    const currentPathAdvantage = currentPlayerShortestPath.distance - currentAiShortestPath.distance;

    // Determine game phase for insight context
    const currentGamePhase = currentGameProgress < 0.25 ? 'early' :
                             currentGameProgress < 0.5 ? 'mid' :
                             currentGameProgress < 0.75 ? 'late' : 'endgame';

    // Analyze player behavior from their last move
    const moveTime = playerLastMove?.moveTimeSeconds || 0;
    const hoverCount = playerLastMove?.hoverCount || 0;
    const playerMovePos = playerLastMove ? { r: playerLastMove.to.r, c: playerLastMove.to.c } : null;

    // Determine if player is blocking or expanding
    const isPlayerBlocking = playerMovePos ? wouldBlockOpponent(board, playerMovePos, 'PLAYER') : false;
    const isPlayerExpanding = playerMovePos ? currentPlayerShortestPath.path.some(
      pos => pos.r === playerMovePos.r && pos.c === playerMovePos.c
    ) : false;

    // Check move position type
    const centerR = Math.floor(rows / 2);
    const centerC = Math.floor(cols / 2);
    const isPlayerCenterMove = playerMovePos ?
      getHexDistance(playerMovePos, { r: centerR, c: centerC }) <= 2 : false;
    const isPlayerEdgeMove = playerMovePos ?
      (playerMovePos.c === 0 || playerMovePos.c === cols - 1 ||
       playerMovePos.r === 0 || playerMovePos.r === rows - 1) : false;

    // Calculate win probability estimate
    const winProbability = estimateWinProbability(
      currentPlayerShortestPath.distance,
      currentAiShortestPath.distance,
      currentGameProgress,
      pathAnalysis.threatLevel
    );

    // Build insight data structure
    const insightData: AdvancedInsightData = {
      pathAnalysis: {
        threatLevel: pathAnalysis.threatLevel,
        shortestPathDistance: pathAnalysis.shortestPathDistance,
        criticalPositionsCount: pathAnalysis.criticalPositions.length,
        predictedMovesCount: pathAnalysis.predictedMoves.length,
      },
      gameState: {
        turnCount: turnCount || 0,
        emptyCount: currentEmptyCount,
        totalCells: currentTotalCells,
        gameProgress: currentGameProgress,
        gamePhase: currentGamePhase,
      },
      playerBehavior: {
        moveTimeSeconds: moveTime,
        hoverCount: hoverCount,
        isBlocking: isPlayerBlocking,
        isExpanding: isPlayerExpanding,
        isCenterMove: isPlayerCenterMove,
        isEdgeMove: isPlayerEdgeMove,
      },
      aiAnalysis: {
        playerShortestPath: currentPlayerShortestPath.distance,
        aiShortestPath: currentAiShortestPath.distance,
        pathAdvantage: currentPathAdvantage,
        winProbabilityEstimate: winProbability,
        simulationsRun: config.simulations,
        branchingFactor: currentEmptyCount,
      },
      difficulty,
    };

    // Generate advanced insights
    const advancedInsights = generateAdvancedInsights(insightData);

    // Combine all logs with priority ordering
    const allLogs = [logMessage, ...advancedInsights, psychology].filter(Boolean);

    return {
      move: gameMove,
      logs: allLogs,
    };
  } catch (error) {
    console.error("Error in getAIMove:", error);
    // Try to provide more specific error message
    if (error instanceof Error) {
      if (error.message.includes("board") || error.message.includes("parse")) {
        return {
          move: null,
          logs: ["gameRoom.log.entropy.error.invalidBoard"],
        };
      }
    }
    return {
      move: null,
      logs: ["gameRoom.log.calculationErrorKo"],
    };
  }
}
