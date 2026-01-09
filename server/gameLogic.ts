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

export function checkWinner(board: Board): 'player' | 'ai' | null {
  // Check if kings exist
  let whiteKing = false;
  let blackKing = false;
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'k') {
        whiteKing = true;
        if (r === 0) return 'player'; // Reached end
      }
      if (board[r][c] === 'K') {
        blackKing = true;
        if (r === 4) return 'ai'; // Reached end
      }
    }
  }

  if (!whiteKing) return 'ai';
  if (!blackKing) return 'player';
  
  return null;
}

// Simple AI (Minimax or Random for MVP, let's do Random + Capture bias)
export function getAIMove(board: Board): { from: { r: number, c: number }, to: { r: number, c: number } } | null {
  const moves: { from: { r: number, c: number }, to: { r: number, c: number }, score: number }[] = [];

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
              if (target) {
                // Capture value
                if (target === 'k') score += 100;
                else if (target === 'n') score += 5;
                else if (target === 'p') score += 1;
              }
              // Advance bonus
              score += tr; 
              
              moves.push({ from: { r, c }, to: { r: tr, c: tc }, score });
            }
          }
        }
      }
    }
  }

  if (moves.length === 0) return null;

  // Sort by score desc, pick top or random from top
  moves.sort((a, b) => b.score - a.score);
  
  // Pick one of the best moves (add some randomness to be less predictable?) 
  // For "Sacrifice Tactics", maybe we prefer attacks.
  return moves[0];
}
