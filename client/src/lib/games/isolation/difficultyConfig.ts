/**
 * Difficulty Configuration for ISOLATION AI
 *
 * Defines AI behavior parameters for each difficulty level:
 * - NEXUS-3: Average person level - beatable but not trivial
 * - NEXUS-5: Expert level - challenging for experienced players
 * - NEXUS-7: Near-unbeatable - only the best can win
 */

export type Difficulty = "NEXUS-3" | "NEXUS-5" | "NEXUS-7";

export interface DifficultyConfig {
  // Search parameters
  maxDepth: number;              // Maximum search depth
  timeLimit: number;             // Time limit in milliseconds
  minDepth: number;              // Minimum depth before returning

  // Evaluation features
  useVoronoi: boolean;           // Use Voronoi territory analysis
  usePartitionDetection: boolean; // Detect board partitions
  useEndgameSolver: boolean;     // Use endgame solver when partitioned
  useTranspositionTable: boolean; // Cache evaluated positions

  // Move selection
  moveSelectionRange: number;    // 0.0 = best only, 0.5 = top 50%
  mistakeRate: number;           // Probability of making a suboptimal move

  // Move ordering
  useKillerMoves: boolean;       // Use killer move heuristic
  useHistoryHeuristic: boolean;  // Use history heuristic for ordering

  // Evaluation weights (for configurable evaluation)
  weights: {
    voronoiTerritory: number;    // Voronoi territory difference
    immediateMobility: number;   // Number of immediate moves
    centerControl: number;       // Distance to center
    wallPenalty: number;         // Penalty for being near walls
    partitionBonus: number;      // Bonus for advantageous partition
    isolationPenalty: number;    // Penalty when area < threshold
  };

  // Performance tuning
  destroyCandidateCount: number; // Number of destroy positions to evaluate
  earlyTerminationThreshold: number; // Score threshold for early termination
}

/**
 * NEXUS-3: Average Person Level
 * - Shallow search (depth 4)
 * - Basic evaluation (flood-fill based)
 * - Makes occasional mistakes (15%)
 * - Selects from top 55% of moves
 */
const NEXUS_3_CONFIG: DifficultyConfig = {
  maxDepth: 4,
  timeLimit: 3000,
  minDepth: 2,

  useVoronoi: false,
  usePartitionDetection: false,
  useEndgameSolver: false,
  useTranspositionTable: false,

  moveSelectionRange: 0.55,
  mistakeRate: 0.15,

  useKillerMoves: true,
  useHistoryHeuristic: false,

  weights: {
    voronoiTerritory: 0,         // Not used
    immediateMobility: 1.0,      // Basic mobility
    centerControl: 0.3,
    wallPenalty: 0.2,
    partitionBonus: 0,           // Not used
    isolationPenalty: 3.0,       // Reduced penalty
  },

  destroyCandidateCount: 4,
  earlyTerminationThreshold: 5000,
};

/**
 * NEXUS-5: Expert Level
 * - Medium search (depth 6)
 * - Advanced evaluation with Voronoi
 * - Rare mistakes (5%)
 * - Selects from top 25% of moves
 */
const NEXUS_5_CONFIG: DifficultyConfig = {
  maxDepth: 6,
  timeLimit: 5000,
  minDepth: 3,

  useVoronoi: true,
  usePartitionDetection: true,
  useEndgameSolver: true,        // Only when partitioned
  useTranspositionTable: true,

  moveSelectionRange: 0.25,
  mistakeRate: 0.05,

  useKillerMoves: true,
  useHistoryHeuristic: true,

  weights: {
    voronoiTerritory: 8.0,
    immediateMobility: 2.0,
    centerControl: 0.5,
    wallPenalty: 0.3,
    partitionBonus: 300,
    isolationPenalty: 5.0,
  },

  destroyCandidateCount: 5,
  earlyTerminationThreshold: 5000,
};

/**
 * NEXUS-7: Near-Unbeatable Level
 * - Deep search (depth 10)
 * - Full evaluation with all features
 * - No mistakes
 * - Always selects best move
 */
const NEXUS_7_CONFIG: DifficultyConfig = {
  maxDepth: 10,
  timeLimit: 10000,
  minDepth: 4,

  useVoronoi: true,
  usePartitionDetection: true,
  useEndgameSolver: true,
  useTranspositionTable: true,

  moveSelectionRange: 0.0,       // Always best move
  mistakeRate: 0.0,              // No mistakes

  useKillerMoves: true,
  useHistoryHeuristic: true,

  weights: {
    voronoiTerritory: 10.0,
    immediateMobility: 3.0,
    centerControl: 0.5,
    wallPenalty: 0.4,
    partitionBonus: 500,
    isolationPenalty: 8.0,
  },

  destroyCandidateCount: 7,
  earlyTerminationThreshold: 8000,
};

/**
 * Get configuration for a specific difficulty level
 */
export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  switch (difficulty) {
    case "NEXUS-3":
      return { ...NEXUS_3_CONFIG };
    case "NEXUS-5":
      return { ...NEXUS_5_CONFIG };
    case "NEXUS-7":
      return { ...NEXUS_7_CONFIG };
    default:
      return { ...NEXUS_5_CONFIG }; // Default to medium
  }
}

/**
 * Apply mistake rate to move selection
 * Returns true if AI should make a "mistake" (pick suboptimal move)
 */
export function shouldMakeMistake(difficulty: Difficulty): boolean {
  const config = getDifficultyConfig(difficulty);
  return Math.random() < config.mistakeRate;
}

/**
 * Select move index based on difficulty configuration
 * @param moveCount Total number of available moves (sorted by score)
 * @param difficulty Current difficulty level
 * @returns Index of the move to select
 */
export function selectMoveIndex(moveCount: number, difficulty: Difficulty): number {
  if (moveCount === 0) return 0;

  const config = getDifficultyConfig(difficulty);

  // Check for intentional mistake
  if (shouldMakeMistake(difficulty)) {
    // Pick from bottom half of moves
    const bottomStart = Math.floor(moveCount * 0.5);
    const randomOffset = Math.floor(Math.random() * (moveCount - bottomStart));
    return Math.min(bottomStart + randomOffset, moveCount - 1);
  }

  // Normal selection from top moves
  if (config.moveSelectionRange === 0) {
    return 0; // Always best move
  }

  const topCount = Math.max(1, Math.floor(moveCount * config.moveSelectionRange));
  return Math.floor(Math.random() * topCount);
}

/**
 * Get human-readable difficulty description
 */
export function getDifficultyDescription(difficulty: Difficulty): {
  name: string;
  description: string;
  searchDepth: number;
  strength: string;
} {
  switch (difficulty) {
    case "NEXUS-3":
      return {
        name: "NEXUS-3",
        description: "Average person level - good challenge for casual players",
        searchDepth: 4,
        strength: "Beginner"
      };
    case "NEXUS-5":
      return {
        name: "NEXUS-5",
        description: "Expert level - challenging for experienced players",
        searchDepth: 6,
        strength: "Expert"
      };
    case "NEXUS-7":
      return {
        name: "NEXUS-7",
        description: "Near-unbeatable - only the best can win",
        searchDepth: 10,
        strength: "Master"
      };
  }
}
