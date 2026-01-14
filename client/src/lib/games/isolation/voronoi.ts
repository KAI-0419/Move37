/**
 * Voronoi Territory Analysis for ISOLATION
 *
 * Calculates which cells each player can reach first using BFS.
 * This is more accurate than simple flood-fill as it considers
 * the actual distance (in moves) to each cell.
 */

import type { BoardState } from "./types";

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
 * Uses BFS to find shortest distance from each position to all cells
 */
export function calculateVoronoi(board: BoardState): VoronoiResult {
  const { boardSize, playerPos, aiPos, destroyed } = board;
  const BOARD_SIZE = boardSize.rows * boardSize.cols;
  const INF = 999;

  const playerDist = new Array(BOARD_SIZE).fill(INF);
  const aiDist = new Array(BOARD_SIZE).fill(INF);

  // Convert position to index
  const posToIndex = (r: number, c: number) => r * boardSize.cols + c;
  const indexToPos = (idx: number) => ({
    r: Math.floor(idx / boardSize.cols),
    c: idx % boardSize.cols
  });

  // Check if position is blocked
  const isBlocked = (r: number, c: number): boolean => {
    if (r < 0 || r >= boardSize.rows || c < 0 || c >= boardSize.cols) return true;
    return destroyed.some(d => d.r === r && d.c === c);
  };

  // BFS from player position
  const playerStartIdx = posToIndex(playerPos.r, playerPos.c);
  const aiStartIdx = posToIndex(aiPos.r, aiPos.c);

  bfsDistance(playerPos, playerDist, aiPos, boardSize, destroyed);
  bfsDistance(aiPos, aiDist, playerPos, boardSize, destroyed);

  // Calculate territories
  let playerTerritory = 0;
  let aiTerritory = 0;
  let contested = 0;
  let totalReachable = 0;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const { r, c } = indexToPos(i);

    // Skip destroyed cells
    if (isBlocked(r, c)) continue;

    // Skip player and AI positions
    if (i === playerStartIdx || i === aiStartIdx) continue;

    // Skip unreachable cells
    if (playerDist[i] === INF && aiDist[i] === INF) continue;

    totalReachable++;

    if (playerDist[i] < aiDist[i]) {
      playerTerritory++;
    } else if (aiDist[i] < playerDist[i]) {
      aiTerritory++;
    } else {
      contested++; // Equal distance - contested cell
    }
  }

  return {
    playerTerritory,
    aiTerritory,
    contested,
    playerDistance: playerDist,
    aiDistance: aiDist,
    totalReachable
  };
}

/**
 * BFS to calculate shortest distance from start position to all cells
 * In Isolation, each move counts as distance 1 regardless of how far the queen slides
 */
function bfsDistance(
  startPos: { r: number; c: number },
  distances: number[],
  otherPiecePos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): void {
  const INF = 999;
  const posToIndex = (r: number, c: number) => r * boardSize.cols + c;

  const isBlocked = (r: number, c: number): boolean => {
    if (r < 0 || r >= boardSize.rows || c < 0 || c >= boardSize.cols) return true;
    if (r === otherPiecePos.r && c === otherPiecePos.c) return true;
    return destroyed.some(d => d.r === r && d.c === c);
  };

  // Initialize
  distances.fill(INF);
  const startIdx = posToIndex(startPos.r, startPos.c);
  distances[startIdx] = 0;

  // BFS queue: [row, col, distance]
  const queue: Array<{ r: number; c: number; dist: number }> = [
    { r: startPos.r, c: startPos.c, dist: 0 }
  ];

  while (queue.length > 0) {
    const { r, c, dist } = queue.shift()!;

    // Try all 8 directions (queen movement)
    for (const dir of DIRECTIONS) {
      let nr = r + dir.dr;
      let nc = c + dir.dc;

      // Slide along direction until blocked
      while (!isBlocked(nr, nc)) {
        const nextIdx = posToIndex(nr, nc);

        // Only update if we found a shorter path
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
 * This is faster than full Voronoi for simple evaluations
 */
export function calculateImmediateMobility(
  pos: { r: number; c: number },
  otherPos: { r: number; c: number },
  boardSize: { rows: number; cols: number },
  destroyed: { r: number; c: number }[]
): number {
  const isBlocked = (r: number, c: number): boolean => {
    if (r < 0 || r >= boardSize.rows || c < 0 || c >= boardSize.cols) return true;
    if (r === otherPos.r && c === otherPos.c) return true;
    return destroyed.some(d => d.r === r && d.c === c);
  };

  let moveCount = 0;

  for (const dir of DIRECTIONS) {
    let nr = pos.r + dir.dr;
    let nc = pos.c + dir.dc;

    while (!isBlocked(nr, nc)) {
      moveCount++;
      nr += dir.dr;
      nc += dir.dc;
    }
  }

  return moveCount;
}

/**
 * Calculate the "critical cells" - cells that divide the board
 * These are cells where control significantly impacts both players
 */
export function identifyCriticalCells(board: BoardState): number[] {
  const { boardSize, playerPos, aiPos, destroyed } = board;
  const critical: number[] = [];

  const posToIndex = (r: number, c: number) => r * boardSize.cols + c;

  // Get Voronoi distances
  const voronoi = calculateVoronoi(board);

  // Cells are critical if:
  // 1. They are contested (equal distance)
  // 2. They are on the "frontier" between territories
  for (let r = 0; r < boardSize.rows; r++) {
    for (let c = 0; c < boardSize.cols; c++) {
      const idx = posToIndex(r, c);

      // Skip destroyed and occupied cells
      if (destroyed.some(d => d.r === r && d.c === c)) continue;
      if ((r === playerPos.r && c === playerPos.c) ||
          (r === aiPos.r && c === aiPos.c)) continue;

      const pDist = voronoi.playerDistance[idx];
      const aDist = voronoi.aiDistance[idx];

      // Skip unreachable cells
      if (pDist === 999 && aDist === 999) continue;

      // Critical if contested or on the frontier (distance difference <= 1)
      if (Math.abs(pDist - aDist) <= 1) {
        critical.push(idx);
      }
    }
  }

  return critical;
}
