/**
 * Mini Chess Evaluation Functions
 * 
 * Functions for evaluating board positions and calculating material balance.
 * These are used by the AI to determine the best moves.
 */

import type { Board, Piece } from "./types";
import { isValidMove, getValidMoves } from "./moveValidation";
import { makeMove, generateFen } from "./boardUtils";
import { checkWinner } from "./winnerCheck";
import { wouldCauseThreefoldRepetition } from "./repetition";

/**
 * Calculate material balance
 * Returns positive for AI advantage, negative for player advantage
 */
export function calculateMaterialBalance(board: Board): {
  aiMaterial: number;
  playerMaterial: number;
  balance: number;
} {
  let aiMaterial = 0;
  let playerMaterial = 0;
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      
      if (piece === 'K') aiMaterial += 1000; // King is invaluable
      else if (piece === 'N') aiMaterial += 5;
      else if (piece === 'P') aiMaterial += 1;
      else if (piece === 'k') playerMaterial += 1000;
      else if (piece === 'n') playerMaterial += 5;
      else if (piece === 'p') playerMaterial += 1;
    }
  }
  
  return {
    aiMaterial,
    playerMaterial,
    balance: aiMaterial - playerMaterial
  };
}

/**
 * Dynamic weight system for adaptive evaluation
 * Adjusts weights based on game phase, king safety, material balance, and threats
 */
export function getDynamicWeights(turnCount?: number): {
  kingAdvancement: number;
  materialKnight: number;
  materialPawn: number;
  kingSafety: number;
  mobility: number;
  threat: number;
} {
  // Determine game phase: early (0-8), mid (9-18), endgame (19+)
  const gamePhase = turnCount === undefined ? 1 : 
    turnCount < 9 ? 0 : // Early game
    turnCount < 19 ? 1 : // Mid game
    2; // Endgame
  
  // Dynamic weights based on game phase
  if (gamePhase === 0) {
    // Early game: prioritize material and development
    return {
      kingAdvancement: 6,      // Moderate king advancement
      materialKnight: 8,        // High knight value (development)
      materialPawn: 2,          // Moderate pawn value
      kingSafety: 80,           // High king safety priority
      mobility: 0.15,           // Moderate mobility
      threat: 30                // Moderate threat value
    };
  } else if (gamePhase === 1) {
    // Mid game: balance between material and position
    return {
      kingAdvancement: 8,       // Increased king advancement
      materialKnight: 6,        // Moderate knight value
      materialPawn: 1.5,         // Lower pawn value
      kingSafety: 100,          // Very high king safety
      mobility: 0.2,            // Higher mobility
      threat: 50                // Higher threat value
    };
  } else {
    // Endgame: prioritize king advancement over excessive safety
    return {
      kingAdvancement: 20,      // Increased king advancement priority
      materialKnight: 4,        // Lower knight value (can sacrifice)
      materialPawn: 1,          // Minimal pawn value
      kingSafety: 80,           // Reduced - advancement is more important
      mobility: 0.25,           // Maximum mobility
      threat: 80                // Maximum threat value
    };
  }
}

/**
 * Enhanced evaluation function with dynamic weights for minimax
 * Returns positive score for AI advantage, negative for player advantage
 */
