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
  const isWhite = piece === piece.toLowerCase();
  if (isPlayer && !isWhite) return false;
  if (!isPlayer && isWhite) return false;

  // Check target (cannot capture own piece)
  const target = board[to.r][to.c];
  if (target) {
    const isTargetWhite = target === target.toLowerCase();
    if (isWhite === isTargetWhite) return false;
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
    // White moves UP (-1), Black moves DOWN (+1)
    const direction = isWhite ? -1 : 1;
    
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

export function checkWinner(board: Board, turnCount?: number): 'player' | 'ai' | 'draw' | null {
  // Check if kings exist
  let whiteKing = false;
  let blackKing = false;
  let whiteKingPos: { r: number; c: number } | null = null;
  let blackKingPos: { r: number; c: number } | null = null;
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'k') {
        whiteKing = true;
        whiteKingPos = { r, c };
        if (r === 0) return 'player'; // Reached end
      }
      if (board[r][c] === 'K') {
        blackKing = true;
        blackKingPos = { r, c };
        if (r === 4) return 'ai'; // Reached end
      }
    }
  }

  if (!whiteKing) return 'ai';
  if (!blackKing) return 'player';
  
  // Check for draw condition: 30 turns without winner
  // 판정승 시스템: 30턴 시 킹 전진도와 기물 점수로 승패 결정
  if (turnCount !== undefined && turnCount >= 30) {
    // 킹이 존재하는지 확인 (이미 위에서 확인했지만 안전을 위해)
    if (!whiteKingPos || !blackKingPos) {
      return 'draw'; // 킹 위치를 찾을 수 없으면 무승부
    }
    
    // 기물 점수 계산 (King 제외)
    const material = calculateMaterialBalance(board);
    const playerMaterial = material.playerMaterial - 1000; // King 값 제외
    const aiMaterial = material.aiMaterial - 1000; // King 값 제외
    
    // 킹의 전진 거리 계산 (목표 지점까지의 근접도)
    // 플레이어 킹은 0행이 목표, AI 킹은 4행이 목표
    const playerAdvancement = whiteKingPos.r; // 0에 가까울수록 좋음 (최대 4)
    const aiAdvancement = 4 - blackKingPos.r; // 4에 가까울수록 좋음 (최대 4)
    
    // 종합 점수 계산 (전진 거리에 더 높은 가중치 부여)
    // 전진도는 승리 조건이므로 기물보다 훨씬 중요
    const playerScore = (playerAdvancement * 3) + playerMaterial;
    const aiScore = (aiAdvancement * 3) + aiMaterial;
    
    // 점수 비교로 승패 결정
    if (playerScore > aiScore) return 'player';
    if (aiScore > playerScore) return 'ai';
    
    // 점수가 완전히 같을 때만 무승부 (거의 발생하지 않음)
    return 'draw';
  }
  
  // Check for stalemate (no valid moves available for current player)
  // Check if player has any valid moves
  let playerHasMoves = false;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (piece && piece === piece.toLowerCase()) { // Player piece
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
      if (piece && piece === piece.toUpperCase()) { // AI piece
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
 * Enhanced AI with sacrifice tactics and positional awareness
 * Implements "Move 37" philosophy: sometimes losing a piece is necessary
 */
export function getAIMove(board: Board): { from: { r: number, c: number }, to: { r: number, c: number } } | null {
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

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      if (piece && piece === piece.toUpperCase()) { // AI piece
        // Try all moves
        for (let tr = 0; tr < 5; tr++) {
          for (let tc = 0; tc < 5; tc++) {
            if (isValidMove(board, { r, c }, { r: tr, c: tc }, false)) {
              let score = 0;
              const target = board[tr][tc];
              const isAdvance = tr > r; // Moving forward
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
              if (isCheck) score += 10; // Threatening king
              
              // Center control (middle squares are more valuable)
              const centerDistance = Math.abs(tr - 2) + Math.abs(tc - 2);
              score += (5 - centerDistance) * 0.5;
              
              // King advancement (AI king moving toward player side)
              if (piece === 'K') {
                score += (4 - tr) * 3; // Closer to row 4 = better
              }
              
              // Check if this move threatens multiple pieces
              const testBoard = makeMove(board, { r, c }, { r: tr, c: tc });
              let threatCount = 0;
              for (let tr2 = 0; tr2 < 5; tr2++) {
                for (let tc2 = 0; tc2 < 5; tc2++) {
                  if (isValidMove(testBoard, { r: tr, c: tc }, { r: tr2, c: tc2 }, false)) {
                    const threatTarget = testBoard[tr2][tc2];
                    if (threatTarget && threatTarget === threatTarget.toLowerCase()) {
                      threatCount++;
                    }
                  }
                }
              }
              score += threatCount * 2;
              
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

  if (moves.length === 0) return null;

  // Sort by score desc
  moves.sort((a, b) => b.score - a.score);
  
  // Pick from top 3 moves with some randomness for unpredictability
  // But heavily favor the best move (70% chance)
  const topMoves = moves.slice(0, Math.min(3, moves.length));
  const random = Math.random();
  
  if (random < 0.7 || topMoves.length === 1) {
    return { from: topMoves[0].from, to: topMoves[0].to };
  } else {
    // Pick randomly from top 3
    const randomIndex = Math.floor(Math.random() * topMoves.length);
    return { from: topMoves[randomIndex].from, to: topMoves[randomIndex].to };
  }
}
