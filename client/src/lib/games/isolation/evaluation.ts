/**
 * ISOLATION Evaluation Functions
 * 
 * Functions for evaluating board positions and calculating AI moves.
 * Uses Minimax algorithm with Flood Fill-based evaluation.
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

/**
 * [강화] 고도화된 평가 함수
 * 영역 제어, 중앙 점유, 상대방 고립도 등을 종합적으로 평가
 * Returns positive score for AI advantage, negative for player advantage
 */
function evaluateBoard(board: BoardState): number {
  // 1. 기본 이동성 점수 (가중치 1.0) - 가장 중요한 요소
  const playerArea = floodFill(board.playerPos, board);
  const aiArea = floodFill(board.aiPos, board);
  let score = (aiArea - playerArea) * 1.0;
  
  // 2. 중앙 점유 가중치 (초반 주도권 및 전략적 우위)
  const centerR = board.boardSize.rows / 2;
  const centerC = board.boardSize.cols / 2;
  const aiDistToCenter = Math.abs(board.aiPos.r - centerR) + Math.abs(board.aiPos.c - centerC);
  const playerDistToCenter = Math.abs(board.playerPos.r - centerR) + Math.abs(board.playerPos.c - centerC);
  score += (playerDistToCenter - aiDistToCenter) * 0.3;
  
  // 3. 상대방 고립 가중치 (상대방의 남은 칸이 적을수록 기하급수적 가산점)
  // 플레이어가 10칸 이하로 고립되면 강력한 가산점
  if (playerArea < 10) {
    score += (10 - playerArea) * 5.0; // 기하급수적 페널티
  }
  // AI가 10칸 이하로 고립되면 강력한 감점
  if (aiArea < 10) {
    score -= (10 - aiArea) * 5.0;
  }
  
  // 4. 상대방 인접 칸 차단 가중치 (상대방 주변 파괴된 칸 수)
  const playerAdjacent = getAdjacentPositions(board.playerPos, board.boardSize);
  const playerBlockedAdjacent = playerAdjacent.filter(pos => 
    isDestroyed(pos, board.destroyed) || isOccupied(pos, board.playerPos, board.aiPos)
  ).length;
  score += playerBlockedAdjacent * 0.5;
  
  // 5. AI 인접 칸 보호 가중치 (AI 주변 파괴된 칸이 적을수록 좋음)
  const aiAdjacent = getAdjacentPositions(board.aiPos, board.boardSize);
  const aiBlockedAdjacent = aiAdjacent.filter(pos => 
    isDestroyed(pos, board.destroyed) || isOccupied(pos, board.playerPos, board.aiPos)
  ).length;
  score -= aiBlockedAdjacent * 0.5;
  
  return score;
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
  
  // Apply the move
  if (isPlayer) {
    newBoard.playerPos = move.to;
  } else {
    newBoard.aiPos = move.to;
  }
  
  // Apply destroy if present
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
 * [강화] Get all possible moves for a player (including destroy choices)
 * 난이도에 따라 파괴 후보 수를 조정하여 최적의 수를 찾음
 */
function getAllMoves(
  board: BoardState,
  isPlayer: boolean,
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): Array<{ move: GameMove; destroy: { r: number; c: number } }> {
  const position = isPlayer ? board.playerPos : board.aiPos;
  const opponentPos = isPlayer ? board.aiPos : board.playerPos;
  const validMoves = getValidMoves(board, position, isPlayer);
  
  const allMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }> = [];
  
  for (const to of validMoves) {
    const move: GameMove = {
      from: position,
      to,
    };
    
    // Get all possible destroy positions after this move
    const destroyPositions = getValidDestroyPositions(board, to, isPlayer);
    
    // Isolation game requires destroy after every move
    // If no destroy positions available (shouldn't happen), skip this move
    if (destroyPositions.length === 0) {
      console.warn(`getAllMoves: No destroy positions available for move to (${to.r}, ${to.c}), skipping move`);
      continue; // Skip this move - cannot make a move without destroying
    } else {
      // [강화] 파괴 위치 전략적 평가: 더 많은 후보를 고려하되, 전략적 가치가 높은 것 우선
      // 1. 상대방 인접 칸 (최우선)
      // 2. 상대방의 다음 이동 경로 차단
      // 3. 중앙 지역 제어
      // 4. 상대방의 이동 가능 영역 분할
      
      const tempBoardAfterMove: BoardState = {
        ...board,
        playerPos: isPlayer ? to : board.playerPos,
        aiPos: isPlayer ? board.aiPos : to,
      };
      
      const opponentNextMoves = getValidMoves(tempBoardAfterMove, opponentPos, !isPlayer);
      
      // 상대방의 현재 이동 가능 영역 계산
      const opponentCurrentArea = floodFill(opponentPos, board);
      
      const destroyCandidates = destroyPositions.map(pos => {
        let score = 0;
        
        // Priority 1: 상대방 인접 칸 (가장 강력한 차단)
        const distToOpponent = Math.abs(pos.r - opponentPos.r) + Math.abs(pos.c - opponentPos.c);
        if (distToOpponent === 1) {
          score += 20; // 기존 10에서 20으로 증가
        } else if (distToOpponent === 2) {
          score += 5; // 2칸 거리도 가치 있음
        }
        
        // Priority 2: 상대방의 다음 이동 경로 차단
        if (opponentNextMoves.some(m => m.r === pos.r && m.c === pos.c)) {
          score += 15; // 기존 5에서 15로 증가
        }
        
        // Priority 3: 중앙 지역 제어
        const centerR = board.boardSize.rows / 2;
        const centerC = board.boardSize.cols / 2;
        const distToCenter = Math.abs(pos.r - centerR) + Math.abs(pos.c - centerC);
        score += (5 - distToCenter) * 0.5;
        
        // Priority 4: 상대방 영역 분할 효과 평가
        // 파괴 후 상대방의 이동 가능 영역이 얼마나 줄어드는지 계산
        const tempBoardWithDestroy: BoardState = {
          ...tempBoardAfterMove,
          destroyed: [...tempBoardAfterMove.destroyed, pos],
        };
        const opponentAreaAfterDestroy = floodFill(opponentPos, tempBoardWithDestroy);
        const areaReduction = opponentCurrentArea - opponentAreaAfterDestroy;
        score += areaReduction * 3; // 영역 감소는 매우 가치 있음
        
        // Priority 5: 우리 자신의 이동 경로 보호 (우리 경로를 차단하지 않도록)
        const ourNextMoves = getValidMoves(tempBoardAfterMove, isPlayer ? to : opponentPos, isPlayer);
        if (ourNextMoves.some(m => m.r === pos.r && m.c === pos.c)) {
          score -= 10; // 우리 경로를 차단하면 감점
        }
        
        return { pos, score };
      });
      
      // [강화] 난이도별 파괴 후보 수 조정
      // NEXUS-7: 최대 7개 후보 고려 (완벽한 수 찾기)
      // NEXUS-5: 5개 후보 고려
      // NEXUS-3: 4개 후보 고려 (일반인 수준에 적합한 전략적 선택)
      destroyCandidates.sort((a, b) => b.score - a.score);
      const candidateCount = difficulty === "NEXUS-7" ? 7 : difficulty === "NEXUS-5" ? 5 : 4;
      const topDestroys = destroyCandidates.slice(0, candidateCount);
      
      for (const { pos } of topDestroys) {
        allMoves.push({
          move: { ...move, destroy: pos },
          destroy: pos,
        });
      }
    }
  }
  
  return allMoves;
}

