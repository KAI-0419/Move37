/**
 * Isolation Gameplay Sequence
 *
 * Predefined cinematic gameplay sequence for preview demonstration.
 * Shows a high-quality, fast-paced Isolation game between two skilled players.
 */

import type { BoardState } from "./types";

/**
 * Fixed initial board state for consistent preview experience
 * Player starts bottom-left, AI starts top-right
 */
export const PREVIEW_INITIAL_BOARD: BoardState = {
  boardSize: { rows: 7, cols: 7 },
  playerPos: { r: 6, c: 0 }, // Bottom-left
  aiPos: { r: 0, c: 6 },     // Top-right
  destroyed: [],
};

/**
 * Move sequence for Isolation game preview
 * Each move includes: from (current position), to (new position), destroy (cell to destroy)
 * Player and AI alternate turns
 */
export interface IsolationGameplayMove {
  from: { r: number; c: number };
  to: { r: number; c: number };
  destroy: { r: number; c: number };
}

/**
 * Cinematic gameplay sequence showing strategic Isolation play.
 * This sequence demonstrates:
 * - Movement strategy
 * - Board control through destruction
 * - Tactical positioning
 * - Trapping opponent
 * - Winning endgame
 */
export const cinematicGameplaySequence: IsolationGameplayMove[] = [
  // Move 1: Player moves toward center, destroys behind
  { from: { r: 6, c: 0 }, to: { r: 5, c: 1 }, destroy: { r: 6, c: 1 } },

  // Move 2: AI moves toward center, blocks player's path
  { from: { r: 0, c: 6 }, to: { r: 1, c: 5 }, destroy: { r: 1, c: 6 } },

  // Move 3: Player advances
  { from: { r: 5, c: 1 }, to: { r: 4, c: 2 }, destroy: { r: 5, c: 2 } },

  // Move 4: AI continues down
  { from: { r: 1, c: 5 }, to: { r: 2, c: 4 }, destroy: { r: 2, c: 5 } },

  // Move 5: Player moves to center
  { from: { r: 4, c: 2 }, to: { r: 3, c: 3 }, destroy: { r: 4, c: 3 } },

  // Move 6: AI blocks from top
  { from: { r: 2, c: 4 }, to: { r: 3, c: 4 }, destroy: { r: 2, c: 3 } },

  // Move 7: Player moves left
  { from: { r: 3, c: 3 }, to: { r: 3, c: 2 }, destroy: { r: 3, c: 1 } },

  // Move 8: AI advances
  { from: { r: 3, c: 4 }, to: { r: 4, c: 4 }, destroy: { r: 5, c: 4 } },

  // Move 9: Player goes up
  { from: { r: 3, c: 2 }, to: { r: 2, c: 2 }, destroy: { r: 2, c: 1 } },

  // Move 10: AI moves down-left
  { from: { r: 4, c: 4 }, to: { r: 5, c: 3 }, destroy: { r: 6, c: 3 } },

  // Move 11: Player traps AI
  { from: { r: 2, c: 2 }, to: { r: 1, c: 2 }, destroy: { r: 1, c: 3 } },

  // Move 12: AI tries to escape
  { from: { r: 5, c: 3 }, to: { r: 6, c: 2 }, destroy: { r: 6, c: 4 } },

  // Move 13: Player continues strategy
  { from: { r: 1, c: 2 }, to: { r: 1, c: 1 }, destroy: { r: 0, c: 1 } },

  // Move 14: AI forced move
  { from: { r: 6, c: 2 }, to: { r: 5, c: 2 }, destroy: { r: 4, c: 1 } },

  // Move 15: Player blocks AI
  { from: { r: 1, c: 1 }, to: { r: 2, c: 0 }, destroy: { r: 3, c: 0 } },

  // Move 16: AI's last move before being trapped
  { from: { r: 5, c: 2 }, to: { r: 4, c: 1 }, destroy: { r: 5, c: 0 } },
];

/**
 * Shorter sequence for faster preview (10-12 moves)
 */
export const quickGameplaySequence: IsolationGameplayMove[] = [
  // 1. Player: Opening (Destroy AI Escape)
  { from: { r: 6, c: 0 }, to: { r: 4, c: 2 }, destroy: { r: 5, c: 1 } },

  // 2. AI: Center Response (Destroy Player Back)
  { from: { r: 0, c: 6 }, to: { r: 2, c: 4 }, destroy: { r: 1, c: 5 } },

  // 3. Player: Center Control (Block Left)
  { from: { r: 4, c: 2 }, to: { r: 3, c: 3 }, destroy: { r: 4, c: 2 } },

  // 4. AI: Maintain Distance (Block Up)
  { from: { r: 2, c: 4 }, to: { r: 1, c: 4 }, destroy: { r: 2, c: 4 } },

  // 5. Player: Advance (Pressuring AI)
  { from: { r: 3, c: 3 }, to: { r: 2, c: 3 }, destroy: { r: 3, c: 3 } },

  // 6. AI: Corner Retreat (Forced)
  { from: { r: 1, c: 4 }, to: { r: 0, c: 4 }, destroy: { r: 1, c: 4 } },

  // 7. Player: Diagonal Cut (Trapping)
  { from: { r: 2, c: 3 }, to: { r: 1, c: 2 }, destroy: { r: 2, c: 3 } },

  // 8. AI: Side Step (Desperate)
  { from: { r: 0, c: 4 }, to: { r: 0, c: 3 }, destroy: { r: 0, c: 4 } },

  // 9. Player: The Trap (Closing the box)
  { from: { r: 1, c: 2 }, to: { r: 2, c: 1 }, destroy: { r: 0, c: 2 } },
  // Leaves AI with very few moves (0,3 -> 1,3 only)

  // 10. AI: Final Move (Into the only open slot - Trapped)
  { from: { r: 0, c: 3 }, to: { r: 1, c: 3 }, destroy: { r: 0, c: 3 } },
];
