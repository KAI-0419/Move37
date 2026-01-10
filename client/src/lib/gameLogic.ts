// Client-side game logic helpers
// Uses game engine factory pattern for multi-game support
import type { GameType } from "@shared/schema";
import { GameEngineFactory } from "./games/GameEngineFactory";

export type Piece = 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | '.';

/**
 * Convert board string (game-specific format) to 2D array for UI
 * Uses game engine to parse board based on game type
 */
export function parseBoardString(boardString: string, gameType: GameType = "MINI_CHESS"): Piece[][] {
  const engine = GameEngineFactory.getEngine(gameType);
  const board = engine.parseBoard(boardString);
  // Convert null to '.' for UI display
  // Board is already a 2D array from parseBoard
  return board.map(row => row.map(cell => (cell === null ? '.' : cell) as Piece));
}

/**
 * Check if move is valid using game engine
 * Note: This function requires the original board string, not the parsed UI format
 */
export function isValidMoveClient(
  boardString: string,
  from: { r: number; c: number },
  to: { r: number; c: number },
  isPlayer: boolean,
  gameType: GameType = "MINI_CHESS"
): boolean {
  const engine = GameEngineFactory.getEngine(gameType);
  const validation = engine.isValidMove(boardString, { from, to }, isPlayer);
  return validation.valid;
}

/**
 * Get valid moves using game engine
 * Note: This function requires the original board string, not the parsed UI format
 */
export function getValidMovesClient(
  boardString: string,
  from: { r: number; c: number },
  isPlayer: boolean,
  gameType: GameType = "MINI_CHESS"
): { r: number; c: number }[] {
  const engine = GameEngineFactory.getEngine(gameType);
  return engine.getValidMoves(boardString, from, isPlayer);
}
