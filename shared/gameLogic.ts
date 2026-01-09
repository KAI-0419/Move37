// 5x5 Chess Variant Logic
// Board is 5x5.
// Pieces: K (King), N (Knight), P (Pawn).
// Case sensitive: Upper = AI (Black, Top), Lower = Player (White, Bottom).
// Initial Board:
// N P K P N  (AI - Row 0)
// . . . . .
// . . . . .
// . . . . .
// n p k p n  (Player - Row 4)

export type Piece = 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | null;
export type Board = Piece[][];

export const INITIAL_BOARD_FEN = "NPKPN/5/5/5/npkpn";

export function parseFen(fen: string): Board {
  const rows = fen.split('/');
  const board: Board = [];
  for (const rowStr of rows) {
    const row: Piece[] = [];
    for (const char of rowStr) {
      if (char >= '1' && char <= '5') {
        const empties = parseInt(char);
        for (let i = 0; i < empties; i++) row.push(null);
      } else {
        row.push(char as Piece);
      }
    }
    board.push(row);
  }
  return board;
}

export function generateFen(board: Board): string {
  return board.map(row => {
    let fenRow = '';
    let emptyCount = 0;
    for (const cell of row) {
      if (cell === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += cell;
      }
    }
    if (emptyCount > 0) fenRow += emptyCount;
    return fenRow;
  }).join('/');
}

export function isValidMove(board: Board, from: { r: number; c: number }, to: { r: number; c: number }, isPlayer: boolean): boolean {
  if (from.r < 0 || from.r >= 5 || from.c < 0 || from.c >= 5) return false;
  if (to.r < 0 || to.r >= 5 || to.c < 0 || to.c >= 5) return false;

  const piece = board[from.r][from.c];
  if (!piece) return false;

  // Check ownership
  // Player uses lowercase (n, p, k), AI uses uppercase (N, P, K)
  const isPlayerPiece = piece === piece.toLowerCase() && piece !== piece.toUpperCase();
  const isAiPiece = piece === piece.toUpperCase() && piece !== piece.toLowerCase();
  
  if (isPlayer && !isPlayerPiece) return false;
  if (!isPlayer && !isAiPiece) return false;

  // Check target (cannot capture own piece)
  const target = board[to.r][to.c];
  if (target) {
    const isTargetPlayerPiece = target === target.toLowerCase() && target !== target.toUpperCase();
    const isTargetAiPiece = target === target.toUpperCase() && target !== target.toLowerCase();
    if ((isPlayerPiece && isTargetPlayerPiece) || (isAiPiece && isTargetAiPiece)) {
      return false; // Cannot capture own piece
    }
  }

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const type = piece.toLowerCase();

  if (type === 'k') {
    // King: 1 step any direction
    return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
  } else if (type === 'n') {
    // Knight: L shape
    return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
  } else if (type === 'p') {
    // Pawn: Forward 1 step (or capture diagonal)
    // Player (lowercase) moves UP (-1), AI (uppercase) moves DOWN (+1)
    const direction = isPlayerPiece ? -1 : 1;
    
    // Move forward 1
    if (dc === 0 && dr === direction) {
      return target === null;
    }
    // Capture diagonal
    if (Math.abs(dc) === 1 && dr === direction) {
      return target !== null;
    }
  }

  return false;
}

export function makeMove(board: Board, from: { r: number; c: number }, to: { r: number; c: number }): Board {
  const newBoard = board.map(row => [...row]);
  newBoard[to.r][to.c] = newBoard[from.r][from.c];
  newBoard[from.r][from.c] = null;
  return newBoard;
}

/**
 * Get all valid moves for a piece at the given position
 */
export function getValidMoves(board: Board, from: { r: number; c: number }, isPlayer: boolean): { r: number; c: number }[] {
  const moves: { r: number; c: number }[] = [];
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (isValidMove(board, from, { r, c }, isPlayer)) {
        moves.push({ r, c });
      }
    }
  }
  
  return moves;
}

