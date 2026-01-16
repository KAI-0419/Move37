/**
 * Game Engine Factory
 *
 * Creates and manages game engine instances based on game type.
 * This factory pattern allows for easy addition of new game types
 * without modifying existing code.
 *
 * Uses dynamic imports for code-splitting - each game engine is loaded
 * only when needed, reducing initial bundle size.
 */

import type { GameType } from "@shared/schema";
import type { IGameEngine } from "@shared/gameEngineInterface";

/**
 * Game Engine Factory
 *
 * Centralized factory for creating game engine instances.
 * Each game type has its own engine implementation that is
 * dynamically imported for optimal code-splitting.
 */
export class GameEngineFactory {
  private static engines: Map<GameType, IGameEngine> = new Map();
  private static loadingPromises: Map<GameType, Promise<IGameEngine>> = new Map();

  /**
   * Get or create a game engine for the specified game type
   * Engines are cached for performance and loaded asynchronously
   *
   * @param gameType - Type of game
   * @returns Promise resolving to game engine instance
   * @throws Error if game type is not supported
   */
  static async getEngine(gameType: GameType): Promise<IGameEngine> {
    // Check cache first
    if (this.engines.has(gameType)) {
      return this.engines.get(gameType)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(gameType)) {
      return this.loadingPromises.get(gameType)!;
    }

    // Create loading promise
    const loadingPromise = this.loadEngine(gameType);
    this.loadingPromises.set(gameType, loadingPromise);

    try {
      const engine = await loadingPromise;
      // Cache the engine
      this.engines.set(gameType, engine);
      return engine;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(gameType);
    }
  }

  /**
   * Internal method to dynamically import and instantiate game engine
   *
   * @param gameType - Type of game
   * @returns Promise resolving to game engine instance
   */
  private static async loadEngine(gameType: GameType): Promise<IGameEngine> {
    switch (gameType) {
      case "MINI_CHESS": {
        const { MiniChessEngine } = await import("./miniChess/MiniChessEngine");
        return new MiniChessEngine();
      }

      case "GAME_2": {
        const { IsolationEngine } = await import("./isolation/IsolationEngine");
        return new IsolationEngine();
      }

      case "GAME_3": {
        const { EntropyEngine } = await import("./entropy/EntropyEngine");
        return new EntropyEngine();
      }

      case "GAME_4":
      case "GAME_5":
        // Future games will be implemented here
        throw new Error(`Game type ${gameType} is not yet implemented`);

      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  /**
   * Check if a game type is supported
   *
   * @param gameType - Type of game to check
   * @returns True if game type is supported
   */
  static isSupported(gameType: GameType): boolean {
    return gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3";
  }

  /**
   * Clear engine cache (useful for testing or hot-reloading)
   */
  static clearCache(): void {
    this.engines.clear();
    this.loadingPromises.clear();
  }

  /**
   * Preload a game engine without blocking
   * Useful for preloading during idle time
   *
   * @param gameType - Type of game to preload
   */
  static preload(gameType: GameType): void {
    // Fire and forget - don't await
    this.getEngine(gameType).catch(() => {
      // Silently ignore preload errors
    });
  }

  /**
   * Get cached engine synchronously (for React hooks like useMemo)
   * Returns null if engine is not yet loaded
   *
   * @param gameType - Type of game
   * @returns Cached engine or null
   */
  static getCachedEngine(gameType: GameType): IGameEngine | null {
    return this.engines.get(gameType) || null;
  }

  /**
   * Wait for engine to be loaded (blocks until ready)
   * Useful for ensuring engine is available before rendering
   *
   * @param gameType - Type of game
   * @returns Promise resolving to game engine instance
   */
  static async waitForEngine(gameType: GameType): Promise<IGameEngine> {
    return this.getEngine(gameType);
  }
}
