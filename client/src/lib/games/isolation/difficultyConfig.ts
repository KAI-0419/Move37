/**
 * Difficulty Configuration for ISOLATION AI - Enhanced Version
 *
 * Three distinct difficulty levels with well-calibrated parameters:
 *
 * NEXUS-3: Average adult intelligence
 * - Basic evaluation, shallow search
 * - Makes occasional suboptimal moves
 * - Beatable with good strategy
 *
 * NEXUS-5: Isolation expert
 * - Advanced evaluation with territory analysis
 * - Deep search with move ordering
 * - Challenging for experienced players
 *
 * NEXUS-7: Near-unbeatable
 * - MCTS + Alpha-Beta hybrid search
 * - Perfect opening book + endgame solving
 * - Only the best human players can win
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
  useOpeningBook: boolean;       // Use pre-computed opening moves

  // Move selection (for adding "human-like" weakness)
  moveSelectionRange: number;    // 0.0 = best only, 0.5 = top 50%
  mistakeRate: number;           // Probability of making a suboptimal move
  blunderThreshold: number;      // Score difference to consider as blunder

  // Move ordering
  useKillerMoves: boolean;       // Use killer move heuristic
  useHistoryHeuristic: boolean;  // Use history heuristic for ordering

  // Evaluation weights
  weights: {
    territory: number;           // Voronoi territory difference
    mobility: number;            // Immediate move count
    mobilityPotential: number;   // 2-move lookahead mobility
    centerControl: number;       // Distance to center
    cornerAvoidance: number;     // Avoid corner positions
    partitionAdvantage: number;  // Partition region difference
    criticalCells: number;       // Control of critical cells
    openness: number;            // Access to open areas
    wallPenalty: number;         // Legacy - wall proximity
    voronoiTerritory: number;    // Legacy compatibility
    immediateMobility: number;   // Legacy compatibility
    isolationPenalty: number;    // Penalty for small areas
  };

  // Performance tuning
  destroyCandidateCount: number; // Number of destroy positions to evaluate
  earlyTerminationThreshold: number; // Score threshold for early termination
}

/**
 * NEXUS-3: Average Adult Intelligence Level
 *
 * Design goals:
 * - Winnable by casual players with some effort
 * - Makes believable human-like mistakes
 * - Focuses on basic mobility and center control
 * - Does not use advanced features
 */
const NEXUS_3_CONFIG: DifficultyConfig = {
  maxDepth: 5,
  timeLimit: 3000,
  minDepth: 3,

  useVoronoi: false,             // Use simple flood fill instead
  usePartitionDetection: false,  // No partition awareness
  useEndgameSolver: false,       // No endgame solving
  useTranspositionTable: false,  // Simple search
  useOpeningBook: false,         // Calculate from scratch

  moveSelectionRange: 0.4,       // Pick from top 40% of moves
  mistakeRate: 0.12,             // 12% chance of suboptimal move
  blunderThreshold: 5.0,         // Avoid obvious blunders

  useKillerMoves: true,          // Basic move ordering
  useHistoryHeuristic: false,

  weights: {
    territory: 0,                // Not used
    mobility: 2.0,               // Focus on immediate moves
    mobilityPotential: 0,        // No lookahead
    centerControl: 0.8,          // Some center awareness
    cornerAvoidance: 0.5,        // Slight corner avoidance
    partitionAdvantage: 0,       // No partition awareness
    criticalCells: 0,            // No critical cell analysis
    openness: 0.3,               // Basic openness
    wallPenalty: 0.3,
    voronoiTerritory: 1.5,       // Simple area counting
    immediateMobility: 2.0,
    isolationPenalty: 4.0,
  },

  destroyCandidateCount: 4,
  earlyTerminationThreshold: 5000,
};

/**
 * NEXUS-5: Isolation Expert Level
 *
 * Design goals:
 * - Challenging for experienced players
 * - Uses advanced territory analysis
 * - Deep search with good move ordering
 * - Occasionally misses optimal moves (5%)
 */
const NEXUS_5_CONFIG: DifficultyConfig = {
  maxDepth: 7,
  timeLimit: 12000,
  minDepth: 4,

  useVoronoi: true,              // Advanced territory analysis
  usePartitionDetection: true,   // Full partition awareness
  useEndgameSolver: true,        // Solve endgames exactly
  useTranspositionTable: true,   // Cache positions
  useOpeningBook: true,          // Use opening book

  moveSelectionRange: 0.0,       // Always pick the best move (Expert shouldn't play randomly)
  mistakeRate: 0.0,              // No intentional mistakes
  blunderThreshold: Infinity,    // N/A

  useKillerMoves: true,
  useHistoryHeuristic: true,

  weights: {
    territory: 4.0,              // Reduced: Don't just expand, attack!
    mobility: 6.0,               // Increased: Value options highly
    mobilityPotential: 4.0,      // Increased: Look ahead for options
    centerControl: 1.5,          // Increased: Control the center
    cornerAvoidance: 1.0,        // Avoid corners
    partitionAdvantage: 400,     // Stronger partition awareness
    criticalCells: 3.0,          // Control cut-points
    openness: 0.5,
    wallPenalty: 0.5,
    voronoiTerritory: 4.0,
    immediateMobility: 6.0,
    isolationPenalty: 10.0,      // Heavily penalize getting isolated
  },

  destroyCandidateCount: 3,      // Optimized: Only check top 3 destroys to increase depth
  earlyTerminationThreshold: 5000,
};

