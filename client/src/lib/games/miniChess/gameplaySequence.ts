/**
 * Mini Chess Gameplay Sequence
 *
 * Predefined cinematic gameplay sequence for preview demonstration.
 * Shows a high-quality, fast-paced chess game between two skilled players.
 */

import type { GameMove } from "@shared/gameEngineInterface";

/**
 * Cinematic gameplay sequence showing strategic mini chess play.
 * This sequence demonstrates:
 * - Opening pawn advances
 * - Knight maneuvers
 * - King positioning
 * - Tactical captures
 * - Winning endgame
 *
 * Board positions (5x5):
 * Row 0: AI pieces (uppercase)
 * Row 4: Player pieces (lowercase)
 * Initial: "NPKPN/5/5/5/npkpn"
 */
export const cinematicGameplaySequence: GameMove[] = [
  // Move 1: Player center pawn advance
  { from: { r: 4, c: 2 }, to: { r: 3, c: 2 } },

  // Move 2: AI center pawn advance
  { from: { r: 0, c: 2 }, to: { r: 1, c: 2 } },

  // Move 3: Player knight develops
  { from: { r: 4, c: 0 }, to: { r: 2, c: 1 } },

  // Move 4: AI knight develops
  { from: { r: 0, c: 0 }, to: { r: 2, c: 1 } }, // Captures player's knight!

  // Move 5: Player pawn advance
  { from: { r: 4, c: 1 }, to: { r: 3, c: 1 } },

  // Move 6: AI knight moves to strong position
  { from: { r: 2, c: 1 }, to: { r: 3, c: 3 } },

  // Move 7: Player pawn captures
  { from: { r: 3, c: 2 }, to: { r: 2, c: 1 } },

  // Move 8: AI pawn advance
  { from: { r: 1, c: 2 }, to: { r: 2, c: 2 } },

  // Move 9: Player king moves up
  { from: { r: 4, c: 2 }, to: { r: 3, c: 2 } },

  // Move 10: AI knight attacks
  { from: { r: 3, c: 3 }, to: { r: 1, c: 2 } },

  // Move 11: Player pawn advance
  { from: { r: 4, c: 3 }, to: { r: 3, c: 3 } },

  // Move 12: AI pawn captures
  { from: { r: 2, c: 2 }, to: { r: 3, c: 3 } }, // Captures pawn

  // Move 13: Player king advances
  { from: { r: 3, c: 2 }, to: { r: 2, c: 2 } },

  // Move 14: AI king defends
  { from: { r: 0, c: 2 }, to: { r: 1, c: 2 } },

  // Move 15: Player knight develops right side
  { from: { r: 4, c: 4 }, to: { r: 2, c: 3 } },

  // Move 16: AI pawn advances
  { from: { r: 3, c: 3 }, to: { r: 4, c: 3 } },
];

/**
 * Shorter sequence for faster preview (10-12 moves)
 */
export const quickGameplaySequence: GameMove[] = [
  // 1. Player: Pawn Advance
  { from: { r: 4, c: 1 }, to: { r: 3, c: 1 } },

  // 2. AI: Pawn Advance
  { from: { r: 0, c: 3 }, to: { r: 1, c: 3 } },

  // 3. Player: Knight Advance (Center)
  { from: { r: 4, c: 0 }, to: { r: 2, c: 1 } },

  // 4. AI: Knight Advance (Aggressive)
  { from: { r: 0, c: 4 }, to: { r: 2, c: 3 } },

  // 5. Player: King Advance (Tactical)
  { from: { r: 4, c: 2 }, to: { r: 3, c: 2 } },

  // 6. AI: Knight Deep Dive (Blunder?)
  { from: { r: 2, c: 3 }, to: { r: 4, c: 2 } },

  // 7. Player: King Captures Knight
  { from: { r: 3, c: 2 }, to: { r: 2, c: 3 } }, // !! Capture 1

  // 8. AI: Pawn Defense
  { from: { r: 0, c: 1 }, to: { r: 1, c: 1 } },

  // 9. Player: Knight Captures Knight (Winning Move)
  { from: { r: 2, c: 1 }, to: { r: 0, c: 0 } }, // !! Capture 2 (Big advantage)

  // 10. AI: Pawn Advances (Futile)
  { from: { r: 1, c: 1 }, to: { r: 2, c: 1 } },
];
