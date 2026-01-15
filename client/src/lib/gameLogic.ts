// Client-side game logic helpers
// Uses game engine factory pattern for multi-game support
import type { GameType } from "@shared/schema";
import { GameEngineFactory } from "./games/GameEngineFactory";
import { DEFAULT_GAME_TYPE } from "@shared/gameConfig";

/**
 * Piece type for UI display
 * This is a general type that can represent any game piece
 * For Mini Chess: 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | '.'
 * For other games: game-specific piece representations
 */
export type Piece = string | null;

/**
 * Convert board string (game-specific format) to 2D array for UI
 * Uses game engine to parse board based on game type
 * Returns a 2D array where each cell is a piece representation (string) or null
 * Empty cells are represented as '.' for consistent UI display
 */
export function parseBoardString(boardString: string, gameType: GameType = DEFAULT_GAME_TYPE): (Piece | '.')[][] {
  const engine = GameEngineFactory.getCachedEngine(gameType);
  if (!engine) {
    console.error(`Engine not loaded for game type: ${gameType}`);
    return [];
  }
  const board = engine.parseBoard(boardString);
  // Convert null to '.' for UI display
  // Board is already a 2D array from parseBoard
  return board.map(row => row.map(cell => (cell === null ? '.' : cell)));
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
  gameType: GameType = DEFAULT_GAME_TYPE
): boolean {
  const engine = GameEngineFactory.getCachedEngine(gameType);
  if (!engine) {
    console.error(`Engine not loaded for game type: ${gameType}`);
    return false;
  }
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
  gameType: GameType = DEFAULT_GAME_TYPE
): { r: number; c: number }[] {
  const engine = GameEngineFactory.getCachedEngine(gameType);
  if (!engine) {
    console.error(`Engine not loaded for game type: ${gameType}`);
    return [];
  }
  return engine.getValidMoves(boardString, from, isPlayer);
}
