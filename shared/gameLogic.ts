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
                    // Player pieces are lowercase
                    if (threatTarget && threatTarget === threatTarget.toLowerCase() && threatTarget !== threatTarget.toUpperCase()) {
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
