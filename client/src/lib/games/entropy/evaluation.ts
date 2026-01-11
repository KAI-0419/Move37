/**
 * ENTROPY Evaluation Functions
 * 
 * Functions for evaluating board positions and calculating AI moves.
 * Uses MCTS algorithm with Web Worker support.
 * Implements "Move 37" strategy for advanced play.
 */

import type { BoardState, Move, Player } from "./types";
import type { GameMove, PlayerMove, AIMoveResult } from "@shared/gameEngineInterface";
import { parseBoardState } from "./boardUtils";
import { isConnected, wouldWin, getEmptyCells } from "./connectionCheck";
import { getValidMoves, getMovesNearOpponent, wouldBlockOpponent, findThreatMoves } from "./moveValidation";
import { runMCTS, type MCTSConfig } from "./mcts";
import { getValidNeighbors } from "./boardUtils";
import { analyzePlayerPath, findCriticalPositions, predictPlayerNextMove, calculateShortestPath } from "./pathAnalysis";

/**
 * Get MCTS configuration based on difficulty
 * 
 * Optimized parameters for each difficulty level:
 * - NEXUS-3 (일반인): Balanced exploration/exploitation, moderate simulations
 * - NEXUS-5 (전문가): Higher exploitation, more simulations for deeper analysis
 * - NEXUS-7 (인간 초월): Maximum exploitation with strategic depth, highest simulations
 */
function getMCTSConfig(
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): MCTSConfig {
  switch (difficulty) {
    case "NEXUS-3":
      // 일반인 수준: 적절한 탐색과 활용의 균형
      // UCB1 상수를 약간 높여 탐색을 장려 (약간의 실수 허용)
      return {
        simulations: 1000,
        ucb1Constant: Math.sqrt(2) * 1.1, // 약간 높은 탐색
        timeLimit: 3000, // 3 seconds
      };
    case "NEXUS-5":
      // 전문가 수준: 더 깊은 분석과 전략적 사고
      // 표준 UCB1로 균형잡힌 탐색/활용, 더 많은 시뮬레이션
      return {
        simulations: 3000,
        ucb1Constant: Math.sqrt(2), // 표준 균형
        timeLimit: 5000, // 5 seconds
      };
    case "NEXUS-7":
      // 인간 초월: 최대한의 전략적 깊이
      // 약간 낮은 UCB1로 활용 우선 (이미 좋은 수를 찾았으면 더 탐색)
      return {
        simulations: 5000,
        ucb1Constant: Math.sqrt(2) * 0.9, // 활용 우선
        timeLimit: 8000, // 8 seconds
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

  // Quick move analysis
  if (moveTime < 3 && hoverCount < 3) {
    return "gameRoom.log.entropy.psychology.quickMove";
  }

  // Hesitation analysis
  if (hoverCount > 5) {
    return "gameRoom.log.entropy.psychology.hesitation";
  }

  // Long thinking
  if (moveTime > 30) {
    return "gameRoom.log.entropy.psychology.longThink";
  }

  return "gameRoom.log.entropy.observing";
}

/**
 * Get AI move using MCTS algorithm
 * 
 * @param board - Current board state
 * @param playerLastMove - Player's last move (for psychological analysis)
 * @param difficulty - AI difficulty level
 * @param turnCount - Current turn count
 * @param boardHistory - History of board states
 * @returns AI move result with reasoning
 */
export function getAIMove(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): AIMoveResult {
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

    // Analyze player's path to understand their connection strategy
    const pathAnalysis = analyzePlayerPath(board);
    
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
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.blockingMove"],
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
        return {
          move: gameMove,
          logs: ["gameRoom.log.entropy.blockingMove"],
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
          return {
            move: gameMove,
            logs: ["gameRoom.log.entropy.blockingMove"],
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
          return {
            move: gameMove,
            logs: ["gameRoom.log.entropy.blockingMove"],
          };
        }
      }
    }

    // Use MCTS to find best move (primary decision maker)
    // MCTS now uses path analysis to predict player moves in simulations
    const config = getMCTSConfig(difficulty);
    const bestMove = runMCTS(board, 'AI', config);

    // For NEXUS-5 and NEXUS-7, integrate path analysis with MCTS result
    // IMPORTANT: When threat is high, prioritize blocking over "Move 37" creativity
    let selectedMove: Move | null = bestMove;
    let logMessage = "gameRoom.log.moveExecuted";

    if (bestMove && (difficulty === "NEXUS-5" || difficulty === "NEXUS-7")) {
      const strategicMoves = detectStrategicMoves(board, playerLastMove);
      
      // When threat is high, prioritize blocking moves over creative moves
      if (pathAnalysis.threatLevel === 'CRITICAL' || pathAnalysis.threatLevel === 'HIGH') {
        // Find the highest scoring blocking move
        for (const strategic of strategicMoves) {
          // Only consider moves that actually block (high score from blocking)
          if (strategic.score >= 100) { // High score indicates blocking move
            selectedMove = strategic.move;
            logMessage = "gameRoom.log.entropy.blockingMove";
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
          logMessage = "gameRoom.log.entropy.blockingMove";
        }
      }
    }
    
    // Fallback: if MCTS failed, use first valid move
    if (!selectedMove) {
      selectedMove = validMoves[0];
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

    return {
      move: gameMove,
      logs: [logMessage, psychology],
    };
  } catch (error) {
    console.error("Error in getAIMove:", error);
    return {
      move: null,
      logs: ["gameRoom.log.calculationErrorKo"],
    };
  }
}
