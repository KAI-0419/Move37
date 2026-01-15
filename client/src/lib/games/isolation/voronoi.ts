/**
 * Voronoi Territory Analysis for ISOLATION
 *
 * Calculates which cells each player can reach first using BFS.
 * Now uses bitboard operations for improved performance.
 */

import type { BoardState } from "./types";
import {
  calculateBitboardVoronoi,
  posToIndex,
  indexToPos,
  CELL_MASKS,
  getQueenMoves,
  bitboardToIndices,
  popCount
} from "./bitboard";

// 8 directions for queen movement
const DIRECTIONS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },                      { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 }
];

export interface VoronoiResult {
  playerTerritory: number;   // Cells player reaches first
  aiTerritory: number;       // Cells AI reaches first
  contested: number;         // Cells reached at same distance
  playerDistance: number[];  // Distance from player to each cell (49 cells)
  aiDistance: number[];      // Distance from AI to each cell (49 cells)
  totalReachable: number;    // Total reachable cells by either player
}

/**
 * Calculate Voronoi territories for both players
 * Uses bitboard-based BFS for performance
 */
export function calculateVoronoi(board: BoardState): VoronoiResult {
  const { boardSize, playerPos, aiPos, destroyed } = board;
  const BOARD_SIZE = boardSize.rows * boardSize.cols;
  const INF = 999;

  // Use bitboard implementation for territory calculation
  const bbVoronoi = calculateBitboardVoronoi(playerPos, aiPos, destroyed);

  // Calculate distances using BFS for compatibility
  const playerDist = new Array(BOARD_SIZE).fill(INF);
  const aiDist = new Array(BOARD_SIZE).fill(INF);

  // BFS from both positions
  bfsDistance(playerPos, playerDist, aiPos, boardSize, destroyed);
  bfsDistance(aiPos, aiDist, playerPos, boardSize, destroyed);

  return {
    playerTerritory: bbVoronoi.playerCount,
    aiTerritory: bbVoronoi.aiCount,
    contested: bbVoronoi.contestedCount,
    playerDistance: playerDist,
    aiDistance: aiDist,
    totalReachable: bbVoronoi.playerCount + bbVoronoi.aiCount + bbVoronoi.contestedCount
  };
}

/**
 * BFS to calculate shortest distance from start position to all cells
 * Each queen move counts as distance 1 regardless of distance traveled
 */
function bfsDistance(
  startPos: { r: number; c: number },
  distances: number[],
  otherPiecePos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): void {
  const INF = 999;

  const isBlocked = (r: number, c: number): boolean => {
    if (r < 0 || r >= boardSize.rows || c < 0 || c >= boardSize.cols) return true;
    if (r === otherPiecePos.r && c === otherPiecePos.c) return true;
    return destroyed.some(d => d.r === r && d.c === c);
  };

  distances.fill(INF);
  const startIdx = posToIndex(startPos.r, startPos.c);
  distances[startIdx] = 0;

  const queue: Array<{ r: number; c: number; dist: number }> = [
    { r: startPos.r, c: startPos.c, dist: 0 }
  ];

  while (queue.length > 0) {
    const { r, c, dist } = queue.shift()!;

    for (const dir of DIRECTIONS) {
      let nr = r + dir.dr;
      let nc = c + dir.dc;

      while (!isBlocked(nr, nc)) {
        const nextIdx = posToIndex(nr, nc);

        if (distances[nextIdx] > dist + 1) {
          distances[nextIdx] = dist + 1;
          queue.push({ r: nr, c: nc, dist: dist + 1 });
        }

        nr += dir.dr;
        nc += dir.dc;
      }
    }
  }
}

/**
 * Quick mobility calculation - number of immediate valid moves
 */
export function calculateImmediateMobility(
  pos: { r: number; c: number },
  otherPos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): number {
  // Create blocked bitboard
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }
  blocked |= CELL_MASKS[posToIndex(otherPos.r, otherPos.c)];

  const moves = getQueenMoves(pos, blocked);
  return popCount(moves);
}

/**
 * Calculate the "critical cells" - cells that divide the board
 */
export function identifyCriticalCells(board: BoardState): number[] {
  const { boardSize, playerPos, aiPos, destroyed } = board;
  const critical: number[] = [];

  const voronoi = calculateVoronoi(board);

  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const idx = posToIndex(r, c);

      // Skip destroyed and occupied cells
      if (destroyed.some(d => d.r === r && d.c === c)) continue;
      if ((r === playerPos.r && c === playerPos.c) ||
          (r === aiPos.r && c === aiPos.c)) continue;

      const pDist = voronoi.playerDistance[idx];
      const aDist = voronoi.aiDistance[idx];

      if (pDist === 999 && aDist === 999) continue;

      // Critical if contested or on the frontier
      if (Math.abs(pDist - aDist) <= 1) {
        critical.push(idx);
      }
    }
  }

  return critical;
}