/**
 * [강화] Minimax 알고리즘 with alpha-beta pruning 및 이동 순서 최적화
 * Returns the best score for the maximizing player (AI)
 */
function minimax(
  board: BoardState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  startTime: number,
  timeLimit: number = 5000, // 5초로 증가
  killerMoves?: Array<{ move: GameMove; destroy: { r: number; c: number } }>, // 킬러 무브
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" // 난이도 정보
): number {
  // Check for timeout
  if (Date.now() - startTime > timeLimit) {
    return evaluateBoard(board);
  }

  // Terminal conditions
  const playerMoves = getValidMoves(board, board.playerPos, true);
  const aiMoves = getValidMoves(board, board.aiPos, false);
  
  if (playerMoves.length === 0) {
    // 플레이어가 움직일 수 없음 = AI 승리
    return isMaximizing ? 10000 - depth : -10000 + depth;
  }
  
  if (aiMoves.length === 0) {
    // AI가 움직일 수 없음 = 플레이어 승리
    return isMaximizing ? -10000 + depth : 10000 - depth;
  }
  
  if (depth === 0) {
    return evaluateBoard(board);
  }
  
  let moves = getAllMoves(board, !isMaximizing, difficulty);
  
  if (moves.length === 0) {
    return isMaximizing ? -5000 : 5000;
  }
  
  // [강화] 이동 순서 최적화: 더 좋은 수를 먼저 탐색하여 alpha-beta pruning 효율 극대화
  moves = orderMoves(moves, board, !isMaximizing, killerMoves);
  
  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const { move } of moves) {
      const newBoard = applyMove(board, move, false);
      const score = minimax(newBoard, depth - 1, alpha, beta, false, startTime, timeLimit, killerMoves, difficulty);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break; // Alpha-beta cutoff
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const { move } of moves) {
      const newBoard = applyMove(board, move, true);
      const score = minimax(newBoard, depth - 1, alpha, beta, true, startTime, timeLimit, killerMoves, difficulty);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break; // Alpha-beta cutoff
    }
    return minScore;
  }
}