export function evaluateBoard(board: Board, turnCount?: number): number {
  // Get dynamic weights based on game phase
  const weights = getDynamicWeights(turnCount);
  
  let score = 0;
  
  // Find king positions and collect piece information
  let playerKingPos: { r: number, c: number } | null = null;
  let aiKingPos: { r: number, c: number } | null = null;
  
  // Piece-Square Table for positional evaluation
  const pst = [
    [0, 0, 0, 0, 0],
    [1, 2, 2, 2, 1],
    [2, 4, 6, 4, 2],
    [1, 2, 2, 2, 1],
    [0, 0, 0, 0, 0]
  ];
  
  // Single pass: collect positions, calculate material and positional value
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      
      // Find king positions
      if (piece === 'k') {
        playerKingPos = { r, c };
      } else if (piece === 'K') {
        aiKingPos = { r, c };
      }
      
      // Material and positional evaluation
      const isAI = piece === piece.toUpperCase();
      const pieceType = piece.toLowerCase();
      const posVal = pst[r][c] * 0.5;
      
      if (pieceType === 'k') {
        // King value with specialized positional table
        const kingVal = 1000;
        
        // King-specific positional table: encourages advancement toward goal
        const kingPst = isAI 
          ? [0, 2, 5, 10, 20]  // AI: row 0→4, exponential increase
          : [20, 10, 5, 2, 0]; // Player: row 4→0, exponential increase
        const kingPosVal = kingPst[r] * 0.5;
        
        if (isAI) {
          score += kingVal + kingPosVal;
          const distanceToGoal = 4 - r;
          if (distanceToGoal <= 3) {
            const advancementBonus = Math.pow(2, 4 - distanceToGoal) * weights.kingAdvancement * 0.3;
            score += advancementBonus;
          }
          score += r * weights.kingAdvancement;
          if (r === 4) score += 5000; // Instant win
        } else {
          score -= kingVal + kingPosVal;
          const distanceToGoal = r;
          if (distanceToGoal <= 3) {
            const advancementBonus = Math.pow(2, 4 - distanceToGoal) * weights.kingAdvancement * 0.3;
            score -= advancementBonus;
          }
          score -= (4 - r) * weights.kingAdvancement;
          if (r === 0) score -= 5000; // Player instant win
        }
      } else if (pieceType === 'n') {
        const knightVal = weights.materialKnight;
        const centerDist = Math.abs(r - 2) + Math.abs(c - 2);
        const centerBonus = (5 - centerDist) * 0.5;
        
        if (isAI) {
          score += knightVal + posVal + centerBonus;
        } else {
          score -= knightVal + posVal + centerBonus;
        }
      } else if (pieceType === 'p') {
        const pawnVal = weights.materialPawn;
        const advanceBonus = isAI ? r * 0.5 : (4 - r) * 0.5;
        
        if (isAI) {
          score += pawnVal + posVal + advanceBonus;
        } else {
          score -= pawnVal + posVal + advanceBonus;
        }
      }
    }
  }
  
  // Calculate king safety scores
  if (aiKingPos) {
    let actualThreatCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const piece = board[r][c];
        if (piece && piece === piece.toLowerCase() && piece !== piece.toUpperCase()) {
          if (isValidMove(board, { r, c }, aiKingPos, true)) {
            actualThreatCount++;
          }
        }
      }
    }
    
    const safetyScore = Math.max(0, 1.0 - actualThreatCount * 0.25);
    score += (safetyScore - 0.5) * weights.kingSafety * 0.3;
    
    const distanceToGoal = 4 - aiKingPos.r;
    if (distanceToGoal <= 2) {
      const proximityBonus = Math.pow(5 - distanceToGoal, 2) * weights.kingAdvancement * 0.5;
      score += proximityBonus;
    }
  }
  
  if (playerKingPos) {
    let actualThreatCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const piece = board[r][c];
        if (piece && piece === piece.toUpperCase() && piece !== piece.toLowerCase()) {
          if (isValidMove(board, { r, c }, playerKingPos, false)) {
            actualThreatCount++;
          }
        }
      }
    }
    const safetyScore = Math.max(0, 1.0 - actualThreatCount * 0.25);
    score -= (safetyScore - 0.5) * weights.kingSafety * 0.3;
    
    const distanceToGoal = playerKingPos.r;
    if (distanceToGoal <= 2) {
      const proximityBonus = Math.pow(5 - distanceToGoal, 2) * weights.kingAdvancement * 0.5;
      score -= proximityBonus;
    }
  }
  
  // Simplified center control
  let aiCenterPieces = 0;
  let playerCenterPieces = 0;
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      const piece = board[r][c];
      if (piece) {
        if (piece === piece.toUpperCase()) aiCenterPieces++;
        else playerCenterPieces++;
      }
    }
  }
  score += (aiCenterPieces - playerCenterPieces) * 0.3;
  
  return score;
}

/**
 * Get all possible moves for a player
 */
function getAllMoves(board: Board, isPlayer: boolean): Array<{ from: { r: number, c: number }, to: { r: number, c: number } }> {
  const moves: Array<{ from: { r: number, c: number }, to: { r: number, c: number } }> = [];
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      
      const isPlayerPiece = piece === piece.toLowerCase() && piece !== piece.toUpperCase();
      const isAiPiece = piece === piece.toUpperCase() && piece !== piece.toLowerCase();
      
      if ((isPlayer && isPlayerPiece) || (!isPlayer && isAiPiece)) {
        const validMoves = getValidMoves(board, { r, c }, isPlayer);
        for (const move of validMoves) {
          moves.push({ from: { r, c }, to: move });
        }
      }
    }
  }
  
  return moves;
}

