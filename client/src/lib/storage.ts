// LocalStorage-based game storage (100% client-side)
import type { Game } from "@shared/schema";

const STORAGE_KEY = "move37_games";
const CURRENT_GAME_KEY = "move37_current_game";
const UNLOCK_STORAGE_KEY = "move37_unlocked_difficulties";

export interface LocalGame {
  id: number;
  board: string;
  turn: "player" | "ai";
  history: string[];
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
    board: localGame.board,
    turn: localGame.turn,
    history: localGame.history,
    winner: localGame.winner,
    aiLog: localGame.aiLog,
    turnCount: localGame.turnCount,
    difficulty: localGame.difficulty || "NEXUS-7", // Default to NEXUS-7 for backward compatibility
    playerTimeRemaining: localGame.playerTimeRemaining ?? 180,
    aiTimeRemaining: localGame.aiTimeRemaining ?? 180,
    timePerMove: localGame.timePerMove ?? 5,
    lastMoveTimestamp: localGame.lastMoveTimestamp ? new Date(localGame.lastMoveTimestamp) : null,
    createdAt: new Date(localGame.createdAt),
  };
}

// Use window.localStorage to avoid naming conflict
const storage = window.localStorage;

// Get all games from localStorage
function getAllGames(): LocalGame[] {
  try {
    const data = storage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save all games to localStorage
function saveAllGames(games: LocalGame[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch (error) {
    console.error("Failed to save games to localStorage:", error);
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
 * Get unlocked difficulties
 * Initially, only NEXUS-3 is unlocked
 */
export function getUnlockedDifficulties(): Set<Difficulty> {
  try {
    const data = storage.getItem(UNLOCK_STORAGE_KEY);
    if (data) {
      const unlocked = JSON.parse(data) as Difficulty[];
      return new Set(unlocked);
    }
  } catch (error) {
    console.error("Failed to load unlocked difficulties:", error);
  }
  // Default: only NEXUS-3 is unlocked
  return new Set<Difficulty>(["NEXUS-3"]);
}

/**
 * Check if a difficulty is unlocked
 */
export function isDifficultyUnlocked(difficulty: Difficulty): boolean {
  const unlocked = getUnlockedDifficulties();
  return unlocked.has(difficulty);
}

/**
 * Unlock a difficulty level
 */
export function unlockDifficulty(difficulty: Difficulty): void {
  try {
    const unlocked = getUnlockedDifficulties();
    unlocked.add(difficulty);
    const unlockedArray = Array.from(unlocked);
    storage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(unlockedArray));
  } catch (error) {
    console.error("Failed to unlock difficulty:", error);
  }
}

/**
 * Handle victory unlock logic
 * When player wins:
 * - NEXUS-3 victory -> unlock NEXUS-5
 * - NEXUS-5 victory -> unlock NEXUS-7
 */
export function handleVictoryUnlock(difficulty: Difficulty): void {
  if (difficulty === "NEXUS-3") {
    unlockDifficulty("NEXUS-5");
  } else if (difficulty === "NEXUS-5") {
    unlockDifficulty("NEXUS-7");
  }
  // NEXUS-7 has no next level
  
  // Dispatch custom event to notify other components
  window.dispatchEvent(new Event('unlock-updated'));
}