/**
 * [강화] 이동 순서 최적화: 더 좋은 수를 먼저 탐색
 * 킬러 무브, 즉시 승리 수, 평가 점수 순으로 정렬
 */
function orderMoves(
  moves: Array<{ move: GameMove; destroy: { r: number; c: number } }>,
  board: BoardState,
  isPlayer: boolean,
  killerMoves?: Array<{ move: GameMove; destroy: { r: number; c: number } }>
): Array<{ move: GameMove; destroy: { r: number; c: number } }> {
  const scoredMoves: Array<{ move: GameMove; destroy: { r: number; c: number }; score: number }> = [];
  
  for (const moveData of moves) {
    let score = 0;
    
    // 1. 킬러 무브 우선순위 (이전에 좋았던 수)
    if (killerMoves && killerMoves.some(km => 
      km.move.from.r === moveData.move.from.r &&
      km.move.from.c === moveData.move.from.c &&
      km.move.to.r === moveData.move.to.r &&
      km.move.to.c === moveData.move.to.c
    )) {
      score += 1000;
    }
    
    // 2. 즉시 승리 수 탐지
    const newBoard = applyMove(board, moveData.move, isPlayer);
    const opponentMoves = getValidMoves(newBoard, isPlayer ? newBoard.aiPos : newBoard.playerPos, !isPlayer);
    if (opponentMoves.length === 0) {
      score += 5000; // 즉시 승리
    }
    
    // 3. 평가 점수 기반 정렬
    const evalScore = evaluateBoard(newBoard);
    score += isPlayer ? -evalScore : evalScore; // 플레이어는 최소화, AI는 최대화
    
    scoredMoves.push({ ...moveData, score });
  }
  
  // 점수 내림차순 정렬 (높은 점수 = 좋은 수)
  scoredMoves.sort((a, b) => b.score - a.score);
  
  return scoredMoves.map(m => ({ move: m.move, destroy: m.destroy }));
}

/**
 * Analyze player psychology based on their move
 * Comprehensive analysis including time, hesitation, movement patterns, and destroy strategy
 */