/**
 * Minimax algorithm with alpha-beta pruning
 * Returns the best score for the maximizing player (AI)
 */
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  turnCount?: number
): number {
  // Terminal conditions
  const winner = checkWinner(board, turnCount);
  if (winner === 'ai') return 10000 - depth; // Prefer faster wins
  if (winner === 'player') return -10000 + depth; // Prefer slower losses
  if (winner === 'draw') return 0;
  
  // Depth limit
  if (depth === 0) {
    return evaluateBoard(board, turnCount);
  }
  
  const moves = getAllMoves(board, !isMaximizing);
  
  // If no moves available (stalemate)
  if (moves.length === 0) {
    return isMaximizing ? -5000 : 5000; // Stalemate is bad for the side to move
  }
  
  if (isMaximizing) {
    // AI's turn - maximize score
    let maxScore = -Infinity;
    for (const move of moves) {
      const newBoard = makeMove(board, move.from, move.to);
      const score = minimax(newBoard, depth - 1, alpha, beta, false, turnCount);
      maxScore = Math.max(maxScore, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        break; // Alpha-beta pruning
      }
    }
    return maxScore;
  } else {
    // Player's turn - minimize score
    let minScore = Infinity;
    for (const move of moves) {
      const newBoard = makeMove(board, move.from, move.to);
      const score = minimax(newBoard, depth - 1, alpha, beta, true, turnCount);
      minScore = Math.min(minScore, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) {
        break; // Alpha-beta pruning
      }
    }
    return minScore;
  }
}

/**
 * Analyze player psychology based on their move
 */
