// LocalStorage-based game storage (100% client-side)
import type { Game, GameType } from "@shared/schema";
import { DEFAULT_GAME_TYPE, DEFAULT_DIFFICULTY } from "@shared/gameConfig";

const STORAGE_KEY = "move37_games";
const CURRENT_GAME_KEY = "move37_current_game";
const UNLOCK_STORAGE_KEY = "move37_unlocked_difficulties";
const UNLOCK_STORAGE_KEY_BY_GAME = "move37_unlocked_difficulties_by_game"; // Game-specific unlock storage
const MIGRATION_VERSION_KEY = "move37_storage_version";
const CURRENT_STORAGE_VERSION = 2; // Increment when schema changes

// Storage optimization constants
const MAX_BOARD_HISTORY_LENGTH = 20; // Only keep last 20 board states for repetition detection
const MAX_COMPLETED_GAMES = 10; // Keep at most 10 completed games per game type
const MAX_TOTAL_GAMES = 30; // Maximum total games in storage

export interface LocalGame {
  id: number;
  gameType: GameType; // Game type identifier for multi-game support
  board: any; // Game state representation (string or object)
  turn: "player" | "ai";
  history: string[];
  boardHistory?: string[]; // Board state history for repetition detection
  winner: "player" | "ai" | "draw" | null;
  aiLog: string | null;
  turnCount: number;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  playerTimeRemaining?: number | null;
  aiTimeRemaining?: number | null;
  timePerMove?: number | null;
  lastMoveTimestamp?: string | null;
  createdAt: string;
}

// Convert LocalGame to Game format
function toGame(localGame: LocalGame): Game {
  return {
    id: localGame.id,
    gameType: localGame.gameType || DEFAULT_GAME_TYPE, // Default to DEFAULT_GAME_TYPE for backward compatibility
    board: localGame.board,
    turn: localGame.turn,
    history: localGame.history,
    boardHistory: localGame.boardHistory || [],
    winner: localGame.winner,
    aiLog: localGame.aiLog,
    turnCount: localGame.turnCount,
    difficulty: localGame.difficulty || DEFAULT_DIFFICULTY, // Default to DEFAULT_DIFFICULTY for backward compatibility
    playerTimeRemaining: localGame.playerTimeRemaining ?? 180,
    aiTimeRemaining: localGame.aiTimeRemaining ?? 180,
    timePerMove: localGame.timePerMove ?? 5,
    lastMoveTimestamp: localGame.lastMoveTimestamp ? new Date(localGame.lastMoveTimestamp) : null,
    createdAt: new Date(localGame.createdAt),
  };
}

// Use window.localStorage to avoid naming conflict
const storage = window.localStorage;

/**
 * Migrate games from old schema to new schema
 * Handles backward compatibility by adding gameType field to existing games
 */
function migrateGames(games: any[]): LocalGame[] {
  return games.map((game) => {
    // If game doesn't have gameType, it's from an older version - default to DEFAULT_GAME_TYPE
    if (!game.gameType) {
      return {
        ...game,
        gameType: DEFAULT_GAME_TYPE as GameType,
      };
    }
    return game as LocalGame;
  });
}

/**
 * Get storage version
 */
function getStorageVersion(): number {
  try {
    const version = storage.getItem(MIGRATION_VERSION_KEY);
    return version ? parseInt(version, 10) : 1; // Default to 1 (old version)
  } catch {
    return 1;
  }
}

/**
 * Update storage version
 */
function setStorageVersion(version: number): void {
  try {
    storage.setItem(MIGRATION_VERSION_KEY, String(version));
  } catch (error) {
    console.error("Failed to update storage version:", error);
  }
}

/**
 * Perform data migration if needed
 * This ensures backward compatibility with existing game data
 */
function performMigrationIfNeeded(): void {
  const currentVersion = getStorageVersion();
  
  if (currentVersion < CURRENT_STORAGE_VERSION) {
    try {
      const data = storage.getItem(STORAGE_KEY);
      if (data) {
        const games = JSON.parse(data);
        const migratedGames = migrateGames(games);
        storage.setItem(STORAGE_KEY, JSON.stringify(migratedGames));
        setStorageVersion(CURRENT_STORAGE_VERSION);
        console.log(`Migrated ${games.length} games to storage version ${CURRENT_STORAGE_VERSION}`);
      }
    } catch (error) {
      console.error("Failed to migrate games:", error);
    }
  }
}

