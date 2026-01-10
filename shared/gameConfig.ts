/**
 * Game Configuration Types
 * 
 * Defines configuration interfaces for game-specific settings.
 * Each game can have its own configuration while maintaining a common structure.
 * 
 * Note: UI-specific configurations are defined in client/src/lib/games/GameUIConfig.ts
 * This file focuses on game logic and backend configurations.
 */

import type { GameType } from "./schema";

/**
 * Default game type used throughout the application
 * This should be the first available game type
 */
export const DEFAULT_GAME_TYPE: GameType = "MINI_CHESS";

/**
 * Default difficulty level used as fallback throughout the application
 * All games use the unified NEXUS-3/5/7 difficulty system
 */
export const DEFAULT_DIFFICULTY: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7";

/**
 * Base game configuration that all games share
 */
export interface BaseGameConfig {
  gameType: GameType;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  initialTime: number; // Initial time in seconds
  timePerMove: number; // Time added per move in seconds
  maxTurns?: number; // Maximum turns before draw (optional, game-specific)
}

/**
 * Game-specific configuration
 * Each game type can extend this with its own settings
 */
export interface MiniChessConfig extends BaseGameConfig {
  gameType: "MINI_CHESS";
  boardSize: { rows: number; cols: number }; // 5x5 for mini chess
  pieces: {
    king: { count: number };
    knight: { count: number };
    pawn: { count: number };
  };
}

// Future game configs will be added here
// export interface Game2Config extends BaseGameConfig { ... }
// export interface Game3Config extends BaseGameConfig { ... }

/**
 * Union type of all game configurations
 */
export type GameConfig = MiniChessConfig; // | Game2Config | Game3Config | ...

/**
 * Default configurations for each game type
 */
export const DEFAULT_GAME_CONFIGS: Record<GameType, BaseGameConfig> = {
  MINI_CHESS: {
    gameType: "MINI_CHESS",
    difficulty: "NEXUS-7",
    initialTime: 180,
    timePerMove: 5,
    maxTurns: 30,
  },
  GAME_2: {
    gameType: "GAME_2",
    difficulty: "NEXUS-7",
    initialTime: 180,
    timePerMove: 5,
  },
  GAME_3: {
    gameType: "GAME_3",
    difficulty: "NEXUS-7",
    initialTime: 180,
    timePerMove: 5,
  },
  GAME_4: {
    gameType: "GAME_4",
    difficulty: "NEXUS-7",
    initialTime: 180,
    timePerMove: 5,
  },
  GAME_5: {
    gameType: "GAME_5",
    difficulty: "NEXUS-7",
    initialTime: 180,
    timePerMove: 5,
  },
};

/**
 * Get default configuration for a game type
 */
export function getDefaultConfig(gameType: GameType): BaseGameConfig {
  return DEFAULT_GAME_CONFIGS[gameType];
}
