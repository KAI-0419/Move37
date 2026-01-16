/**
 * Game UI Factory
 *
 * Creates and manages game UI component instances based on game type.
 * This factory pattern allows for easy addition of new game types
 * without modifying existing UI code.
 *
 * Uses dynamic imports for code-splitting - each game UI component is loaded
 * only when needed, reducing initial bundle size.
 */

import type { GameType } from "@shared/schema";
import type { GameBoardComponent } from "./GameBoardInterface";

/**
 * Game UI Factory
 *
 * Centralized factory for creating game UI component instances.
 * Each game type has its own UI component implementation that is
 * dynamically imported for optimal code-splitting.
 */
export class GameUIFactory {
  private static boardComponents: Map<GameType, GameBoardComponent> = new Map();
  private static loadingPromises: Map<GameType, Promise<GameBoardComponent>> = new Map();

  /**
   * Get or create a board component for the specified game type
   * Components are cached for performance and loaded asynchronously
   *
   * @param gameType - Type of game
   * @returns Promise resolving to board component
   * @throws Error if game type is not supported
   */
  static async getBoardComponent(gameType: GameType): Promise<GameBoardComponent> {
    // Check cache first
    if (this.boardComponents.has(gameType)) {
      return this.boardComponents.get(gameType)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(gameType)) {
      return this.loadingPromises.get(gameType)!;
    }

    // Create loading promise
    const loadingPromise = this.loadBoardComponent(gameType);
    this.loadingPromises.set(gameType, loadingPromise);

    try {
      const component = await loadingPromise;
      // Cache the component
      this.boardComponents.set(gameType, component);
      return component;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(gameType);
    }
  }

  /**
   * Internal method to dynamically import board component
   *
   * @param gameType - Type of game
   * @returns Promise resolving to board component
   */
  private static async loadBoardComponent(gameType: GameType): Promise<GameBoardComponent> {
    switch (gameType) {
      case "MINI_CHESS": {
        const { MiniChessBoard } = await import("./miniChess/MiniChessBoard");
        return MiniChessBoard;
      }

      case "GAME_2": {
        const { IsolationBoard } = await import("./isolation/IsolationBoard");
        return IsolationBoard;
      }

      case "GAME_3": {
        const { EntropyBoard } = await import("./entropy/EntropyBoard");
        return EntropyBoard;
      }

      case "GAME_4":
      case "GAME_5":
        // Future games will be implemented here
        throw new Error(`Game type ${gameType} UI is not yet implemented`);

      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  /**
   * Check if a game type has UI support
   *
   * @param gameType - Type of game to check
   * @returns True if game type has UI support
   */
  static hasUISupport(gameType: GameType): boolean {
    return gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3";
  }

  /**
   * Clear component cache (useful for testing or hot-reloading)
   */
  static clearCache(): void {
    this.boardComponents.clear();
    this.loadingPromises.clear();
  }

  /**
   * Preload a game UI component without blocking
   * Useful for preloading during idle time
   *
   * @param gameType - Type of game to preload
   */
  static preload(gameType: GameType): void {
    // Fire and forget - don't await
    this.getBoardComponent(gameType).catch(() => {
      // Silently ignore preload errors
    });
  }

  /**
   * Get cached board component synchronously (for React render)
   * Returns null if component is not yet loaded
   *
   * @param gameType - Type of game
   * @returns Cached board component or null
   */
  static getCachedBoardComponent(gameType: GameType): GameBoardComponent | null {
    return this.boardComponents.get(gameType) || null;
  }

  /**
   * Wait for board component to be loaded (blocks until ready)
   * Useful for ensuring component is available before rendering
   *
   * @param gameType - Type of game
   * @returns Promise resolving to board component
   */
  static async waitForComponent(gameType: GameType): Promise<GameBoardComponent> {
    return this.getBoardComponent(gameType);
  }
}
