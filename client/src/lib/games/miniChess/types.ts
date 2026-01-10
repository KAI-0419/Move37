/**
 * Mini Chess Game Types
 * 
 * Type definitions specific to the Mini Chess game variant.
 * This keeps game-specific types isolated from the general game engine interface.
 */

// 5x5 Chess Variant Logic
// Board is 5x5.
// Pieces: K (King), N (Knight), P (Pawn).
// Case sensitive: Upper = AI (Black, Top), Lower = Player (White, Bottom).

export type Piece = 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | null;
export type Board = Piece[][];

export const INITIAL_BOARD_FEN = "NPKPN/5/5/5/npkpn";