// Perform migration on module load
performMigrationIfNeeded();

// Get all games from localStorage
export function getAllGames(): LocalGame[] {
  try {
    const data = storage.getItem(STORAGE_KEY);
    if (!data) return [];

    const games = JSON.parse(data);
    // Always migrate on read to ensure consistency
    return migrateGames(games);
  } catch {
    return [];
  }
}

/**
 * Optimize a game for storage by trimming large data
 * - Limits boardHistory to last N entries
 */
function optimizeGameForStorage(game: LocalGame): LocalGame {
  const optimized = { ...game };

  // Trim boardHistory to prevent storage bloat
  if (optimized.boardHistory && optimized.boardHistory.length > MAX_BOARD_HISTORY_LENGTH) {
    optimized.boardHistory = optimized.boardHistory.slice(-MAX_BOARD_HISTORY_LENGTH);
  }

  return optimized;
}

/**
 * Clean up old completed games to free storage space
 * Keeps only the most recent completed games per game type
 */
function cleanupOldGames(games: LocalGame[], currentGameId: number | null): LocalGame[] {
  // Separate active and completed games
  const activeGames = games.filter(g => !g.winner || g.id === currentGameId);
  const completedGames = games.filter(g => g.winner && g.id !== currentGameId);

  // Group completed games by gameType
  const completedByType = new Map<string, LocalGame[]>();
  for (const game of completedGames) {
    const type = game.gameType || 'MINI_CHESS';
    if (!completedByType.has(type)) {
      completedByType.set(type, []);
    }
    completedByType.get(type)!.push(game);
  }

  // Keep only most recent completed games per type
  const keptCompleted: LocalGame[] = [];
  for (const [_, typeGames] of completedByType) {
    // Sort by creation date descending
    typeGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    // Keep only MAX_COMPLETED_GAMES
    keptCompleted.push(...typeGames.slice(0, MAX_COMPLETED_GAMES));
  }

  let result = [...activeGames, ...keptCompleted];

  // If still too many games, remove oldest completed games
  if (result.length > MAX_TOTAL_GAMES) {
    const active = result.filter(g => !g.winner || g.id === currentGameId);
    const completed = result.filter(g => g.winner && g.id !== currentGameId);
    completed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    result = [...active, ...completed.slice(0, MAX_TOTAL_GAMES - active.length)];
  }

  return result;
}

// Save all games to localStorage with automatic cleanup on quota exceeded
function saveAllGames(games: LocalGame[]): void {
  // Optimize all games before saving
  const optimizedGames = games.map(optimizeGameForStorage);

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(optimizedGames));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("Storage quota exceeded, cleaning up old games...");

      // Get current game ID to preserve it
      const currentGameId = gameStorage.getCurrentGameId();

      // Clean up old games
      const cleanedGames = cleanupOldGames(optimizedGames, currentGameId);

      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(cleanedGames));
        console.log(`Cleaned up storage: ${games.length} -> ${cleanedGames.length} games`);
      } catch (retryError) {
        // Last resort: keep only active games
        console.error("Still exceeded quota after cleanup, keeping only active games");
        const activeOnly = cleanedGames.filter(g => !g.winner || g.id === currentGameId);

        // Also clear boardHistory completely for active games
        const minimalGames = activeOnly.map(g => ({
          ...g,
          boardHistory: g.boardHistory?.slice(-5) || [], // Keep only last 5 for repetition
        }));

        try {
          storage.setItem(STORAGE_KEY, JSON.stringify(minimalGames));
        } catch (finalError) {
          console.error("Failed to save even minimal games:", finalError);
        }
      }
    } else {
      console.error("Failed to save games to localStorage:", error);
    }
  }
}

// Generate next game ID
function getNextId(): number {
  const games = getAllGames();
  if (games.length === 0) return 1;
  return Math.max(...games.map(g => g.id)) + 1;
}

