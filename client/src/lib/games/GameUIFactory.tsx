/**
 * Game UI Factory
 * 
 * Creates and manages game UI component instances based on game type.
 * This factory pattern allows for easy addition of new game types
 * without modifying existing UI code.
 */

import type { GameType } from "@shared/schema";
import type { GameBoardComponent } from "./GameBoardInterface";
import { MiniChessBoard } from "./miniChess/MiniChessBoard";
import { IsolationBoard } from "./isolation/IsolationBoard";

/**
 * Game UI Factory
 * 
 * Centralized factory for creating game UI component instances.
 * Each game type has its own UI component implementation.
 */
export class GameUIFactory {
  private static boardComponents: Map<GameType, GameBoardComponent> = new Map();

  /**
   * Get or create a board component for the specified game type
   * Components are cached for performance
   * 
   * @param gameType - Type of game
   * @returns Board component
   * @throws Error if game type is not supported
   */
  static getBoardComponent(gameType: GameType): GameBoardComponent {
    // Check cache first
    if (this.boardComponents.has(gameType)) {
      return this.boardComponents.get(gameType)!;
    }

    // Create new component based on game type
    let BoardComponent: GameBoardComponent;
    
    switch (gameType) {
      case "MINI_CHESS":
        BoardComponent = MiniChessBoard;
        break;
      
      case "GAME_2":
        BoardComponent = IsolationBoard;
        break;
      
      case "GAME_3":
      case "GAME_4":
      case "GAME_5":
        // Future games will be implemented here
        throw new Error(`Game type ${gameType} UI is not yet implemented`);
      
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }

    // Cache the component
    this.boardComponents.set(gameType, BoardComponent);
    return BoardComponent;
  }

  /**
   * Check if a game type has UI support
   * 
   * @param gameType - Type of game to check
   * @returns True if game type has UI support
   */
  static hasUISupport(gameType: GameType): boolean {
    try {
      this.getBoardComponent(gameType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear component cache (useful for testing or hot-reloading)
   */
  static clearCache(): void {
    this.boardComponents.clear();
  }
}