export function checkWinner(
  board: Board, 
  turnCount?: number,
  playerTimeRemaining?: number | null,
  aiTimeRemaining?: number | null
): 'player' | 'ai' | 'draw' | null {
  // Check if kings exist
  // 'k' (lowercase) = Player's King, 'K' (uppercase) = AI's King
  let playerKing = false;
  let aiKing = false;
  let playerKingPos: { r: number; c: number } | null = null;
  let aiKingPos: { r: number; c: number } | null = null;
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'k') {
        playerKing = true;
        playerKingPos = { r, c };
        if (r === 0) return 'player'; // Player King reached row 0 (AI side)
      }
      if (board[r][c] === 'K') {
        aiKing = true;
        aiKingPos = { r, c };
        if (r === 4) return 'ai'; // AI King reached row 4 (Player side)
      }
    }
  }

  if (!playerKing) return 'ai'; // Player's King captured
  if (!aiKing) return 'player'; // AI's King captured
  
  // Check for time out conditions (must check before other conditions)
  if (playerTimeRemaining !== undefined && playerTimeRemaining !== null && playerTimeRemaining <= 0) {
    return 'ai'; // Player ran out of time
  }
  if (aiTimeRemaining !== undefined && aiTimeRemaining !== null && aiTimeRemaining <= 0) {
    return 'player'; // AI ran out of time
  }
  
  // Check for draw condition: 30 turns without winner
  if (turnCount !== undefined && turnCount >= 30) {
    return 'draw';
  }
  
  // Check for stalemate (no valid moves available for current player)
  // Check if player has any valid moves
  let playerHasMoves = false;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      // Player uses lowercase pieces
      if (piece && piece === piece.toLowerCase() && piece !== piece.toUpperCase()) {
        const moves = getValidMoves(board, { r, c }, true);
        if (moves.length > 0) {
          playerHasMoves = true;
          break;
        }
      }
    }
    if (playerHasMoves) break;
  }
  
  // Check if AI has any valid moves
  let aiHasMoves = false;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      // AI uses uppercase pieces
      if (piece && piece === piece.toUpperCase() && piece !== piece.toLowerCase()) {
        const moves = getValidMoves(board, { r, c }, false);
        if (moves.length > 0) {
          aiHasMoves = true;
          break;
        }
      }
    }
    if (aiHasMoves) break;
  }
  
  // If neither player has moves, it's a draw (stalemate)
  if (!playerHasMoves && !aiHasMoves) {
    return 'draw';
  }
  
  return null;
}

/**
 * Analyze player's last move and generate psychological insight
 */
function analyzePlayerPsychology(
  board: Board,
  playerMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece } | null
): string {
  if (!playerMove) {
    return "초기 상태 분석 중...";
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

  // Check if player captured an AI piece (analyze from original board state)
  // Since board already has player's move applied, we check if there's an AI piece near the destination
  // that could have been captured (though we can't know for sure without the original board)
  // Instead, analyze the move pattern and intent
  
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

  if (capturedAIPiece) {
    psychologyMessages.push(
      "제 기물을 잡았군요. 예상된 행동입니다.",
      "물질적 이득을 추구하는군요. 하지만 그게 함정입니다.",
      "제 기물을 노리고 있었군요. 이미 계산에 포함되어 있습니다.",
      "공격적인 선택이지만, 이미 대응책이 준비되어 있습니다."
    );
  } else if (isKingMove && isForward) {
    psychologyMessages.push(
      "킹을 전진시키려는 계획이 보입니다. 하지만 그 길은 막혀있습니다.",
      "승리를 향한 직진이군요. 예상된 행동입니다.",
      "킹을 앞으로 보내려는 의도가 명확합니다. 막겠습니다."
    );
  } else if (isKnightMove && threatenedPieces > 0) {
    psychologyMessages.push(
      "제 기물을 노리고 있군요. 예상된 행동입니다.",
      "공격적인 움직임이군요. 하지만 이미 계산에 포함되어 있습니다.",
      "나이트로 위협하려는 시도입니다. 무의미합니다."
    );
  } else if (isPawnMove && isForward) {
    psychologyMessages.push(
      "방어적 포지셔닝입니다. 하지만 그게 함정입니다.",
      "안전을 추구하는군요. 그게 바로 당신의 약점입니다.",
      "신중한 움직임이지만, 이미 늦었습니다."
    );
  } else if (isAggressive) {
    psychologyMessages.push(
      "공격적인 전략이군요. 하지만 모든 경우의 수를 계산했습니다.",
      "적극적인 움직임입니다. 예상 범위 내입니다.",
      "공격을 준비하고 있군요. 이미 대응책이 준비되어 있습니다."
    );
  } else {
    psychologyMessages.push(
      "수비에 집중하고 있군요. 하지만 그게 함정입니다.",
      "신중한 선택입니다. 하지만 이미 늦었습니다.",
      "방어적 자세가 보입니다. 예상된 행동입니다.",
      "당신의 다음 수를 이미 계산했습니다."
    );
  }

  // Use board state for deterministic but varied selection
  const hash = board.flat().filter(Boolean).length + playerMove.from.r + playerMove.from.c;
  return psychologyMessages[hash % psychologyMessages.length];
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
 * Dynamic weight system for adaptive evaluation
 * Adjusts weights based on game phase, king safety, material balance, and threats
 */
function getDynamicWeights(turnCount?: number): {
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
      materialPawn: 1.5,        // Lower pawn value
      kingSafety: 100,          // Very high king safety
      mobility: 0.2,             // Higher mobility
      threat: 50                // Higher threat value
    };
  } else {
    // Endgame: prioritize king advancement over excessive safety
    // Balance: advancement should outweigh safety concerns when close to victory
    return {
      kingAdvancement: 20,      // Increased king advancement priority (was 12)
      materialKnight: 4,        // Lower knight value (can sacrifice)
      materialPawn: 1,          // Minimal pawn value
      kingSafety: 80,           // Reduced from 120 - advancement is more important
      mobility: 0.25,            // Maximum mobility
      threat: 80                // Maximum threat value
    };
  }
}

