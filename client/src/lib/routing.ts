/**
 * Routing Utilities
 * 
 * Centralized routing helper functions for game type-aware navigation.
 * Ensures consistent URL structure and game type handling across the application.
 */

import type { GameType } from "@shared/schema";
import { AVAILABLE_GAMES } from "./gameTypes";

/**
 * Build game room URL with game type parameter
 * 
 * @param gameType - The game type to include in the URL
 * @returns URL string with game type parameter
 */
export function buildGameRoomUrl(gameType: GameType): string {
  return `/game?type=${gameType}`;
}

/**
 * Parse game type from URL search parameters
 * 
 * @param searchParams - URL search parameters string (e.g., "?type=MINI_CHESS")
 * @returns GameType or null if invalid/not found
 */
export function parseGameTypeFromUrl(searchParams: string): GameType | null {
  try {
    const params = new URLSearchParams(searchParams);
    const gameType = params.get("type");
    
    if (!gameType) {
      return null;
    }
    
    // Validate game type
    const isValidGameType = AVAILABLE_GAMES.some(
      g => g.id === gameType && g.available
    );
    
    if (isValidGameType) {
      return gameType as GameType;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to parse game type from URL:", error);
    return null;
  }
}

/**
 * Validate game type and return default if invalid
 * 
 * @param gameType - Game type to validate
 * @param defaultGameType - Default game type if validation fails
 * @returns Valid game type
 */
export function validateGameType(
  gameType: GameType | null | undefined,
  defaultGameType: GameType = "MINI_CHESS"
): GameType {
  if (!gameType) {
    return defaultGameType;
  }
  
  const isValid = AVAILABLE_GAMES.some(
    g => g.id === gameType && g.available
  );
  
  return isValid ? gameType : defaultGameType;
}

/**
 * Get current URL search parameters as string
 * 
 * @returns URL search parameters string (e.g., "?type=MINI_CHESS")
 */
export function getCurrentSearchParams(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
}
