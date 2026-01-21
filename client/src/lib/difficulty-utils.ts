/**
 * Difficulty Utility Functions
 * 
 * Common utility functions for difficulty level management
 */

export type Difficulty = "NEXUS-3" | "NEXUS-5" | "NEXUS-7";

/**
 * Get the next difficulty level
 * @param difficulty - Current difficulty level
 * @returns Next difficulty level or null if already at max
 */
export function getNextDifficulty(difficulty: Difficulty): Difficulty | null {
  switch (difficulty) {
    case "NEXUS-3":
      return "NEXUS-5";
    case "NEXUS-5":
      return "NEXUS-7";
    case "NEXUS-7":
      return null;
  }
}

/**
 * Get the previous difficulty level
 * @param difficulty - Current difficulty level
 * @returns Previous difficulty level or null if already at min
 */
export function getPreviousDifficulty(difficulty: Difficulty): Difficulty | null {
  switch (difficulty) {
    case "NEXUS-3":
      return null;
    case "NEXUS-5":
      return "NEXUS-3";
    case "NEXUS-7":
      return "NEXUS-5";
  }
}

/**
 * Get difficulty level number (3, 5, or 7)
 * @param difficulty - Difficulty level
 * @returns Level number
 */
export function getDifficultyLevel(difficulty: Difficulty): number {
  return parseInt(difficulty.split('-')[1], 10);
}
