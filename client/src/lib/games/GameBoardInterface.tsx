/**
 * Game Board Component Interface
 * 
 * This interface defines the contract that all game board components must implement.
 * Each game type will have its own board component implementation.
 * 
 * This design allows for:
 * - Game-specific board rendering
 * - Different board layouts and sizes
 * - Game-specific piece rendering
 * - Consistent API across all games
 */

import type { ReactNode } from "react";

/**
 * Common props that all game board components share
 */
export interface BaseGameBoardProps {
  boardString: string; // Game state representation (format depends on gameType)
  turn?: "player" | "ai"; // Optional for games without turn system
  selectedSquare: { r: number; c: number } | null;
  lastMove: { from: { r: number; c: number }, to: { r: number; c: number } } | null;
  validMoves?: { r: number; c: number }[];
  destroyCandidates?: { r: number; c: number }[]; // For games that require destroy selection
  onSquareClick: (r: number, c: number) => void;
  onSquareHover?: (r: number, c: number) => void; // Optional hover handler for tracking hesitation
  isProcessing?: boolean;
  size?: "small" | "medium" | "large";
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  hasError?: boolean;
  isTutorialMode?: boolean; // Whether the board is being used in tutorial mode
  highlightSquares?: { r: number; c: number }[]; // Squares to highlight (e.g. for tutorial)
}

/**
 * Game Board Component Type
 * 
 * All game board components must be React components that accept BaseGameBoardProps
 */
export type GameBoardComponent = React.ComponentType<BaseGameBoardProps>;

/**
 * Game-specific board props (can be extended by each game)
 * 
 * Example:
 * ```typescript
 * interface MiniChessBoardProps extends BaseGameBoardProps {
 *   // Mini Chess specific props if needed
 * }
 * ```
 */
export type GameBoardProps = BaseGameBoardProps;
