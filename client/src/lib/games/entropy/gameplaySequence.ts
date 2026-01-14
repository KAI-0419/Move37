/**
 * ENTROPY Gameplay Sequence
 *
 * Predefined cinematic gameplay sequence for preview demonstration.
 * Shows a high-quality, fast-paced game between two skilled players.
 */

import type { Move } from "./types";

/**
 * Cinematic gameplay sequence showing strategic Hex play.
 * This sequence demonstrates:
 * - Opening strategy
 * - Connection building
 * - Blocking opponent's paths
 * - Winning through left-right connection
 */
export const cinematicGameplaySequence: Move[] = [
  // Player opening - center control
  { r: 5, c: 5 },

  // AI response - top-bottom strategy
  { r: 3, c: 5 },

  // Player expands left
  { r: 5, c: 4 },

  // AI builds connection
  { r: 4, c: 6 },

  // Player continues left expansion
  { r: 5, c: 3 },

  // AI defends
  { r: 5, c: 6 },

  // Player pushes left
  { r: 4, c: 3 },

  // AI blocks
  { r: 4, c: 4 },

  // Player finds alternative path
  { r: 6, c: 4 },

  // AI continues vertical
  { r: 2, c: 5 },

  // Player goes around
  { r: 6, c: 3 },

  // AI tries to block
  { r: 6, c: 5 },

  // Player reaches left edge
  { r: 5, c: 2 },

  // AI continues building
  { r: 1, c: 5 },

  // Player secures left connection
  { r: 5, c: 1 },

  // AI tries to interfere (too late)
  { r: 5, c: 0 },

  // Player extends right
  { r: 5, c: 7 },

  // AI builds more
  { r: 6, c: 6 },

  // Player continues right
  { r: 4, c: 7 },

  // AI last attempt
  { r: 7, c: 5 },

  // Player extends
  { r: 4, c: 8 },

  // AI tries
  { r: 3, c: 7 },

  // Player near right edge
  { r: 3, c: 9 },

  // AI blocking
  { r: 4, c: 9 },

  // Player final connection to right edge - WINNING MOVE
  { r: 3, c: 10 },
];

/**
 * Alternative shorter sequence for faster preview
 */
export const quickGameplaySequence: Move[] = [
  // Player opening
  { r: 5, c: 5 },
  // AI
  { r: 3, c: 5 },
  // Player
  { r: 5, c: 4 },
  // AI
  { r: 4, c: 6 },
  // Player
  { r: 5, c: 3 },
  // AI
  { r: 2, c: 5 },
  // Player
  { r: 5, c: 2 },
  // AI
  { r: 1, c: 5 },
  // Player
  { r: 5, c: 1 },
  // AI
  { r: 5, c: 6 },
  // Player
  { r: 5, c: 7 },
  // AI
  { r: 6, c: 5 },
  // Player
  { r: 4, c: 7 },
  // AI
  { r: 7, c: 5 },
  // Player
  { r: 4, c: 8 },
  // AI
  { r: 3, c: 6 },
  // Player
  { r: 3, c: 9 },
  // AI
  { r: 8, c: 5 },
  // Player - WINNING MOVE
  { r: 3, c: 10 },
];
