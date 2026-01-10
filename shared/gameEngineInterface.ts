/**
 * Game Engine Interface
 * 
 * This interface defines the contract that all game engines must implement.
 * Each game type (MINI_CHESS, GAME_2, etc.) will have its own engine implementation.
 * 
 * This design allows for:
 * - Easy addition of new game types
 * - Game-specific logic isolation
 * - Consistent API across all games
 * - Type-safe game operations
 */

import type { GameType } from "./schema";

/**
 * Move representation - generic format that works for all games
 * Games can extend this with game-specific move data if needed
 */
export interface GameMove {
  from: { r: number; c: number };
  to: { r: number; c: number };
  // Games can add additional fields here (e.g., promotion, special actions)
  [key: string]: any;
}

/**
 * Player move with additional context (captured piece, etc.)
 */
export interface PlayerMove extends GameMove {
  piece: any; // Game-specific piece type
  captured?: any; // Game-specific piece type (if capture occurred)
}

/**
 * AI move result with reasoning
 */
export interface AIMoveResult {
  move: GameMove | null;
  logs: string[]; // AI reasoning/psychological insights
}

/**
 * Game state validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Winner check result
 */
export type WinnerResult = "player" | "ai" | "draw" | null;

/**
 * Game configuration for initialization
 */
export interface GameConfig {
  gameType: GameType;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  initialTime?: number; // Initial time in seconds (default: 180)
  timePerMove?: number; // Time added per move in seconds (default: 5)
}

/**
 * Core Game Engine Interface
 * 
 * All game engines must implement this interface to ensure consistency
 * and enable the factory pattern to work correctly.
 */
export interface IGameEngine {
  /**
   * Get the game type this engine handles
   */
  getGameType(): GameType;

  /**
   * Get the initial board state for a new game
   * @returns Board state as a string (format is game-specific)
   */
  getInitialBoard(): string;

  /**
   * Validate if a move is legal
   * @param boardState - Current board state (game-specific format)
   * @param move - Move to validate
   * @param isPlayer - Whether this is a player move (true) or AI move (false)
   * @returns Validation result
   */
  isValidMove(
    boardState: string,
    move: GameMove,
    isPlayer: boolean
  ): ValidationResult;

  /**
   * Apply a move to the board
   * @param boardState - Current board state
   * @param move - Move to apply
   * @returns New board state after the move
   */
  makeMove(boardState: string, move: GameMove): string;

  /**
   * Check if the game has a winner
   * @param boardState - Current board state
   * @param turnCount - Number of turns played
   * @param playerTimeRemaining - Player's remaining time
   * @param aiTimeRemaining - AI's remaining time
   * @returns Winner result
   */
  checkWinner(
    boardState: string,
    turnCount: number,
    playerTimeRemaining: number,
    aiTimeRemaining: number
  ): WinnerResult;

  /**
   * Calculate AI's next move
   * @param boardState - Current board state
   * @param playerLastMove - Player's last move (for psychological analysis)
   * @param difficulty - AI difficulty level
   * @param turnCount - Current turn count
   * @param boardHistory - History of board states (for repetition detection)
   * @returns AI move result with reasoning
   */
  calculateAIMove(
    boardState: string,
    playerLastMove: PlayerMove | null,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    turnCount?: number,
    boardHistory?: string[]
  ): AIMoveResult;

  /**
   * Check if a move would cause threefold repetition
   * @param boardState - Current board state
   * @param move - Move to check
   * @param boardHistory - History of board states
   * @returns True if move would cause repetition
   */
  wouldCauseRepetition(
    boardState: string,
    move: GameMove,
    boardHistory: string[]
  ): boolean;

  /**
   * Get all valid moves for a piece at a given position
   * @param boardState - Current board state
   * @param position - Position to get moves for
   * @param isPlayer - Whether this is for player (true) or AI (false)
   * @returns Array of valid move positions
   */
  getValidMoves(
    boardState: string,
    position: { r: number; c: number },
    isPlayer: boolean
  ): { r: number; c: number }[];

  /**
   * Parse board state from string format
   * This is game-specific and may return different types
   * @param boardState - Board state string
   * @returns Parsed board representation (game-specific)
   */
  parseBoard(boardState: string): any;

  /**
   * Generate board state string from internal representation
   * @param board - Internal board representation
   * @returns Board state string
   */
  generateBoardString(board: any): string;
}