export const gameStorage = {
  async createGame(game: Omit<LocalGame, "id" | "createdAt">): Promise<Game> {
    const games = getAllGames();
    const newGame: LocalGame = {
      ...game,
      id: getNextId(),
      createdAt: new Date().toISOString(),
    };
    games.push(newGame);
    saveAllGames(games);
    
    // Set as current game
    storage.setItem(CURRENT_GAME_KEY, String(newGame.id));
    
    return toGame(newGame);
  },

  async getGame(id: number): Promise<Game | undefined> {
    const games = getAllGames();
    const game = games.find(g => g.id === id);
    return game ? toGame(game) : undefined;
  },

  async updateGame(id: number, updates: Partial<Omit<LocalGame, "id" | "createdAt">>): Promise<Game> {
    const games = getAllGames();
    const index = games.findIndex(g => g.id === id);
    
    if (index === -1) {
      throw new Error("Game not found");
    }
    
    games[index] = {
      ...games[index],
      ...updates,
    };
    
    saveAllGames(games);
    return toGame(games[index]);
  },

  getCurrentGameId(): number | null {
    try {
      const id = storage.getItem(CURRENT_GAME_KEY);
      return id ? parseInt(id, 10) : null;
    } catch {
      return null;
    }
  },

  setCurrentGameId(id: number | null): void {
    if (id === null) {
      storage.removeItem(CURRENT_GAME_KEY);
    } else {
      storage.setItem(CURRENT_GAME_KEY, String(id));
    }
  },
};

// Unlock state management for difficulty levels
export type Difficulty = "NEXUS-3" | "NEXUS-5" | "NEXUS-7";

/**
 * Get unlocked difficulties for a specific game type
 * If gameType is provided, returns game-specific unlocks
 * Otherwise, returns global unlocks (for backward compatibility)
 * Initially, only NEXUS-3 is unlocked
 */
export function getUnlockedDifficulties(gameType?: GameType): Set<Difficulty> {
  try {
    if (gameType) {
      // Get game-specific unlocks
      const gameData = storage.getItem(`${UNLOCK_STORAGE_KEY_BY_GAME}_${gameType}`);
      if (gameData) {
        const unlocked = JSON.parse(gameData) as Difficulty[];
        return new Set(unlocked);
      }
    } else {
      // Get global unlocks (backward compatibility)
      const data = storage.getItem(UNLOCK_STORAGE_KEY);
      if (data) {
        const unlocked = JSON.parse(data) as Difficulty[];
        return new Set(unlocked);
      }
    }
  } catch (error) {
    console.error("Failed to load unlocked difficulties:", error);
  }
  // Default: only NEXUS-3 is unlocked
  return new Set<Difficulty>(["NEXUS-3"]);
}

/**
 * Check if a difficulty is unlocked for a specific game type
 * If gameType is provided, checks game-specific unlocks
 * Otherwise, checks global unlocks (for backward compatibility)
 */
export function isDifficultyUnlocked(difficulty: Difficulty, gameType?: GameType): boolean {
  const unlocked = getUnlockedDifficulties(gameType);
  return unlocked.has(difficulty);
}

/**
 * Unlock a difficulty level for a specific game type
 * If gameType is provided, unlocks game-specific difficulty
 * Otherwise, unlocks globally (for backward compatibility)
 */
export function unlockDifficulty(difficulty: Difficulty, gameType?: GameType): void {
  try {
    if (gameType) {
      // Unlock game-specific difficulty
      const unlocked = getUnlockedDifficulties(gameType);
      unlocked.add(difficulty);
      const unlockedArray = Array.from(unlocked);
      storage.setItem(`${UNLOCK_STORAGE_KEY_BY_GAME}_${gameType}`, JSON.stringify(unlockedArray));
    } else {
      // Unlock globally (backward compatibility)
      const unlocked = getUnlockedDifficulties();
      unlocked.add(difficulty);
      const unlockedArray = Array.from(unlocked);
      storage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(unlockedArray));
    }
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('unlock-updated'));
  } catch (error) {
    console.error("Failed to unlock difficulty:", error);
  }
}

/**
 * Handle victory unlock logic for a specific game type
 * When player wins:
 * - NEXUS-3 victory -> unlock NEXUS-5
 * - NEXUS-5 victory -> unlock NEXUS-7
 * 
 * @param difficulty - The difficulty level that was won
 * @param gameType - The game type for game-specific unlock tracking
 */
export function handleVictoryUnlock(difficulty: Difficulty, gameType?: GameType): void {
  if (difficulty === "NEXUS-3") {
    unlockDifficulty("NEXUS-5", gameType);
  } else if (difficulty === "NEXUS-5") {
    unlockDifficulty("NEXUS-7", gameType);
  }
  // NEXUS-7 has no next level
  
  // Note: unlockDifficulty already dispatches the 'unlock-updated' event
}
