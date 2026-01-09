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

export function checkWinner(board: Board, turnCount?: number): 'player' | 'ai' | 'draw' | null {
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
 * Enhanced AI with sacrifice tactics and positional awareness
 * Implements "Move 37" philosophy: sometimes losing a piece is necessary
 * Returns both the move and a single psychological insight message
 * 
 * @param difficulty - AI difficulty level: "NEXUS-3" (쉬움), "NEXUS-5" (보통), "NEXUS-7" (어려움)
 */
export function getAIMove(
  board: Board,
  playerLastMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece } | null = null,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7"
): { 
  move: { from: { r: number, c: number }, to: { r: number, c: number } } | null;
  logs: string[];
} {
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
              
              // FIXED: King advancement (AI king moving toward player side = row 4)
              // AI starts at row 0, needs to reach row 4 to win
              // Higher row number = closer to victory = higher score
              if (piece === 'K') {
                // Base advancement bonus: tr * 4 (row 0→4: 0→16 points)
                score += tr * 4;
                // Victory condition bonus: if king reaches row 4, massive bonus
                if (tr === 4) {
                  score += 500; // Instant win condition
                }
                // Proximity bonus: closer to row 4 = exponential bonus
                const distanceToVictory = 4 - tr;
                score += (5 - distanceToVictory) * 2; // 0→4: 5→1 points
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
              
              // Additional safety check: if AI king is currently in danger, prioritize escape
              if (aiKingPos && piece === 'K') {
                // Check if current king position is threatened by player
                let kingInDanger = false;
                for (let pr = 0; pr < 5; pr++) {
                  for (let pc = 0; pc < 5; pc++) {
                    const playerPiece = board[pr][pc];
                    if (playerPiece && playerPiece === playerPiece.toLowerCase() && playerPiece !== playerPiece.toUpperCase()) {
                      if (isValidMove(board, { r: pr, c: pc }, aiKingPos, true)) {
                        kingInDanger = true;
                        break;
                      }
                    }
                  }
                  if (kingInDanger) break;
                }
                
                if (kingInDanger) {
                  // King is in check - prioritize moving away
                  const distanceFromOriginal = Math.abs(tr - aiKingPos.r) + Math.abs(tc - aiKingPos.c);
                  if (distanceFromOriginal > 0) {
                    score += 20; // Bonus for moving away from danger
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
  let selectedMove;
  
  if (difficulty === "NEXUS-3") {
    // 쉬움: 더 많은 실수, 랜덤성 증가
    // 상위 50%의 수 중에서 랜덤 선택 (최적 수 선택 확률 25%)
    const midPoint = Math.floor(moves.length / 2);
    const candidateMoves = moves.slice(0, Math.max(1, midPoint));
    const random = Math.random();
    if (random < 0.25 && scoreGroups[0] && scoreGroups[0].length > 0) {
      // 25% 확률로 최적 수 그룹에서 랜덤 선택
      const bestGroup = scoreGroups[0];
      const randomIndex = Math.floor(Math.random() * bestGroup.length);
      selectedMove = bestGroup[randomIndex];
    } else {
      // 75% 확률로 중간 수준의 수 선택
      const randomIndex = Math.floor(Math.random() * candidateMoves.length);
      selectedMove = candidateMoves[randomIndex];
    }
  } else if (difficulty === "NEXUS-5") {
    // 보통: 중간 수준, 약간의 실수 가능
    // 상위 2개 그룹 중에서 선택하되, 최적 수 선택 확률 60%
    const topGroups = scoreGroups.slice(0, Math.min(2, scoreGroups.length));
    const topMoves = topGroups.flat();
    const random = Math.random();
    if (random < 0.6 && topGroups[0] && topGroups[0].length > 0) {
      // 60% 확률로 최적 수 그룹에서 랜덤 선택
      const bestGroup = topGroups[0];
      const randomIndex = Math.floor(Math.random() * bestGroup.length);
      selectedMove = bestGroup[randomIndex];
    } else {
      // 40% 확률로 상위 2개 그룹 중 랜덤 선택
      const randomIndex = Math.floor(Math.random() * topMoves.length);
      selectedMove = topMoves[randomIndex];
    }
  } else {
    // NEXUS-7 (어려움): 최적 수 선택 확률 90%, 상위 그룹에서만 선택
    // But still add variety within top moves to prevent deterministic play
    const topGroup = scoreGroups[0];
    if (!topGroup || topGroup.length === 0) {
      selectedMove = moves[0];
    } else {
      const random = Math.random();
      if (random < 0.9 || topGroup.length === 1) {
        // 90% 확률로 최적 수 그룹에서 선택
        // Within top group, prefer highest score but allow some variety
        if (topGroup.length === 1) {
          selectedMove = topGroup[0];
        } else {
          // Weighted random: higher scores more likely, but not deterministic
          const sortedTopGroup = [...topGroup].sort((a, b) => b.score - a.score);
          const top3InGroup = sortedTopGroup.slice(0, Math.min(3, sortedTopGroup.length));
          const randomIndex = Math.floor(Math.random() * top3InGroup.length);
          selectedMove = top3InGroup[randomIndex];
        }
      } else {
        // 10% 확률로도 최적 수 그룹 내에서 선택 (but more variety)
        const randomIndex = Math.floor(Math.random() * topGroup.length);
        selectedMove = topGroup[randomIndex];
      }
    }
  }
  
  // Generate single psychological insight message
  const psychologicalInsight = analyzePlayerPsychology(board, playerLastMove);
  
  return { 
    move: { from: selectedMove.from, to: selectedMove.to },
    logs: [psychologicalInsight]
  };
}
