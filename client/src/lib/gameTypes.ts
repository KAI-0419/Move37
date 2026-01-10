// Game type definitions for multi-game support
// Note: GameType is defined in @shared/schema.ts to ensure consistency across client and server
import type { GameType } from "@shared/schema";
import { DEFAULT_GAME_TYPE } from "@shared/gameConfig";

// Re-export for convenience
export type { GameType };

export interface GameInfo {
  id: GameType;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  available: boolean;
  comingSoon?: boolean;
}

// Available games configuration
export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: "MINI_CHESS",
    nameKey: "games.miniChess.name",
    descriptionKey: "games.miniChess.description",
    icon: "♟️",
    available: true,
  },
  {
    id: "GAME_2",
    nameKey: "games.game2.name",
    descriptionKey: "games.game2.description",
    icon: "🔒",
    available: false,
    comingSoon: true,
  },
  {
    id: "GAME_3",
    nameKey: "games.game3.name",
    descriptionKey: "games.game3.description",
    icon: "🔒",
    available: false,
    comingSoon: true,
  },
  {
    id: "GAME_4",
    nameKey: "games.game4.name",
    descriptionKey: "games.game4.description",
    icon: "🔒",
    available: false,
    comingSoon: true,
  },
  {
    id: "GAME_5",
    nameKey: "games.game5.name",
    descriptionKey: "games.game5.description",
    icon: "🔒",
    available: false,
    comingSoon: true,
  },
];

// LocalStorage key for selected game type
export const GAME_TYPE_STORAGE_KEY = "move37_selected_game_type";

// Load game type from localStorage
export function loadGameType(): GameType {
  try {
    const saved = localStorage.getItem(GAME_TYPE_STORAGE_KEY);
    if (saved && AVAILABLE_GAMES.some(g => g.id === saved && g.available)) {
      return saved as GameType;
    }
  } catch (error) {
    console.error("Failed to load game type from localStorage:", error);
  }
  return DEFAULT_GAME_TYPE; // Default
}

// Save game type to localStorage
export function saveGameType(gameType: GameType): void {
  try {
    localStorage.setItem(GAME_TYPE_STORAGE_KEY, gameType);
  } catch (error) {
    console.error("Failed to save game type to localStorage:", error);
  }
}

// Get game info by type
export function getGameInfo(gameType: GameType): GameInfo | undefined {
  return AVAILABLE_GAMES.find(g => g.id === gameType);
}
