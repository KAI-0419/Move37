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
 */
function getMCTSConfig(
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): MCTSConfig {
  switch (difficulty) {
    case "NEXUS-3":
      // 일반인 수준: 캐주얼 플레이어가 이길 수 있음
      // Intentionally weak for learning the game
      return {
        simulations: 800, // Low simulation count
        ucb1Constant: Math.sqrt(2) * 1.3, // High exploration = more random
        timeLimit: 2000, // Short time limit
        personality: 'BALANCED',
        dynamicUCB1: false, // Disable for simpler play
        useRAVE: false, // No RAVE (weaker)
        raveConstant: 0,
        iterativeDeepening: false, // Don't use full time
      };

    case "NEXUS-5":
      // HEX 전문가 수준: 강하지만 전문가에게는 패배 가능
      // Strong tactical play with solid strategy
      return {
        simulations: 4000, // Medium-high simulation count
        ucb1Constant: Math.sqrt(2) * 0.95, // Slightly favor exploitation
        timeLimit: 6000, // 6 seconds
        personality: 'AGGRESSIVE',
        dynamicUCB1: true,
        useRAVE: true, // RAVE enabled
        raveConstant: 250,
        iterativeDeepening: true, // Use full time budget
      };

    case "NEXUS-7":
      // 인간 초월: 거의 이길 수 없는 최상위 레벨
      // Maximum strength with all optimizations
      return {
        simulations: 10000, // Very high simulation count
        ucb1Constant: Math.sqrt(2) * 0.85, // Strong exploitation
        timeLimit: 10000, // 10 seconds (full budget)
        personality: 'ALIEN', // Unpredictable genius moves
        dynamicUCB1: true,
        useRAVE: true, // Full RAVE
        raveConstant: 400, // Higher RAVE weight
        iterativeDeepening: true, // Use full time budget
      };
  }
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
      // Fallback to synchronous MCTS if Worker Pool fails
      console.warn('[Evaluation] Worker Pool failed, using synchronous MCTS:', error);
      bestMove = runMCTS(board, 'AI', config, pathAnalysis.threatLevel);
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

    // Generate Alien-style log messages for NEXUS-7 (ALIEN personality)
    const alienLogs: string[] = [];
    if (difficulty === "NEXUS-7" && config.personality === 'ALIEN') {
      // Calculate win probability estimate based on board state
      const emptyCount = validMoves.length;
      const totalCells = board.boardSize.rows * board.boardSize.cols;
      const filledCount = totalCells - emptyCount;
      const gameProgress = filledCount / totalCells;
      
      // Calculate shortest path distances for both players
      const playerShortestPath = calculateShortestPath(board, 'PLAYER');
      const aiShortestPath = calculateShortestPath(board, 'AI');
      const pathAdvantage = playerShortestPath.distance - aiShortestPath.distance;
      
      // Generate alien-style messages based on game state
      if (pathAnalysis.threatLevel === 'CRITICAL') {
        alienLogs.push("gameRoom.log.entropy.alien.criticalThreat");
      } else if (selectedMove && wouldWin(board, selectedMove, 'AI')) {
        alienLogs.push("gameRoom.log.entropy.alien.winningMove");
      } else if (gameProgress > 0.7) {
        // Late game: estimate win probability based on path advantage
        let winProb = 50;
        if (pathAdvantage > 2) {
          // AI has path advantage
          winProb = Math.min(95, 50 + (pathAdvantage * 5) + (gameProgress * 15));
          alienLogs.push(`gameRoom.log.entropy.alien.winningProbability|${winProb.toFixed(1)}`);
        } else if (pathAdvantage < -2) {
          // Player has path advantage
          winProb = Math.max(5, 50 - (Math.abs(pathAdvantage) * 5) - (gameProgress * 15));
          alienLogs.push(`gameRoom.log.entropy.alien.playerAdvantage|${winProb.toFixed(1)}`);
        }
      } else if (pathAnalysis.threatLevel === 'LOW' && Math.random() < 0.3) {
        // Random alien observation
        alienLogs.push("gameRoom.log.entropy.alien.observation");
      }
    }

    // Combine all logs
    const allLogs = [logMessage, ...alienLogs, psychology].filter(Boolean);

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