function analyzePlayerPsychology(
  board: BoardState,
  playerMove: PlayerMove | null,
  turnCount?: number
): string {
  if (!playerMove) {
    return "gameRoom.log.isolation.initializing";
  }

  // 개발 환경에서만 데이터 전달 체인 검증 로깅
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analyzePlayerPsychology] 분석 데이터:', {
      moveTimeSeconds: playerMove.moveTimeSeconds,
      hoverCount: playerMove.hoverCount,
      from: playerMove.from,
      to: playerMove.to,
      destroy: playerMove.destroy,
      turnCount
    });
  }

  // Extract move data
  const moveTimeSeconds = playerMove.moveTimeSeconds;
  const hoverCount = playerMove.hoverCount ?? 0;
  const destroyPos = playerMove.destroy as { r: number; c: number } | undefined;

  // Calculate movement metrics
  const dr = playerMove.to.r - playerMove.from.r;
  const dc = playerMove.to.c - playerMove.from.c;
  const moveDistance = Math.max(Math.abs(dr), Math.abs(dc)); // Chebyshev distance (queen move)
  const manhattanDistance = Math.abs(dr) + Math.abs(dc);

  // Calculate direction towards AI
  const aiDirR = board.aiPos.r - playerMove.from.r;
  const aiDirC = board.aiPos.c - playerMove.from.c;
  const moveDirR = dr;
  const moveDirC = dc;
  
  // Check if moving towards AI (aggressive) or away (defensive)
  const dotProduct = moveDirR * aiDirR + moveDirC * aiDirC;
  const isMovingTowardsAI = dotProduct > 0;
  const isMovingAwayFromAI = dotProduct < 0;

  // Calculate center position
  const centerR = board.boardSize.rows / 2;
  const centerC = board.boardSize.cols / 2;
  const distToCenterBefore = Math.abs(playerMove.from.r - centerR) + Math.abs(playerMove.from.c - centerC);
  const distToCenterAfter = Math.abs(playerMove.to.r - centerR) + Math.abs(playerMove.to.c - centerC);
  const isMovingToCenter = distToCenterAfter < distToCenterBefore;
  const isMovingToEdge = distToCenterAfter > distToCenterBefore;

  // Analyze area control
  const playerArea = floodFill(board.playerPos, board);
  const aiArea = floodFill(board.aiPos, board);
  const areaDifference = playerArea - aiArea;

  // Analyze destroy strategy
  let destroyStrategy: 'selfBlocking' | 'aiBlocking' | 'optimal' | 'neutral' | 'unknown' = 'unknown';
  if (destroyPos) {
    // Check if destroy blocks player's own path
    const tempBoardAfterMove: BoardState = {
      ...board,
      playerPos: playerMove.to,
      destroyed: [...board.destroyed, destroyPos],
    };
    const playerAreaAfterDestroy = floodFill(playerMove.to, tempBoardAfterMove);
    const playerAreaBeforeDestroy = floodFill(playerMove.to, {
      ...board,
      playerPos: playerMove.to,
    });
    const areaReduction = playerAreaBeforeDestroy - playerAreaAfterDestroy;
    
    if (areaReduction > 3) {
      destroyStrategy = 'selfBlocking'; // Significantly reduced own area
    } else {
      // Check if destroy blocks AI's path
      const aiAreaAfterDestroy = floodFill(board.aiPos, tempBoardAfterDestroy);
      const aiAreaBeforeDestroy = floodFill(board.aiPos, {
        ...board,
        playerPos: playerMove.to,
      });
      const aiAreaReduction = aiAreaBeforeDestroy - aiAreaAfterDestroy;
      
      if (aiAreaReduction > 3) {
        destroyStrategy = 'aiBlocking'; // Significantly reduced AI area
      } else if (areaReduction <= 1 && aiAreaReduction <= 1) {
        destroyStrategy = 'optimal'; // Minimal impact on both
      } else {
        destroyStrategy = 'neutral'; // Moderate impact
      }
    }
  }

  // Game phase analysis
  const currentTurn = turnCount || 0;
  const isEarlyGame = currentTurn <= 5;
  const isMidGame = currentTurn > 5 && currentTurn <= 15;
  const isLateGame = currentTurn > 15;

  // Time and hesitation thresholds
  const QUICK_MOVE_THRESHOLD = 3.0; // 3초 이하 = 빠른 수
  const LONG_THINK_THRESHOLD = 10.0; // 10초 이상 = 오래 고민한 수
  const HESITATION_HOVER_THRESHOLD = 3; // 3회 이상 = 망설임 패턴

  const hasTimeData = moveTimeSeconds !== undefined;
  const isQuickMove = hasTimeData && moveTimeSeconds <= QUICK_MOVE_THRESHOLD;
  const isLongThink = hasTimeData && moveTimeSeconds >= LONG_THINK_THRESHOLD;
  const hasHesitation = hoverCount >= HESITATION_HOVER_THRESHOLD;
  const isMediumTime = hasTimeData && moveTimeSeconds > QUICK_MOVE_THRESHOLD && moveTimeSeconds < LONG_THINK_THRESHOLD;

  // Movement pattern analysis
  const isShortMove = moveDistance <= 2;
  const isLongMove = moveDistance >= 4;
  const isAggressiveMove = isMovingTowardsAI && moveDistance >= 3;
  const isDefensiveMove = isMovingAwayFromAI || (isShortMove && !isMovingTowardsAI);

  // Build psychology messages array with priority system
  const psychologyMessages: string[] = [];

  // Priority 1: Complex scenarios (time + hesitation + movement pattern)
  if (isLongThink && hasHesitation && destroyStrategy === 'selfBlocking') {
    psychologyMessages.push(
      "gameRoom.log.isolation.psychology.longHesitationSelfBlock",
      "gameRoom.log.isolation.psychology.longHesitationSelfBlock2",
      "gameRoom.log.isolation.psychology.longHesitationSelfBlock3"
    );
  } else if (isLongThink && hasHesitation) {
    psychologyMessages.push(
      "gameRoom.log.isolation.psychology.longHesitation1",
      "gameRoom.log.isolation.psychology.longHesitation2",
      "gameRoom.log.isolation.psychology.longHesitation3"
    );
  } else if (isQuickMove && isAggressiveMove && destroyStrategy === 'aiBlocking') {
    psychologyMessages.push(
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal",
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal2",
      "gameRoom.log.isolation.psychology.quickAggressiveOptimal3"
    );
  } else if (isQuickMove && destroyStrategy === 'selfBlocking') {
    psychologyMessages.push(
      "gameRoom.log.isolation.psychology.quickSelfBlock",
      "gameRoom.log.isolation.psychology.quickSelfBlock2",
      "gameRoom.log.isolation.psychology.quickSelfBlock3"
    );
  }

  // Priority 2: Time-based analysis
  if (psychologyMessages.length === 0) {
    if (isLongThink) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.longThink1",
        "gameRoom.log.isolation.psychology.longThink2",
        "gameRoom.log.isolation.psychology.longThink3"
      );
    } else if (isMediumTime && hasHesitation) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.hesitation1",
        "gameRoom.log.isolation.psychology.hesitation2",
        "gameRoom.log.isolation.psychology.hesitation3"
      );
    } else if (hasHesitation) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.hesitation1",
        "gameRoom.log.isolation.psychology.hesitation2",
        "gameRoom.log.isolation.psychology.hesitation3"
      );
    } else if (isQuickMove) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.quickMove1",
        "gameRoom.log.isolation.psychology.quickMove2",
        "gameRoom.log.isolation.psychology.quickMove3"
      );
    }
  }

  // Priority 3: Destroy strategy analysis
  if (psychologyMessages.length === 0) {
    if (destroyStrategy === 'selfBlocking') {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.selfBlocking1",
        "gameRoom.log.isolation.psychology.selfBlocking2",
        "gameRoom.log.isolation.psychology.selfBlocking3"
      );
    } else if (destroyStrategy === 'aiBlocking') {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.aiBlocking1",
        "gameRoom.log.isolation.psychology.aiBlocking2",
        "gameRoom.log.isolation.psychology.aiBlocking3"
      );
    } else if (destroyStrategy === 'optimal') {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.optimalDestroy1",
        "gameRoom.log.isolation.psychology.optimalDestroy2",
        "gameRoom.log.isolation.psychology.optimalDestroy3"
      );
    }
  }

  // Priority 4: Movement pattern analysis
  if (psychologyMessages.length === 0) {
    if (isAggressiveMove && isMovingToCenter) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.aggressiveCenter1",
        "gameRoom.log.isolation.psychology.aggressiveCenter2",
        "gameRoom.log.isolation.psychology.aggressiveCenter3"
      );
    } else if (isAggressiveMove) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.aggressive1",
        "gameRoom.log.isolation.psychology.aggressive2",
        "gameRoom.log.isolation.psychology.aggressive3"
      );
    } else if (isDefensiveMove && isMovingToEdge) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.defensiveEdge1",
        "gameRoom.log.isolation.psychology.defensiveEdge2",
        "gameRoom.log.isolation.psychology.defensiveEdge3"
      );
    } else if (isDefensiveMove) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.defensive1",
        "gameRoom.log.isolation.psychology.defensive2",
        "gameRoom.log.isolation.psychology.defensive3"
      );
    } else if (isLongMove) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.longMove1",
        "gameRoom.log.isolation.psychology.longMove2",
        "gameRoom.log.isolation.psychology.longMove3"
      );
    } else if (isShortMove) {
      psychologyMessages.push(
        "gameRoom.log.isolation.psychology.shortMove1",
        "gameRoom.log.isolation.psychology.shortMove2",
        "gameRoom.log.isolation.psychology.shortMove3"
      );
    }
  }

  // Priority 5: Game phase + area analysis
  if (psychologyMessages.length === 0) {
    if (isEarlyGame) {
      if (areaDifference > 5) {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.earlyExpanding1",
          "gameRoom.log.isolation.psychology.earlyExpanding2",
          "gameRoom.log.isolation.psychology.earlyExpanding3"
        );
      } else {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.earlyBalanced1",
          "gameRoom.log.isolation.psychology.earlyBalanced2",
          "gameRoom.log.isolation.psychology.earlyBalanced3"
        );
      }
    } else if (isMidGame) {
      if (areaDifference < -5) {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.midTrapped1",
          "gameRoom.log.isolation.psychology.midTrapped2",
          "gameRoom.log.isolation.psychology.midTrapped3"
        );
      } else {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.midBalanced1",
          "gameRoom.log.isolation.psychology.midBalanced2",
          "gameRoom.log.isolation.psychology.midBalanced3"
        );
      }
    } else if (isLateGame) {
      if (areaDifference < -10) {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.lateTrapped1",
          "gameRoom.log.isolation.psychology.lateTrapped2",
          "gameRoom.log.isolation.psychology.lateTrapped3"
        );
      } else {
        psychologyMessages.push(
          "gameRoom.log.isolation.psychology.lateBalanced1",
          "gameRoom.log.isolation.psychology.lateBalanced2",
          "gameRoom.log.isolation.psychology.lateBalanced3"
        );
      }
    }
  }

  // Fallback: Default messages
  if (psychologyMessages.length === 0) {
    if (areaDifference > 10) {
      psychologyMessages.push("gameRoom.log.isolation.playerExpanding");
    } else if (areaDifference < -10) {
      psychologyMessages.push("gameRoom.log.isolation.playerTrapped");
    } else {
      psychologyMessages.push("gameRoom.log.isolation.playerBalanced");
    }
  }

  // Deterministic but varied selection based on board state
  const hash = board.destroyed.length + playerMove.from.r + playerMove.from.c + (turnCount || 0);
  const selectedMessage = psychologyMessages[hash % psychologyMessages.length];

  // 개발 환경에서만 분석 결과 로깅
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analyzePlayerPsychology] 분석 결과:', {
      패턴: {
        빠른수: isQuickMove,
        오래고민: isLongThink,
        망설임: hasHesitation,
        중간시간: isMediumTime,
        공격적: isAggressiveMove,
        방어적: isDefensiveMove,
        짧은이동: isShortMove,
        긴이동: isLongMove,
        중앙이동: isMovingToCenter,
        파괴전략: destroyStrategy,
        게임단계: isEarlyGame ? '초반' : isMidGame ? '중반' : '후반'
      },
      데이터: {
        moveTimeSeconds,
        hoverCount,
        hasTimeData,
        moveDistance,
        areaDifference
      },
      선택된메시지: selectedMessage,
      가능한메시지수: psychologyMessages.length
    });
  }

  return selectedMessage;
}

