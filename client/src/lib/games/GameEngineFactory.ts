/**
 * Game Engine Factory
 * 
 * Creates and manages game engine instances based on game type.
 * This factory pattern allows for easy addition of new game types
 * without modifying existing code.
 */

import type { GameType } from "@shared/schema";
import type { IGameEngine } from "@shared/gameEngineInterface";
import { MiniChessEngine } from "./miniChess/MiniChessEngine";
import { IsolationEngine } from "./isolation/IsolationEngine";
import { EntropyEngine } from "./entropy/EntropyEngine";

/**
 * Game Engine Factory
 * 
 * Centralized factory for creating game engine instances.
 * Each game type has its own engine implementation.
 */
export class GameEngineFactory {
  private static engines: Map<GameType, IGameEngine> = new Map();

  /**
   * Get or create a game engine for the specified game type
   * Engines are cached for performance
   * 
   * @param gameType - Type of game
   * @returns Game engine instance
   * @throws Error if game type is not supported
   */
  static getEngine(gameType: GameType): IGameEngine {
    // Check cache first
    if (this.engines.has(gameType)) {
      return this.engines.get(gameType)!;
    }

    // Create new engine based on game type
    let engine: IGameEngine;
    
    switch (gameType) {
      case "MINI_CHESS":
        engine = new MiniChessEngine();
        break;
      
      case "GAME_2":
        engine = new IsolationEngine();
        break;
      
      case "GAME_3":
        engine = new EntropyEngine();
        break;
      
      case "GAME_4":
      case "GAME_5":
        // Future games will be implemented here
        throw new Error(`Game type ${gameType} is not yet implemented`);
      
      default:
        throw new Error(`Unknown game type: ${gameType}`);
    }

    // Cache the engine
    this.engines.set(gameType, engine);
    return engine;
  }

  /**
   * Check if a game type is supported
   * 
   * @param gameType - Type of game to check
   * @returns True if game type is supported
   */
  static isSupported(gameType: GameType): boolean {
    try {
      this.getEngine(gameType);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear engine cache (useful for testing or hot-reloading)
   */
  static clearCache(): void {
    this.engines.clear();
  }
}
