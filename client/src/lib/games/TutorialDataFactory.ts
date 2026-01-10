/**
 * Tutorial Data Factory
 * 
 * Provides game-specific tutorial data based on game type.
 * Each game can have its own tutorial steps and content.
 */

import type { GameType } from "@shared/schema";
import { miniChessTutorialSteps, miniChessTutorialStepKeys } from "./miniChess/tutorialData";
import { GameEngineFactory } from "./GameEngineFactory";
export type { TutorialStep } from "./TutorialTypes";

/**
 * Get tutorial steps for a specific game type
 * 
 * @param gameType - Type of game
 * @returns Array of tutorial steps
 */
export function getTutorialSteps(gameType: GameType): TutorialStep[] {
  switch (gameType) {
    case "MINI_CHESS":
      return miniChessTutorialSteps;
    
    case "GAME_2":
    case "GAME_3":
    case "GAME_4":
    case "GAME_5":
      // Future games will return their own tutorial steps
      // For now, return empty array or fallback to MINI_CHESS
      return [];
    
    default:
      return miniChessTutorialSteps; // Fallback to MINI_CHESS
  }
}

/**
 * Get tutorial step keys for a specific game type
 * Used for step indicators and navigation
 * 
 * @param gameType - Type of game
 * @returns Array of tutorial step keys
 */
export function getTutorialStepKeys(gameType: GameType): Array<{ titleKey: string; descriptionKey: string }> {
  switch (gameType) {
    case "MINI_CHESS":
      return miniChessTutorialStepKeys;
    
    case "GAME_2":
    case "GAME_3":
    case "GAME_4":
    case "GAME_5":
      return [];
    
    default:
      return miniChessTutorialStepKeys; // Fallback to MINI_CHESS
  }
}

/**
 * Get initial board state for tutorial
 * 
 * @param gameType - Type of game
 * @returns Initial board state string
 */
export function getTutorialInitialBoard(gameType: GameType): string {
  try {
    const engine = GameEngineFactory.getEngine(gameType);
    return engine.getInitialBoard();
  } catch (error) {
    console.error(`Failed to get initial board for ${gameType}:`, error);
    return "5/5/5/5/5"; // Generic fallback
  }
}