function analyzePlayerPsychology(
  board: Board,
  playerMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece, moveTimeSeconds?: number, hoverCount?: number } | null
): string {
  if (!playerMove) {
    return "초기 상태 분석 중...";
  }

  // 개발 환경에서만 데이터 전달 체인 검증 로깅
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analyzePlayerPsychology] 분석 데이터:', {
      moveTimeSeconds: playerMove.moveTimeSeconds,
      hoverCount: playerMove.hoverCount,
      from: playerMove.from,
      to: playerMove.to,
      piece: playerMove.piece,
      captured: playerMove.captured
    });
  }

  const piece = playerMove.piece || board[playerMove.to.r]?.[playerMove.to.c];
  const dr = playerMove.to.r - playerMove.from.r;
  const dc = playerMove.to.c - playerMove.from.c;
  const isKingMove = piece === 'k';
  const isKnightMove = piece === 'n';
  const isPawnMove = piece === 'p';
  const isForward = dr < 0; // Player moves up (negative row)
  const isAggressive = Math.abs(dr) + Math.abs(dc) > 1;
  const capturedAIPiece = playerMove.captured && playerMove.captured === playerMove.captured.toUpperCase();

  // Check if player's piece is now threatening AI pieces
  let threatenedPieces = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const aiPiece = board[r][c];
      if (aiPiece && aiPiece === aiPiece.toUpperCase()) {
        // Check if player's piece at new position can attack this AI piece
        const distance = Math.abs(r - playerMove.to.r) + Math.abs(c - playerMove.to.c);
        if (isKnightMove && ((Math.abs(r - playerMove.to.r) === 2 && Math.abs(c - playerMove.to.c) === 1) || 
                             (Math.abs(r - playerMove.to.r) === 1 && Math.abs(c - playerMove.to.c) === 2))) {
          threatenedPieces++;
        } else if ((isKingMove || isPawnMove) && distance === 1) {
          threatenedPieces++;
        }
      }
    }
  }

  const psychologyMessages: string[] = [];
  
  // Time-based analysis (takes priority if available)
  // 명확한 타입 처리: undefined가 아닌 경우에만 분석 수행
  const moveTimeSeconds = playerMove.moveTimeSeconds;
  const hoverCount = playerMove.hoverCount ?? 0; // undefined를 명시적으로 0으로 변환
  
  // 시간 및 망설임 분석을 위한 상수 정의 (경계값 명확화)
  const QUICK_MOVE_THRESHOLD = 3.0; // 3초 이하 = 빠른 수
  const LONG_THINK_THRESHOLD = 10.0; // 10초 이상 = 오래 고민한 수
  const HESITATION_HOVER_THRESHOLD = 3; // 3회 이상 = 망설임 패턴
  
  const hasTimeData = moveTimeSeconds !== undefined;
  const isQuickMove = hasTimeData && moveTimeSeconds <= QUICK_MOVE_THRESHOLD;
  const isLongThink = hasTimeData && moveTimeSeconds >= LONG_THINK_THRESHOLD;
  const hasHesitation = hoverCount >= HESITATION_HOVER_THRESHOLD;
  const isMediumTime = hasTimeData && moveTimeSeconds > QUICK_MOVE_THRESHOLD && moveTimeSeconds < LONG_THINK_THRESHOLD;
  
  // 우선순위 1: 긴 시간 + 망설임 조합 (가장 구체적인 패턴)
  if (isLongThink && hasHesitation) {
    psychologyMessages.push(
      "gameRoom.log.psychology.longHesitation1",
      "gameRoom.log.psychology.longHesitation2",
      "gameRoom.log.psychology.longHesitation3"
    );
  }
  // 우선순위 2: 오래 고민한 수 (10초 이상)
  else if (isLongThink) {
    psychologyMessages.push(
      "gameRoom.log.psychology.longThink1",
      "gameRoom.log.psychology.longThink2",
      "gameRoom.log.psychology.longThink3"
    );
  }
  // 우선순위 3: 중간 시간 + 망설임 조합 (3초 < 시간 < 10초 + hover 3회 이상)
  else if (isMediumTime && hasHesitation) {
    psychologyMessages.push(
      "gameRoom.log.psychology.hesitation1",
      "gameRoom.log.psychology.hesitation2",
      "gameRoom.log.psychology.hesitation3"
    );
  }
  // 우선순위 4: 망설임 패턴만 (hover 3회 이상, 시간 정보 없거나 중간 시간)
  else if (hasHesitation) {
    psychologyMessages.push(
      "gameRoom.log.psychology.hesitation1",
      "gameRoom.log.psychology.hesitation2",
      "gameRoom.log.psychology.hesitation3"
    );
  }
  // 우선순위 5: 빠른 수 (3초 이하)
  else if (isQuickMove) {
    psychologyMessages.push(
      "gameRoom.log.psychology.quickMove1",
      "gameRoom.log.psychology.quickMove2",
      "gameRoom.log.psychology.quickMove3"
    );
  }
  // 우선순위 6: 중간 시간대 (3초 < 시간 < 10초, hover < 3회)
  else if (isMediumTime) {
    psychologyMessages.push(
      "gameRoom.log.psychology.normalMove1",
      "gameRoom.log.psychology.normalMove2",
      "gameRoom.log.psychology.normalMove3"
    );
  }

  // Move type analysis (if no time-based message was added)
  if (psychologyMessages.length === 0) {
    if (capturedAIPiece) {
      psychologyMessages.push(
        "gameRoom.log.psychology.capturedPiece1",
        "gameRoom.log.psychology.capturedPiece2",
        "gameRoom.log.psychology.capturedPiece3",
        "gameRoom.log.psychology.capturedPiece4"
      );
    } else if (isKingMove && isForward) {
      psychologyMessages.push(
        "gameRoom.log.psychology.kingForward1",
        "gameRoom.log.psychology.kingForward2",
        "gameRoom.log.psychology.kingForward3"
      );
    } else if (isKnightMove && threatenedPieces > 0) {
      psychologyMessages.push(
        "gameRoom.log.psychology.knightThreat1",
        "gameRoom.log.psychology.knightThreat2",
        "gameRoom.log.psychology.knightThreat3"
      );
    } else if (isPawnMove && isForward) {
      psychologyMessages.push(
        "gameRoom.log.psychology.pawnDefensive1",
        "gameRoom.log.psychology.pawnDefensive2",
        "gameRoom.log.psychology.pawnDefensive3"
      );
    } else if (isAggressive) {
      psychologyMessages.push(
        "gameRoom.log.psychology.aggressive1",
        "gameRoom.log.psychology.aggressive2",
        "gameRoom.log.psychology.aggressive3"
      );
    } else {
      psychologyMessages.push(
        "gameRoom.log.psychology.defensive1",
        "gameRoom.log.psychology.defensive2",
        "gameRoom.log.psychology.defensive3",
        "gameRoom.log.psychology.defensive4"
      );
    }
  }

  // Use board state for deterministic but varied selection
  const hash = board.flat().filter(Boolean).length + playerMove.from.r + playerMove.from.c;
  const selectedMessage = psychologyMessages[hash % psychologyMessages.length];
  
  // 개발 환경에서만 분석 결과 로깅
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analyzePlayerPsychology] 분석 결과:', {
      패턴: {
        빠른수: isQuickMove,
        오래고민: isLongThink,
        망설임: hasHesitation,
        중간시간: isMediumTime,
        긴시간_망설임: isLongThink && hasHesitation,
        중간시간_망설임: isMediumTime && hasHesitation
      },
      데이터: {
        moveTimeSeconds,
        hoverCount,
        hasTimeData
      },
      선택된메시지: selectedMessage,
      가능한메시지수: psychologyMessages.length
    });
  }
  
  return selectedMessage;
}