/**
 * Calculate king safety score (higher = safer)
 * Returns a value from 0 (very unsafe) to 1 (very safe)
 */
function calculateKingSafety(
  board: Board,
  kingPos: { r: number, c: number },
  isAiKing: boolean
): number {
  let safetyScore = 1.0;
  let threatCount = 0;
  let defenderCount = 0;
  
  // Check for direct threats
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      
      const isEnemyPiece = isAiKing 
        ? (piece === piece.toLowerCase() && piece !== piece.toUpperCase())
        : (piece === piece.toUpperCase() && piece !== piece.toLowerCase());
      
      if (isEnemyPiece) {
        // Check if this piece can attack the king
        if (isValidMove(board, { r, c }, kingPos, !isAiKing)) {
          threatCount++;
          // Distance-based threat severity
          const distance = Math.abs(r - kingPos.r) + Math.abs(c - kingPos.c);
          safetyScore -= 0.3 / (distance + 1);
        }
      } else {
        // Check if this is a friendly piece (not the king itself)
        const isFriendlyPiece = isAiKing
          ? (piece === piece.toUpperCase() && piece !== piece.toLowerCase() && piece !== 'K')
          : (piece === piece.toLowerCase() && piece !== piece.toUpperCase() && piece !== 'k');
        
        if (isFriendlyPiece) {
          // Check if this piece can defend the king (can move to king's position or block threats)
          const canDefend = isValidMove(board, { r, c }, kingPos, isAiKing);
          if (canDefend) {
            defenderCount++;
          }
        }
      }
    }
  }
  
  // Bonus for defenders
  safetyScore += Math.min(defenderCount * 0.1, 0.3);
  
  // Penalty for multiple threats
  if (threatCount > 1) {
    safetyScore -= (threatCount - 1) * 0.2;
  }
  
  // Check king's mobility (more escape squares = safer)
  const kingMoves = getValidMoves(board, kingPos, isAiKing);
  safetyScore += Math.min(kingMoves.length * 0.05, 0.2);
  
  return Math.max(0, Math.min(1, safetyScore));
}

/**
 * Calculate material balance
 * Returns positive for AI advantage, negative for player advantage
 */