/**
 * NEXUS-7: Near-Unbeatable Level
 *
 * Design goals:
 * - Only the best human players can win
 * - Uses Deep Minimax (Depth 10+)
 * - Perfect opening book and endgame solving
 * - No intentional mistakes
 * - Deep, thorough analysis
 */
const NEXUS_7_CONFIG: DifficultyConfig = {
  maxDepth: 10,
  timeLimit: 10000,
  minDepth: 5,

  useVoronoi: true,              // Full Voronoi analysis
  usePartitionDetection: true,   // Full partition detection
  useEndgameSolver: true,        // Perfect endgame play
  useTranspositionTable: true,   // Full caching
  useOpeningBook: true,          // Perfect opening play

  moveSelectionRange: 0.0,       // Always best move
  mistakeRate: 0.0,              // No mistakes
  blunderThreshold: Infinity,    // N/A

  useKillerMoves: true,
  useHistoryHeuristic: true,

  weights: {
    territory: 4.0,              // Reduced: Don't just expand, attack!
    mobility: 10.0,              // Increased: Mobility is life
    mobilityPotential: 6.0,      // Increased: Deep lookahead for moves
    centerControl: 1.5,          // Reduced: Center is good, but freedom is better
    cornerAvoidance: 4.0,        // Increased: Corners are death
    partitionAdvantage: 600,     // Increased: Partitioning leads to forced wins
    criticalCells: 5.0,          // Increased: Control choke points
    openness: 1.5,               // Increased: Stay in the open
    wallPenalty: 0.8,
    voronoiTerritory: 5.0,
    immediateMobility: 10.0,     // Increased: Immediate survival
    isolationPenalty: 15.0,      // Maximum penalty for being isolated
  },

  destroyCandidateCount: 3,      // Balanced: Check top 3 to find better destroy options without killing depth
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
      return { ...NEXUS_5_CONFIG };
  }
}

/**
 * Apply mistake rate to move selection
 * Now with blunder prevention
 */
export function shouldMakeMistake(
  difficulty: Difficulty,
  bestScore: number,
  moveScore: number
): boolean {
  const config = getDifficultyConfig(difficulty);

  // Never make a blunder (score difference too large)
  if (bestScore - moveScore > config.blunderThreshold) {
    return false;
  }

  return Math.random() < config.mistakeRate;
}

/**
 * Select move index based on difficulty configuration
 * Improved algorithm with blunder prevention
 */
export function selectMoveIndex(
  moveCount: number,
  difficulty: Difficulty,
  scores?: number[]
): number {
  if (moveCount === 0) return 0;

  const config = getDifficultyConfig(difficulty);

  // NEXUS-7: Always best move
  if (config.moveSelectionRange === 0) {
    return 0;
  }

  // Check for intentional suboptimal play
  if (Math.random() < config.mistakeRate) {
    // Pick from lower-ranked moves, but not terrible ones
    const lowerStart = Math.floor(moveCount * 0.3);
    const lowerEnd = Math.floor(moveCount * 0.7);

    if (lowerStart < lowerEnd) {
      // Verify we're not picking a blunder if scores are provided
      if (scores && scores.length > 0) {
        const bestScore = scores[0];
        for (let i = lowerStart; i < lowerEnd; i++) {
          if (bestScore - scores[i] <= config.blunderThreshold) {
            return i;
          }
        }
        // All lower moves are blunders, pick from top range instead
      } else {
        return lowerStart + Math.floor(Math.random() * (lowerEnd - lowerStart));
      }
    }
  }

  // Normal selection from top moves
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
  features: string[];
} {
  switch (difficulty) {
    case "NEXUS-3":
      return {
        name: "NEXUS-3",
        description: "Average adult intelligence - beatable with strategy",
        searchDepth: 5,
        strength: "Beginner",
        features: [
          "Basic mobility analysis",
          "Simple center control",
          "Occasional mistakes (~12%)"
        ]
      };
    case "NEXUS-5":
      return {
        name: "NEXUS-5",
        description: "Isolation expert - challenging for experienced players",
        searchDepth: 7,
        strength: "Expert",
        features: [
          "Advanced territory analysis",
          "Partition detection",
          "Endgame solving",
          "Opening book",
          "Rare mistakes (~5%)"
        ]
      };
    case "NEXUS-7":
      return {
        name: "NEXUS-7",
        description: "Near-unbeatable - only masters can win",
        searchDepth: 12,
        strength: "Master",
        features: [
          "Deep Minimax Engine (Depth 10+)",
          "Perfect opening play",
          "Perfect endgame solving",
          "Full territory control",
          "No mistakes"
        ]
      };
  }
}