/**
 * Enhanced AI with sacrifice tactics and positional awareness
 * Implements "Move 37" philosophy: sometimes losing a piece is necessary
 * Returns both the move and a single psychological insight message
 * 
 * @param difficulty - AI difficulty level: "NEXUS-3" (쉬움), "NEXUS-5" (보통), "NEXUS-7" (어려움)
 */
export function runMiniChessSearch(
  board: Board,
  playerLastMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece, moveTimeSeconds?: number, hoverCount?: number } | null = null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): { 
  move: { from: { r: number, c: number }, to: { r: number, c: number } } | null;
  logs: string[];
} {
  // For NEXUS-7, use minimax algorithm for optimal play
  if (difficulty === "NEXUS-7") {
    let aiMoves = getAllMoves(board, false);
    
    if (aiMoves.length === 0) {
      return { 
        move: null, 
        logs: ["gameRoom.log.calculationErrorKo"]
      };
    }
    
    // 반복 수 필터링: 3회 반복을 일으키는 수 제거
    if (boardHistory && boardHistory.length > 0) {
      aiMoves = aiMoves.filter(move => 
        !wouldCauseThreefoldRepetition(board, move.from, move.to, boardHistory)
      );
      
      // 모든 수가 반복 수라면 필터링하지 않음 (필수 수가 없는 경우)
      if (aiMoves.length === 0) {
        aiMoves = getAllMoves(board, false);
      }
    }
    
    // 즉시 승리 조건 우선 탐지 (NEXUS-5와 동일한 로직)
    const immediateWinMoves: Array<{ from: { r: number, c: number }, to: { r: number, c: number } }> = [];
    
    for (const move of aiMoves) {
      const piece = board[move.from.r][move.from.c];
      // AI 킹이 행 4에 도달하면 즉시 승리
      if (piece === 'K' && move.to.r === 4) {
        immediateWinMoves.push(move);
      }
      // 플레이어 킹을 잡으면 즉시 승리
      const target = board[move.to.r][move.to.c];
      if (target === 'k') {
        immediateWinMoves.push(move);
      }
    }
    
    // 즉시 승리 수가 있으면 무조건 선택
    if (immediateWinMoves.length > 0) {
      const testBoard = makeMove(board, immediateWinMoves[0].from, immediateWinMoves[0].to);
      const winner = checkWinner(testBoard, turnCount);
      if (winner === 'ai') {
        const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
        return { 
          move: immediateWinMoves[0],
          logs: [psychologicalInsight]
        };
      }
    }
    
    const depth = 6;
    const movesWithScores: Array<{
      move: { from: { r: number, c: number }, to: { r: number, c: number } };
      score: number;
    }> = [];
    
    // Evaluate each move using minimax
    for (const move of aiMoves) {
      const newBoard = makeMove(board, move.from, move.to);
      // Pass turnCount to minimax for accurate draw detection
      let score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, turnCount);
      
      // 반복 수에 페널티 부여 (필터링되지 않은 경우)
      if (boardHistory && boardHistory.length > 0) {
        const resultingFen = generateFen(newBoard);
        const occurrenceCount = boardHistory.filter(fen => fen === resultingFen).length;
        if (occurrenceCount >= 1) {
          // 이미 한 번 나타난 보드 상태면 페널티 (반복 경향)
          score -= 50 * occurrenceCount;
        }
      }
      
      movesWithScores.push({ move, score });
    }
    
    // Sort by score (descending - higher is better for AI)
    movesWithScores.sort((a, b) => b.score - a.score);
    
    // Select best move with 99% probability, or second best with 1% (for minimal variety)
    let selectedMove;
    const random = Math.random();
    if (random < 0.99 || movesWithScores.length === 1) {
      // 99% 확률로 최적 수 선택
      selectedMove = movesWithScores[0].move;
    } else {
      // 1% 확률로 2번째 최적 수 선택 (최소한의 다양성)
      if (movesWithScores.length > 1) {
        selectedMove = movesWithScores[1].move;
      } else {
        selectedMove = movesWithScores[0].move;
      }
    }
    
    // Generate single psychological insight message
    const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
    
    return { 
      move: selectedMove,
      logs: [psychologicalInsight]
    };
  }
  
  // For NEXUS-5, use minimax algorithm with depth 4 for improved play
  if (difficulty === "NEXUS-5") {
    let aiMoves = getAllMoves(board, false);
    
    if (aiMoves.length === 0) {
      return { 
        move: null, 
        logs: ["gameRoom.log.calculationErrorKo"]
      };
    }
    
    // 반복 수 필터링: 3회 반복을 일으키는 수 제거
    if (boardHistory && boardHistory.length > 0) {
      aiMoves = aiMoves.filter(move => 
        !wouldCauseThreefoldRepetition(board, move.from, move.to, boardHistory)
      );
      
      // 모든 수가 반복 수라면 필터링하지 않음 (필수 수가 없는 경우)
      if (aiMoves.length === 0) {
        aiMoves = getAllMoves(board, false);
      }
    }
    
    // 즉시 승리 조건 우선 탐지
    const immediateWinMoves: Array<{ from: { r: number, c: number }, to: { r: number, c: number } }> = [];
    
    for (const move of aiMoves) {
      const piece = board[move.from.r][move.from.c];
      // AI 킹이 행 4에 도달하면 즉시 승리
      if (piece === 'K' && move.to.r === 4) {
        immediateWinMoves.push(move);
      }
      // 플레이어 킹을 잡으면 즉시 승리
      const target = board[move.to.r][move.to.c];
      if (target === 'k') {
        immediateWinMoves.push(move);
      }
    }
    
    // 즉시 승리 수가 있으면 무조건 선택
    if (immediateWinMoves.length > 0) {
      const testBoard = makeMove(board, immediateWinMoves[0].from, immediateWinMoves[0].to);
      const winner = checkWinner(testBoard, turnCount);
      if (winner === 'ai') {
        const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
        return { 
          move: immediateWinMoves[0],
          logs: [psychologicalInsight]
        };
      }
    }
    
    // 미니맥스 알고리즘 적용 (깊이 4 - NEXUS-7보다 낮지만 강력함)
    // Depth 4 provides good balance between strength and speed
    const depth = 4;
    const movesWithScores: Array<{
      move: { from: { r: number, c: number }, to: { r: number, c: number } };
      score: number;
    }> = [];
    
    // 각 수를 미니맥스로 평가
    for (const move of aiMoves) {
      const newBoard = makeMove(board, move.from, move.to);
      let score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, turnCount);
      
      // 반복 수에 페널티 부여 (필터링되지 않은 경우)
      if (boardHistory && boardHistory.length > 0) {
        const resultingFen = generateFen(newBoard);
        const occurrenceCount = boardHistory.filter(fen => fen === resultingFen).length;
        if (occurrenceCount >= 1) {
          // 이미 한 번 나타난 보드 상태면 페널티 (반복 경향)
          score -= 50 * occurrenceCount;
        }
      }
      
      movesWithScores.push({ move, score });
    }
    
    // 점수순 정렬
    movesWithScores.sort((a, b) => b.score - a.score);
    
    // 최적 수 선택 확률 85% (기존 60%에서 대폭 증가)
    let selectedMove;
    const bestScore = movesWithScores[0]?.score ?? -Infinity;
    const secondBestScore = movesWithScores[1]?.score ?? -Infinity;
    const scoreDifference = bestScore - secondBestScore;
    
    // 명확한 승리 조건이거나 점수 차이가 크면 항상 최적 수 선택
    if (bestScore > 5000 || scoreDifference > 500 || movesWithScores.length === 1) {
      selectedMove = movesWithScores[0].move;
    } else {
      // 그 외에는 85% 확률로 최적 수 선택
      const random = Math.random();
      if (random < 0.85) {
        selectedMove = movesWithScores[0].move;
      } else {
        // 15% 확률로 2번째 최적 수 선택
        if (movesWithScores.length > 1) {
          selectedMove = movesWithScores[1].move;
        } else {
          selectedMove = movesWithScores[0].move;
        }
      }
    }
    
    const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
    
    return { 
      move: selectedMove,
      logs: [psychologicalInsight]
    };
  }
  
  // For NEXUS-3, use heuristic-based approach with more mistakes
  const moves: { 
    from: { r: number, c: number }, 
    to: { r: number, c: number }, 
    score: number
  }[] = [];

  // Find player king position for check/threat calculation
  let playerKingPos: { r: number, c: number } | null = null;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'k') {
        playerKingPos = { r, c };
        break;
      }
    }
    if (playerKingPos) break;
  }

  // Find AI king position for safety evaluation
  let aiKingPos: { r: number, c: number } | null = null;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'K') {
        aiKingPos = { r, c };
        break;
      }
    }
    if (aiKingPos) break;
  }

  // Deep analysis: Evaluate all possible moves with comprehensive scoring
  let evaluatedMoves = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (piece && piece === piece.toUpperCase()) { // AI piece
        // Try all moves
        for (let tr = 0; tr < 5; tr++) {
          for (let tc = 0; tc < 5; tc++) {
            if (isValidMove(board, { r, c }, { r: tr, c: tc }, false)) {
              evaluatedMoves++;
              let score = 0;
              const target = board[tr][tc];
              const isAdvance = tr > r; // Moving forward (toward player side)
              const isCheck = playerKingPos && 
                Math.abs(tr - playerKingPos.r) <= 1 && 
                Math.abs(tc - playerKingPos.c) <= 1;
              
              // Material value (capture)
              if (target) {
                if (target === 'k') score += 1000; // King capture = instant win
                else if (target === 'n') score += 5;
                else if (target === 'p') score += 1;
              }
              
              // Positional bonuses
              if (isAdvance) score += 2; // Forward movement
              if (isCheck) score += 10; // Threatening player king
              
              // Center control (middle squares are more valuable)
              const centerDistance = Math.abs(tr - 2) + Math.abs(tc - 2);
              score += (5 - centerDistance) * 0.5;
              
              // Enhanced King advancement with accurate threat assessment
              // AI starts at row 0, needs to reach row 4 to win
              if (piece === 'K') {
                // Base advancement bonus: linear progression
                score += tr * 4;
                
                // Exponential proximity bonus: closer to goal = exponentially higher value
                const distanceToVictory = 4 - tr;
                if (distanceToVictory <= 2) {
                  // Within 2 rows: exponential bonus
                  const proximityBonus = Math.pow(3, 3 - distanceToVictory) * 2;
                  score += proximityBonus;
                }
                
                // Victory condition bonus: if king reaches row 4, massive bonus
                if (tr === 4) {
                  score += 500; // Instant win condition
                }
                
                // Check if this move actually improves king safety or maintains it
                // Only penalize if moving INTO actual danger, not just proximity
                if (playerKingPos) {
                  const canPlayerCapture = isValidMove(board, playerKingPos, { r: tr, c: tc }, true);
                  if (canPlayerCapture) {
                    // Moving into actual capture range - strong penalty
                    score -= 200;
                  } else {
                    // Check if moving away from potential threats
                    const currentThreat = isValidMove(board, playerKingPos, { r, c }, true);
                    const newThreat = isValidMove(board, playerKingPos, { r: tr, c: tc }, true);
                    if (currentThreat && !newThreat) {
                      // Escaping from actual threat - bonus
                      score += 50;
                    }
                  }
                }
              }
              
              // Deep analysis: Check if this move threatens multiple pieces
              const testBoard = makeMove(board, { r, c }, { r: tr, c: tc });
              let threatCount = 0;
              for (let tr2 = 0; tr2 < 5; tr2++) {
                for (let tc2 = 0; tc2 < 5; tc2++) {
                  if (isValidMove(testBoard, { r: tr, c: tc }, { r: tr2, c: tc2 }, false)) {
                    const threatTarget = testBoard[tr2][tc2];
                    // Player pieces are lowercase
                    if (threatTarget && threatTarget === threatTarget.toLowerCase() && threatTarget !== threatTarget.toUpperCase()) {
                      threatCount++;
                    }
                  }
                }
              }
              score += threatCount * 2;
              
              // 반복 수에 페널티 부여 (NEXUS-3)
              if (boardHistory && boardHistory.length > 0) {
                const testBoard = makeMove(board, { r, c }, { r: tr, c: tc });
                const resultingFen = generateFen(testBoard);
                const occurrenceCount = boardHistory.filter(fen => fen === resultingFen).length;
                if (occurrenceCount >= 1) {
                  // 이미 한 번 나타난 보드 상태면 페널티 (반복 경향)
                  score -= 30 * occurrenceCount;
                }
              }
              
              // Add small random factor to break ties and prevent deterministic play
              // This ensures AI doesn't play the exact same game every time
              // Range: 0.0 to 0.3 (small enough not to override strategy, large enough to add variety)
              const tieBreaker = Math.random() * 0.3;
              score += tieBreaker;
              
              moves.push({ 
                from: { r, c }, 
                to: { r: tr, c: tc }, 
                score
              });
            }
          }
        }
      }
    }
  }

  if (moves.length === 0) {
    return { 
      move: null, 
      logs: ["gameRoom.log.calculationErrorKo"]
    };
  }

  // Sort by score desc (with stable sort to preserve order for tie-breaking)
  moves.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    // If scores are very close (within 0.5), consider them equal for variety
    if (Math.abs(scoreDiff) < 0.5) {
      return 0; // Treat as equal, will use random selection
    }
    return scoreDiff;
  });
  
  // Group moves by similar scores (within 1.0 point range) for better variety
  const scoreGroups: typeof moves[] = [];
  let currentGroup: typeof moves = [];
  let currentScore = moves[0]?.score ?? 0;
  
  for (const move of moves) {
    if (Math.abs(move.score - currentScore) <= 1.0 && currentGroup.length > 0) {
      // Similar score, add to current group
      currentGroup.push(move);
    } else {
      // Different score range, start new group
      if (currentGroup.length > 0) {
        scoreGroups.push(currentGroup);
      }
      currentGroup = [move];
      currentScore = move.score;
    }
  }
  if (currentGroup.length > 0) {
    scoreGroups.push(currentGroup);
  }
  
  // Difficulty-based move selection with improved logic
  // Default to first move if difficulty is not NEXUS-3 (shouldn't happen, but safety check)
  let selectedMove = moves[0];
  
  if (difficulty === "NEXUS-3") {
    // 쉬움: 더 많은 실수, 랜덤성 증가
    // 상위 60%의 수 중에서 랜덤 선택 (최적 수 선택 확률 15%)
    const candidateRange = Math.floor(moves.length * 0.6);
    const candidateMoves = moves.slice(0, Math.max(1, candidateRange));
    
    if (candidateMoves.length === 0) {
      // Fallback: use first move if no candidates
      selectedMove = moves[0];
    } else {
      const random = Math.random();
      if (random < 0.15 && scoreGroups[0] && scoreGroups[0].length > 0) {
        // 15% 확률로 최적 수 그룹에서 랜덤 선택
        const bestGroup = scoreGroups[0];
        const randomIndex = Math.floor(Math.random() * bestGroup.length);
        selectedMove = bestGroup[randomIndex];
      } else {
        // 85% 확률로 중간~하위 수준의 수 선택
        const randomIndex = Math.floor(Math.random() * candidateMoves.length);
        selectedMove = candidateMoves[randomIndex];
      }
    }
  }
  
  // Safety check: ensure selectedMove is defined
  if (!selectedMove) {
    return {
      move: null,
      logs: ["gameRoom.log.calculationErrorNoSelection"]
    };
  }
  
  // Generate single psychological insight message
  const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
  
  return { 
    move: { from: selectedMove.from, to: selectedMove.to },
    logs: [psychologicalInsight]
  };
}

/**
 * Async AI move calculation (uses Web Worker)
 */
export async function getAIMove(
  board: Board,
  playerLastMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece, moveTimeSeconds?: number, hoverCount?: number } | null = null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number,
  boardHistory?: string[]
): Promise<{ 
  move: { from: { r: number, c: number }, to: { r: number, c: number } } | null;
  logs: string[];
}> {
  try {
    const { getMiniChessWorkerPool } = await import("./miniChessWorkerPool");
    const workerPool = getMiniChessWorkerPool();
    
    // Convert Board array to FEN string for worker transfer
    const { generateFen } = await import("./boardUtils");
    const boardState = generateFen(board);
    
    const result = await workerPool.calculateMove(boardState, playerLastMove, difficulty, turnCount, boardHistory);
    
    // Result move is GameMove, we need to return what we promised
    // The type matches: { from: {r,c}, to: {r,c} }
    return result;
  } catch (error) {
    console.warn('[getAIMove] Worker failed, falling back to synchronous:', error);
    const result = runMiniChessSearch(board, playerLastMove, difficulty, turnCount, boardHistory);
    return result;
  }
}