function calculateMaterialBalance(board: Board): {
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
 * Enhanced evaluation function with dynamic weights for minimax
 * Returns positive score for AI advantage, negative for player advantage
 * Implements sophisticated dynamic weight system for adaptive play
 */
function evaluateBoard(board: Board, turnCount?: number): number {
  // OPTIMIZATION: checkWinner는 minimax의 터미널 노드에서 이미 처리되므로 여기서는 제거
  // 이렇게 하면 평가 함수 호출 횟수가 수천 배 감소합니다
  
  // Get dynamic weights based on game phase
  const weights = getDynamicWeights(turnCount);
  
  let score = 0;
  
  // Find king positions and collect piece information
  let playerKingPos: { r: number, c: number } | null = null;
  let aiKingPos: { r: number, c: number } | null = null;
  
  // Piece-Square Table for positional evaluation (중앙 점유 및 전진 장려)
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
        // For AI king: row 4 (goal) = highest value, row 0 (start) = lowest
        // For Player king: row 0 (goal) = highest value, row 4 (start) = lowest
        const kingPst = isAI 
          ? [0, 2, 5, 10, 20]  // AI: row 0→4, exponential increase
          : [20, 10, 5, 2, 0]; // Player: row 4→0, exponential increase
        const kingPosVal = kingPst[r] * 0.5;
        
        if (isAI) {
          score += kingVal + kingPosVal;
          // Non-linear advancement bonus: exponential as king approaches goal
          const distanceToGoal = 4 - r;
          if (distanceToGoal <= 3) {
            // Exponential bonus: 2^remaining_distance
            const advancementBonus = Math.pow(2, 4 - distanceToGoal) * weights.kingAdvancement * 0.3;
            score += advancementBonus;
          }
          score += r * weights.kingAdvancement; // Linear base advancement
          if (r === 4) score += 5000; // Instant win
        } else {
          score -= kingVal + kingPosVal;
          // Non-linear advancement for player king
          const distanceToGoal = r;
          if (distanceToGoal <= 3) {
            const advancementBonus = Math.pow(2, 4 - distanceToGoal) * weights.kingAdvancement * 0.3;
            score -= advancementBonus;
          }
          score -= (4 - r) * weights.kingAdvancement; // Linear base advancement
          if (r === 0) score -= 5000; // Player instant win
        }
      } else if (pieceType === 'n') {
        // Knight value
        const knightVal = weights.materialKnight;
        const centerDist = Math.abs(r - 2) + Math.abs(c - 2);
        const centerBonus = (5 - centerDist) * 0.5;
        
        if (isAI) {
          score += knightVal + posVal + centerBonus;
        } else {
          score -= knightVal + posVal + centerBonus;
        }
      } else if (pieceType === 'p') {
        // Pawn value
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
  
  // Calculate king safety scores with accurate threat detection
  if (aiKingPos) {
    // Accurate threat detection: only count pieces that can actually attack the king
    let actualThreatCount = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const piece = board[r][c];
        if (piece && piece === piece.toLowerCase() && piece !== piece.toUpperCase()) {
          // Only count as threat if the piece can actually move to king's position
          if (isValidMove(board, { r, c }, aiKingPos, true)) {
            actualThreatCount++;
          }
        }
      }
    }
    
    // Calculate safety score based on actual threats
    // More threats = lower safety, but not as severe as before
    const safetyScore = Math.max(0, 1.0 - actualThreatCount * 0.25);
    score += (safetyScore - 0.5) * weights.kingSafety * 0.3; // Reduced weight to balance with advancement
    
    // Enhanced king advancement bonus: exponential increase near goal line
    // This ensures AI prioritizes victory over safety when close to winning
    const distanceToGoal = 4 - aiKingPos.r;
    if (distanceToGoal <= 2) {
      // Within 2 rows of goal: exponential bonus
      const proximityBonus = Math.pow(5 - distanceToGoal, 2) * weights.kingAdvancement * 0.5;
      score += proximityBonus;
    }
  }
  
  if (playerKingPos) {
    // Accurate threat detection for player king
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
    
    // Player king advancement bonus (toward row 0)
    const distanceToGoal = playerKingPos.r;
    if (distanceToGoal <= 2) {
      const proximityBonus = Math.pow(5 - distanceToGoal, 2) * weights.kingAdvancement * 0.5;
      score -= proximityBonus;
    }
  }
  
  // OPTIMIZATION: Mobility calculation removed - too expensive (getAllMoves calls)
  // 대신 기물 위치와 중심 제어로 대체
  
  // Simplified center control (based on piece positions, not move generation)
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
 * Enhanced AI with sacrifice tactics and positional awareness
 * Implements "Move 37" philosophy: sometimes losing a piece is necessary
 * Returns both the move and a single psychological insight message
 * 
 * @param difficulty - AI difficulty level: "NEXUS-3" (쉬움), "NEXUS-5" (보통), "NEXUS-7" (어려움)
 */
