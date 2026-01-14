/**
 * Partition Detection for ISOLATION
 *
 * Detects when the board is partitioned (players cannot reach each other)
 * and calculates the size of each player's region.
 *
 * In a partitioned game, the player with more cells in their region
 * will typically win with optimal play (longest path).
 */

import type { BoardState } from "./types";

// 8 directions for queen movement (adjacent cells only for flood fill)
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
 */
export function detectPartition(board: BoardState): PartitionResult {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  // Flood fill from player position
  const playerReachable = floodFill(playerPos, aiPos, boardSize, destroyed);

  // Check if AI is reachable from player
  const aiKey = `${aiPos.r},${aiPos.c}`;
  const isPartitioned = !playerReachable.has(aiKey);

  if (!isPartitioned) {
    return {
      isPartitioned: false,
      playerRegionSize: 0,
      aiRegionSize: 0,
      predictedWinner: 'unknown',
      playerReachableCells: new Set(),
      aiReachableCells: new Set()
    };
  }

  // Flood fill from AI position
  const aiReachable = floodFill(aiPos, playerPos, boardSize, destroyed);

  // Calculate region sizes (excluding the piece positions themselves)
  const playerRegionSize = playerReachable.size;
  const aiRegionSize = aiReachable.size;

  // In a partitioned game, the player with more cells typically wins
  // This is because they can make more moves before running out
  let predictedWinner: 'player' | 'ai' | 'tie' | 'unknown';

  if (playerRegionSize > aiRegionSize) {
    predictedWinner = 'player';
  } else if (aiRegionSize > playerRegionSize) {
    predictedWinner = 'ai';
  } else {
    // Equal region sizes - outcome depends on who moves first
    // Since player moves first, AI will run out first if regions are equal
    // But this is complex - mark as tie for now
    predictedWinner = 'tie';
  }

  return {
    isPartitioned,
    playerRegionSize,
    aiRegionSize,
    predictedWinner,
    playerReachableCells: playerReachable,
    aiReachableCells: aiReachable
  };
}

/**
 * Flood fill to find all reachable cells from a position
 * Uses adjacency (8 directions) not queen movement for accurate region calculation
 */
function floodFill(
  startPos: { r: number; c: number },
  blockedPiecePos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): Set<string> {
  const visited = new Set<string>();
  const queue: Array<{ r: number; c: number }> = [startPos];
  const startKey = `${startPos.r},${startPos.c}`;
  visited.add(startKey);

  const isBlocked = (r: number, c: number): boolean => {
    if (r < 0 || r >= boardSize.rows || c < 0 || c >= boardSize.cols) return true;
    if (r === blockedPiecePos.r && c === blockedPiecePos.c) return true;
    return destroyed.some(d => d.r === r && d.c === c);
  };

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const dir of DIRECTIONS) {
      const nr = current.r + dir.dr;
      const nc = current.c + dir.dc;
      const key = `${nr},${nc}`;

      if (visited.has(key)) continue;
      if (isBlocked(nr, nc)) continue;

      visited.add(key);
      queue.push({ r: nr, c: nc });
    }
  }

  // Remove the starting position from the count (we want cells the piece can move to)
  visited.delete(startKey);

  return visited;
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
  const testBoard: BoardState = {
    ...board,
    destroyed: tempDestroyed
  };

  const result = detectPartition(testBoard);
  return result.isPartitioned;
}

/**
 * Evaluate partition potential - how close is the board to being partitioned
 * Returns a score where higher = more likely to partition soon
 */
export function evaluatePartitionPotential(board: BoardState): number {
  const { boardSize, playerPos, aiPos, destroyed } = board;

  // Count cells on the "path" between players
  // If this number is small, partition is more likely
  const minR = Math.min(playerPos.r, aiPos.r);
  const maxR = Math.max(playerPos.r, aiPos.r);
  const minC = Math.min(playerPos.c, aiPos.c);
  const maxC = Math.max(playerPos.c, aiPos.c);

  let pathCells = 0;
  let blockedPathCells = 0;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      // Skip if it's a player position
      if ((r === playerPos.r && c === playerPos.c) ||
          (r === aiPos.r && c === aiPos.c)) continue;

      pathCells++;

      if (destroyed.some(d => d.r === r && d.c === c)) {
        blockedPathCells++;
      }
    }
  }

  if (pathCells === 0) return 1.0; // Already adjacent

  // Return ratio of blocked cells in the path
  return blockedPathCells / pathCells;
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

  // Try destroying each empty cell
  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      // Skip if already destroyed or occupied
      if (destroyed.some(d => d.r === r && d.c === c)) continue;
      if ((r === playerPos.r && c === playerPos.c) ||
          (r === aiPos.r && c === aiPos.c)) continue;

      const destroyPos = { r, c };

      // Check if this would cause partition
      if (wouldCausePartition(board, destroyPos)) {
        // Calculate the advantage
        const tempBoard: BoardState = {
          ...board,
          destroyed: [...destroyed, destroyPos]
        };

        const result = detectPartition(tempBoard);

        // Calculate advantage (positive = good for AI)
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