/**
 * Synchronous version of AI move calculation
 * Used by Web Worker for background computation
 *
 * @returns Object with move, logs, and optional depth/nodesEvaluated for stats
 */
export function runMinimaxSearch(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): {
  move: GameMove | null;
  logs: string[];
  depth?: number;
  nodesEvaluated?: number;
} {
  try {
    // Validate board state
    if (!board || !board.boardSize || !board.playerPos || !board.aiPos) {
      console.error("getAIMove: Invalid board state", board);
      return {
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }
    
    // Check if AI position is valid
    if (!isValidPosition(board.aiPos, board.boardSize)) {
      console.error("getAIMove: Invalid AI position", board.aiPos);
      return {
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }
    
    const aiMoves = getValidMoves(board, board.aiPos, false);
    
    console.log(`getAIMove: AI at (${board.aiPos.r}, ${board.aiPos.c}), found ${aiMoves.length} valid moves`);
    
    if (aiMoves.length === 0) {
      console.warn("getAIMove: AI has no valid moves");
      return {
        move: null,
        logs: ["gameRoom.log.isolation.noMoves"],
      };
    }
    
    // [강화] 난이도별 탐색 깊이 대폭 증가
    // NEXUS-7: 최대 깊이 8까지 반복적 심화로 탐색
    const maxDepth = difficulty === "NEXUS-3" ? 3 : difficulty === "NEXUS-5" ? 5 : 8;
    const startTime = Date.now();
    const timeLimit = difficulty === "NEXUS-7" ? 8000 : difficulty === "NEXUS-5" ? 5000 : 3000; // 시간 제한 증가
    
    // [강화] 난이도별 파괴 후보 수를 고려한 모든 가능한 수 생성
    let allMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }>;
    try {
      allMoves = getAllMoves(board, false, difficulty);
    } catch (error) {
      console.error("getAIMove: Error in getAllMoves", error);
      // Fallback: use simple moves without destroy optimization
      allMoves = aiMoves.map(to => ({
        move: { from: board.aiPos, to },
        destroy: { r: -1, c: -1 },
      }));
    }
    
    if (allMoves.length === 0) {
      console.warn("getAIMove: No moves after getAllMoves");
      return {
        move: null,
        logs: ["gameRoom.log.isolation.noMoves"],
      };
    }
    
    // [강화] 반복적 심화(Iterative Deepening): 깊이를 점진적으로 증가시키며 탐색
    // 시간 제한 내에서 최대한 깊이 탐색하여 최적의 수를 찾음
    let movesWithScores: Array<{
      move: GameMove;
      destroy: { r: number; c: number };
      score: number;
    }> = [];
    
    let bestDepth = 1;
    let killerMoves: Array<{ move: GameMove; destroy: { r: number; c: number } }> = [];
    
    // 깊이를 1부터 maxDepth까지 점진적으로 증가
    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      // 시간 체크: 시간이 부족하면 이전 깊이의 결과 사용
      if (Date.now() - startTime > timeLimit * 0.8) {
        console.log(`getAIMove: Time limit approaching, using depth ${bestDepth} results`);
        break;
      }
      
      const depthStartTime = Date.now();
      const currentMovesWithScores: Array<{
        move: GameMove;
        destroy: { r: number; c: number };
        score: number;
      }> = [];
      
      // 이전 깊이의 결과를 기반으로 이동 순서 최적화
      const orderedMoves = movesWithScores.length > 0
        ? movesWithScores.map(m => ({ move: m.move, destroy: m.destroy }))
        : allMoves;
      
      for (const { move, destroy } of orderedMoves) {
        try {
          const newBoard = applyMove(board, move, false);
          // After AI move, it's player's turn (minimizing)
          const score = minimax(newBoard, currentDepth - 1, -Infinity, Infinity, false, startTime, timeLimit, killerMoves, difficulty);
          currentMovesWithScores.push({ move, destroy, score });
        } catch (error) {
          console.error("Error evaluating move:", error, move);
          // Continue with other moves, but give this move a very low score
          currentMovesWithScores.push({ move, destroy, score: -Infinity });
        }
        
        // 시간 체크: 각 수 평가 후 시간 확인
        if (Date.now() - startTime > timeLimit * 0.8) {
          break;
        }
      }
      
      // 점수순 정렬
      currentMovesWithScores.sort((a, b) => b.score - a.score);
      
      // 유효한 수가 있으면 결과 업데이트
      const validMoves = currentMovesWithScores.filter(m => m.score !== -Infinity);
      if (validMoves.length > 0) {
        movesWithScores = validMoves;
        bestDepth = currentDepth;
        
        // 킬러 무브 업데이트: 최상위 2개 수를 킬러 무브로 저장
        killerMoves = movesWithScores.slice(0, 2).map(m => ({ move: m.move, destroy: m.destroy }));
      }
      
      const depthTime = Date.now() - depthStartTime;
      console.log(`getAIMove: Depth ${currentDepth} completed in ${depthTime}ms, best score: ${movesWithScores[0]?.score ?? 'N/A'}`);
      
      // 시간이 거의 다 되면 중단
      if (Date.now() - startTime > timeLimit * 0.9) {
        break;
      }
    }
    
    console.log(`getAIMove: Final search depth: ${bestDepth}, total time: ${Date.now() - startTime}ms`);
    
    // Filter out invalid moves (score of -Infinity) and moves without valid destroy
    const validMovesWithScores = movesWithScores.filter(m => 
      m.score !== -Infinity && 
      m.destroy && 
      m.destroy.r >= 0 && 
      m.destroy.c >= 0
    );
    
    if (validMovesWithScores.length === 0) {
      console.warn("getAIMove: All moves failed evaluation or have invalid destroy, trying fallback");
      // Fallback: try to get a move with valid destroy
      const fallbackMoves = getAllMoves(board, false, difficulty);
      if (fallbackMoves.length > 0) {
        const fallback = fallbackMoves[0];
        if (fallback.destroy && fallback.destroy.r >= 0 && fallback.destroy.c >= 0) {
          return {
            move: fallback.move,
            logs: ["gameRoom.log.moveExecuted"],
          };
        }
      }
      // Last resort: return null (will trigger error handling)
      return {
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }
    
    // Sort by score (descending)
    validMovesWithScores.sort((a, b) => b.score - a.score);
    
    // [강화] 난이도별 수 선택 전략
    let selectedMove: typeof validMovesWithScores[0];
    
    if (difficulty === "NEXUS-3") {
      // 쉬움: 상위 55% 중 랜덤 선택 (일반인 수준의 일관된 플레이)
      const topMoves = validMovesWithScores.slice(0, Math.max(1, Math.floor(validMovesWithScores.length * 0.55)));
      selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
    } else if (difficulty === "NEXUS-5") {
      // 보통: 상위 25% 중 랜덤 선택 (전문가 수준의 일관된 강한 플레이)
      const topMoves = validMovesWithScores.slice(0, Math.max(1, Math.floor(validMovesWithScores.length * 0.25)));
      selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
    } else {
      // NEXUS-7: 최대한 깊이 탐색하여 최적에 가까운 수 선택 (매우 높은 승률)
      // 깊이 8 탐색과 Iterative Deepening으로 인간을 초월하는 수준의 플레이
      // 승리 확정 경로가 있으면 무조건 선택
      const winningMoves = validMovesWithScores.filter(m => m.score > 5000);
      if (winningMoves.length > 0) {
        selectedMove = winningMoves[0];
        console.log("getAIMove: Winning move found, score:", selectedMove.score);
      } else {
        selectedMove = validMovesWithScores[0]; // 최고 점수 수 선택
      }
    }
    
    // Generate psychological insight (pass turnCount for game phase analysis)
    const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove, turnCount);
    
    // Calculate strategic insight with enhanced analysis
    const playerArea = floodFill(board.playerPos, board);
    const aiArea = floodFill(board.aiPos, board);
    const areaDiff = aiArea - playerArea;
    const totalArea = board.boardSize.rows * board.boardSize.cols;
    const destroyedCount = board.destroyed.length;
    const remainingArea = totalArea - destroyedCount - 2; // Exclude player and AI positions
    
    // Calculate area reduction rate
    const areaReductionRate = destroyedCount / totalArea;
    const playerAreaPercentage = (playerArea / remainingArea) * 100;
    const aiAreaPercentage = (aiArea / remainingArea) * 100;
    
    // Estimate remaining turns (rough calculation)
    const avgAreaPerTurn = destroyedCount / Math.max(1, turnCount || 1);
    const estimatedTurnsRemaining = Math.floor(remainingArea / Math.max(1, avgAreaPerTurn * 2));
    
    // Determine strategic log based on comprehensive analysis
    const strategicLogs: string[] = [];
    
    // Check if AI has winning position
    if (selectedMove.score > 5000) {
      strategicLogs.push("gameRoom.log.isolation.strategy.winningPosition");
    } else if (areaDiff > 10 && areaReductionRate > 0.3) {
      // AI has significant advantage and game is progressing
      strategicLogs.push(
        "gameRoom.log.isolation.strategy.aiDominant",
        "gameRoom.log.isolation.strategy.aiDominant2",
        "gameRoom.log.isolation.strategy.aiDominant3"
      );
    } else if (areaDiff > 5) {
      strategicLogs.push("gameRoom.log.isolation.aiAdvantage");
    } else if (areaDiff < -10 && areaReductionRate > 0.3) {
      // Player has significant advantage but game is progressing
      strategicLogs.push(
        "gameRoom.log.isolation.strategy.playerDominant",
        "gameRoom.log.isolation.strategy.playerDominant2",
        "gameRoom.log.isolation.strategy.playerDominant3"
      );
    } else if (areaDiff < -5) {
      strategicLogs.push("gameRoom.log.isolation.playerAdvantage");
    } else if (areaReductionRate > 0.5) {
      // Late game with balanced position
      strategicLogs.push(
        "gameRoom.log.isolation.strategy.lateGameBalanced",
        "gameRoom.log.isolation.strategy.lateGameBalanced2",
        "gameRoom.log.isolation.strategy.lateGameBalanced3"
      );
    } else if (estimatedTurnsRemaining < 10 && areaDiff > 0) {
      // Endgame approaching, AI has slight advantage
      strategicLogs.push(
        "gameRoom.log.isolation.strategy.endgameAdvantage",
        "gameRoom.log.isolation.strategy.endgameAdvantage2",
        "gameRoom.log.isolation.strategy.endgameAdvantage3"
      );
    } else if (estimatedTurnsRemaining < 10 && areaDiff < 0) {
      // Endgame approaching, player has slight advantage
      strategicLogs.push(
        "gameRoom.log.isolation.strategy.endgameDisadvantage",
        "gameRoom.log.isolation.strategy.endgameDisadvantage2",
        "gameRoom.log.isolation.strategy.endgameDisadvantage3"
      );
    } else {
      strategicLogs.push("gameRoom.log.isolation.balanced");
    }
    
    // Select strategic log deterministically
    const strategicLogHash = Math.abs(areaDiff) + destroyedCount + (turnCount || 0);
    const strategicLog = strategicLogs[strategicLogHash % strategicLogs.length];
    
    // Ensure destroy is included in the move
    const finalMove: GameMove = {
      ...selectedMove.move,
      destroy: selectedMove.destroy,
    };
    
    // Validate destroy position
    if (!finalMove.destroy || finalMove.destroy.r < 0 || finalMove.destroy.c < 0) {
      console.error("getAIMove: Selected move has invalid destroy", finalMove);
      // Try to get a valid destroy position
      const destroyPositions = getValidDestroyPositions(board, finalMove.to, false);
      if (destroyPositions.length > 0) {
        finalMove.destroy = destroyPositions[0];
        console.log(`getAIMove: Fixed invalid destroy, using (${finalMove.destroy.r}, ${finalMove.destroy.c})`);
      } else {
        console.error("getAIMove: Cannot fix invalid destroy - no destroy positions available");
        return {
          move: null,
          logs: ["gameRoom.log.calculationErrorKo"],
        };
      }
    }
    
    console.log(`runMinimaxSearch: Selected move from (${finalMove.from.r}, ${finalMove.from.c}) to (${finalMove.to.r}, ${finalMove.to.c}) with destroy (${finalMove.destroy.r}, ${finalMove.destroy.c}) and score ${selectedMove.score}`);

    return {
      move: finalMove,
      logs: [psychologicalInsight, strategicLog],
      depth: bestDepth,
    };
  } catch (error) {
    console.error("getAIMove: Fatal error", error);
    // Last resort fallback
    try {
      const aiMoves = getValidMoves(board, board.aiPos, false);
      if (aiMoves.length > 0) {
        return {
          move: {
            from: board.aiPos,
            to: aiMoves[0],
          },
          logs: ["gameRoom.log.moveExecuted"],
        };
      }
    } catch (fallbackError) {
      console.error("getAIMove: Fallback also failed", fallbackError);
    }
    
    return {
      move: null,
      logs: ["gameRoom.log.calculationErrorKo"],
    };
  }
}

/**
 * Async version of AI move calculation
 * Uses Web Worker to avoid blocking the main thread
 *
 * This function maintains UI responsiveness (timer, animations, scanning effects)
 * while AI calculation runs in the background.
 */
export async function getAIMove(
  board: BoardState,
  playerLastMove: PlayerMove | null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): Promise<{
  move: GameMove | null;
  logs: string[];
}> {
  // Import worker pool dynamically to avoid circular dependency issues
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
    // Fallback to synchronous calculation if Worker fails
    console.warn('[getAIMove] Worker failed, falling back to synchronous calculation:', error);
    const result = runMinimaxSearch(board, playerLastMove, difficulty, turnCount, boardHistory);
    return {
      move: result.move,
      logs: result.logs,
    };
  }
}
