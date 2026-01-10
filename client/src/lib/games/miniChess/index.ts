/**
 * Mini Chess Game Module
 * 
 * Central export point for all Mini Chess game logic and UI.
 * This module encapsulates all chess-specific functionality.
 */

export * from "./types";
export * from "./boardUtils";
export * from "./moveValidation";
export * from "./winnerCheck";
export * from "./repetition";
export * from "./evaluation";
export { MiniChessEngine } from "./MiniChessEngine";
export { MiniChessBoard } from "./MiniChessBoard";