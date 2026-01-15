/**
 * Partition Detection for ISOLATION
 *
 * Detects when the board is partitioned (players cannot reach each other)
 * and calculates the size of each player's region.
 *
 * FIXED: Now uses queen-movement based reachability instead of adjacency.
 * This correctly identifies when pieces are truly isolated.
 */

import type { BoardState } from "./types";
import {
  detectPartitionBitboard,
  queenFloodFill,
  createBlockedBitboard,
  posToIndex,
  indexToPos,
  bitboardToIndices,
  popCount,
  CELL_MASKS,
  getQueenMoves,
  BOARD_SIZE
} from "./bitboard";

// 8 directions for queen movement
const DIRECTIONS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },                      { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 }
];

export interface PartitionResult {
  isPartitioned: boolean;
  playerRegionSize: number;
  aiRegionSize: number;
  predictedWinner: 'player' | 'ai' | 'tie' | 'unknown';
  // Additional info for endgame solver
  playerReachableCells: Set<string>;
  aiReachableCells: Set<string>;
}

/**
 * Detect if the board is partitioned and calculate region sizes
 * Uses queen-movement based reachability for accuracy
 */
export function detectPartition(board: BoardState): PartitionResult {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  // Use bitboard-based partition detection
  const result = detectPartitionBitboard(playerPos, aiPos, destroyed);

  if (!result.isPartitioned) {
    return {
      isPartitioned: false,
      playerRegionSize: 0,
      aiRegionSize: 0,
      predictedWinner: 'unknown',
      playerReachableCells: new Set(),
      aiReachableCells: new Set()
    };
  }

  // Convert bitboard regions to sets for compatibility
  const playerReachableCells = new Set<string>();
  const aiReachableCells = new Set<string>();

  const playerIndices = bitboardToIndices(result.playerRegion);
  const aiIndices = bitboardToIndices(result.aiRegion);

  for (const idx of playerIndices) {
    const pos = indexToPos(idx);
    playerReachableCells.add(`${pos.r},${pos.c}`);
  }

  for (const idx of aiIndices) {
    const pos = indexToPos(idx);
    aiReachableCells.add(`${pos.r},${pos.c}`);
  }

  // Calculate predicted winner based on region sizes
  let predictedWinner: 'player' | 'ai' | 'tie' | 'unknown';

  if (result.playerRegionSize > result.aiRegionSize) {
    predictedWinner = 'player';
  } else if (result.aiRegionSize > result.playerRegionSize) {
    predictedWinner = 'ai';
  } else {
    // Equal region sizes - more complex analysis needed
    // Generally, equal regions favor the player who moves second
    // But it depends on exact board shape
    predictedWinner = 'tie';
  }

  return {
    isPartitioned: true,
    playerRegionSize: result.playerRegionSize,
    aiRegionSize: result.aiRegionSize,
    predictedWinner,
    playerReachableCells,
    aiReachableCells
  };
}

/**
 * Legacy flood fill for compatibility (now uses queen movement)
 */
function floodFillQueen(
  startPos: { r: number; c: number },
  blockedPiecePos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): Set<string> {
  // Create blocked bitboard
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }
  blocked |= CELL_MASKS[posToIndex(blockedPiecePos.r, blockedPiecePos.c)];

  // Use queen flood fill
  const reachable = queenFloodFill(startPos, blocked);

  // Convert to set
  const result = new Set<string>();
  const indices = bitboardToIndices(reachable);
  for (const idx of indices) {
    const pos = indexToPos(idx);
    if (pos.r !== startPos.r || pos.c !== startPos.c) {
      result.add(`${pos.r},${pos.c}`);
    }
  }

  return result;
}

/**
 * Check if a move would cause a partition
 * Useful for strategic decisions about when to isolate
 */
export function wouldCausePartition(
  board: BoardState,
  destroyPos: { r: number; c: number }
): boolean {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  // Create temporary destroyed list with the new destroy position
  const tempDestroyed = [...destroyed, destroyPos];

  // Check if partition would occur
  const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);
  return result.isPartitioned;
}

/**
 * Evaluate partition potential - how close is the board to being partitioned
 * Returns a score where higher = more likely to partition soon
 */
export function evaluatePartitionPotential(board: BoardState): number {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  // Create blocked bitboard
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  // Calculate the "choke points" between players
  // These are cells that, if destroyed, would isolate one player

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  // Count potential partition-causing cells
  let partitionCells = 0;
  let totalChecked = 0;

  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const idx = posToIndex(r, c);

      // Skip destroyed and occupied cells
      if (blocked & CELL_MASKS[idx]) continue;
      if (idx === playerIdx || idx === aiIdx) continue;

      totalChecked++;

      // Check if destroying this cell would partition
      const tempDestroyed = [...destroyed, { r, c }];
      const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);
      if (result.isPartitioned) {
        partitionCells++;
      }
    }
  }

  if (totalChecked === 0) return 1.0;

  // Return ratio of partition-causing cells
  return partitionCells / totalChecked;
}

/**
 * Find the best cell to destroy to maximize partition advantage
 * Returns null if no advantageous partition is possible
 */
export function findBestPartitionDestroy(
  board: BoardState,
  isAI: boolean
): { r: number; c: number } | null {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  let bestDestroy: { r: number; c: number } | null = null;
  let bestAdvantage = -Infinity;

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  // Create base blocked bitboard
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  // Try destroying each empty cell
  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const idx = posToIndex(r, c);

      // Skip if already destroyed or occupied
      if (blocked & CELL_MASKS[idx]) continue;
      if (idx === playerIdx || idx === aiIdx) continue;

      const destroyPos = { r, c };

      // Check if this would cause partition
      const tempDestroyed = [...destroyed, destroyPos];
      const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);

      if (result.isPartitioned) {
        // Calculate the advantage (positive = good for AI)
        const advantage = result.aiRegionSize - result.playerRegionSize;

        // If we're AI, we want positive advantage
        // If we're player, we want negative advantage
        const adjustedAdvantage = isAI ? advantage : -advantage;

        if (adjustedAdvantage > bestAdvantage) {
          bestAdvantage = adjustedAdvantage;
          bestDestroy = destroyPos;
        }
      }
    }
  }

  // Only return if we found an advantageous partition
  if (bestAdvantage > 0) {
    return bestDestroy;
  }

  return null;
}

/**
 * Calculate the critical cells - cells that would severely impact territory
 * These are the "choke points" of the board
 */
export function findCriticalCells(board: BoardState): { r: number; c: number }[] {
  const { boardSize, playerPos, aiPos, destroyed } = board;
  const critical: { r: number; c: number }[] = [];

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const idx = posToIndex(r, c);
      if (blocked & CELL_MASKS[idx]) continue;
      if (idx === playerIdx || idx === aiIdx) continue;

      // Check if destroying this would cause partition or significantly reduce territory
      const tempDestroyed = [...destroyed, { r, c }];
      const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);

      if (result.isPartitioned) {
        critical.push({ r, c });
      }
    }
  }

  return critical;
}