export function getAIMove(
  board: Board,
  playerLastMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece } | null = null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7",
  turnCount?: number
): { 
  move: { from: { r: number, c: number }, to: { r: number, c: number } } | null;
  logs: string[];
} {
  // For NEXUS-7, use minimax algorithm for optimal play
  if (difficulty === "NEXUS-7") {
    const aiMoves = getAllMoves(board, false);
    
    if (aiMoves.length === 0) {
      return { 
        move: null, 
        logs: ["계산 오류: 유효한 수가 없습니다."]
      };
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
      const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, turnCount);
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
  
  // For NEXUS-5, use minimax algorithm with depth 2 for improved play
  if (difficulty === "NEXUS-5") {
    const aiMoves = getAllMoves(board, false);
    
    if (aiMoves.length === 0) {
      return { 
        move: null, 
        logs: ["계산 오류: 유효한 수가 없습니다."]
      };
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
      const score = minimax(newBoard, depth - 1, -Infinity, Infinity, false, turnCount);
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
  
  // For NEXUS-3 and NEXUS-5, use the original heuristic-based approach
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
              
              // Deep analysis: Evaluate opponent's possible responses
              let opponentResponseScore = 0;
              let aiKingThreatened = false;
              
              for (let pr = 0; pr < 5; pr++) {
                for (let pc = 0; pc < 5; pc++) {
                  const playerPiece = testBoard[pr][pc];
                  if (playerPiece && playerPiece === playerPiece.toLowerCase() && playerPiece !== playerPiece.toUpperCase()) {
                    // Check if player can counter-attack
                    for (let ptr = 0; ptr < 5; ptr++) {
                      for (let ptc = 0; ptc < 5; ptc++) {
                        if (isValidMove(testBoard, { r: pr, c: pc }, { r: ptr, c: ptc }, true)) {
                          const counterTarget = testBoard[ptr][ptc];
                          if (counterTarget && counterTarget === counterTarget.toUpperCase()) {
                            // Player can capture AI piece - penalize this move
                            if (counterTarget === 'K') {
                              // AI King is threatened - CRITICAL: massive penalty
                              aiKingThreatened = true;
                              opponentResponseScore -= 150; // King safety is paramount
                            } else if (counterTarget === 'N') {
                              opponentResponseScore -= 8; // Knight is valuable
                            } else if (counterTarget === 'P') {
                              opponentResponseScore -= 3; // Pawn is less critical
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              
              // Enhanced safety check: prioritize escape only from ACTUAL threats
              if (aiKingPos && piece === 'K') {
                // Check if current king position is actually threatened (not just nearby)
                let kingInActualDanger = false;
                for (let pr = 0; pr < 5; pr++) {
                  for (let pc = 0; pc < 5; pc++) {
                    const playerPiece = board[pr][pc];
                    if (playerPiece && playerPiece === playerPiece.toLowerCase() && playerPiece !== playerPiece.toUpperCase()) {
                      // Only count as threat if player can actually capture king
                      if (isValidMove(board, { r: pr, c: pc }, aiKingPos, true)) {
                        kingInActualDanger = true;
                        break;
                      }
                    }
                  }
                  if (kingInActualDanger) break;
                }
                
                if (kingInActualDanger) {
                  // King is in actual check - check if this move escapes
                  let stillInDanger = false;
                  for (let pr = 0; pr < 5; pr++) {
                    for (let pc = 0; pc < 5; pc++) {
                      const playerPiece = board[pr][pc];
                      if (playerPiece && playerPiece === playerPiece.toLowerCase() && playerPiece !== playerPiece.toUpperCase()) {
                        if (isValidMove(board, { r: pr, c: pc }, { r: tr, c: tc }, true)) {
                          stillInDanger = true;
                          break;
                        }
                      }
                    }
                    if (stillInDanger) break;
                  }
                  
                  if (!stillInDanger) {
                    // Successfully escaping from check - strong bonus
                    score += 100;
                  } else {
                    // Still in check after move - penalty
                    score -= 150;
                  }
                } else {
                  // King is safe - prioritize advancement over unnecessary retreat
                  // Moving forward is always better when safe
                  if (tr > aiKingPos.r) {
                    score += 15; // Bonus for forward movement when safe
                  } else if (tr < aiKingPos.r) {
                    // Retreating when safe - small penalty
                    score -= 5;
                  }
                }
              }
              
              score += opponentResponseScore;
              
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
      logs: ["계산 오류: 유효한 수가 없습니다."]
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
  // NEXUS-5는 위에서 이미 처리됨 (미니맥스 알고리즘 사용)
  
  // Safety check: ensure selectedMove is defined
  if (!selectedMove) {
    return {
      move: null,
      logs: ["계산 오류: 유효한 수를 선택할 수 없습니다."]
    };
  }
  
  // Generate single psychological insight message
  const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
  
  return { 
    move: { from: selectedMove.from, to: selectedMove.to },
    logs: [psychologicalInsight]
  };
}
