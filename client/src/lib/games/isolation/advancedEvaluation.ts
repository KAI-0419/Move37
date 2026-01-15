/**
 * Advanced Evaluation Functions for ISOLATION AI
 *
 * This module provides sophisticated board evaluation for NEXUS-5 and NEXUS-7.
 * Key features:
 * - Territory quality analysis (not just size)
 * - Multi-move mobility lookahead
 * - Critical bottleneck detection
 * - Opening principles
 * - Positional awareness
 */

import type { BoardState } from "./types";
import {
  posToIndex,
  indexToPos,
  CELL_MASKS,
  getQueenMoves,
  queenFloodFill,
  popCount,
  bitboardToIndices,
  calculateBitboardVoronoi,
  detectPartitionBitboard,
  BOARD_SIZE
} from "./bitboard";
import { getValidMoves } from "./moveValidation";

// Precomputed center distance table
const CENTER_DISTANCE: number[] = [];
const CENTER_R = 3;
const CENTER_C = 3;
for (let i = 0; i < 49; i++) {
  const r = Math.floor(i / 7);
  const c = i % 7;
  CENTER_DISTANCE[i] = Math.abs(r - CENTER_R) + Math.abs(c - CENTER_C);
}

// Precomputed corner proximity table
const CORNER_PROXIMITY: number[] = [];
for (let i = 0; i < 49; i++) {
  const r = Math.floor(i / 7);
  const c = i % 7;
  const toTopLeft = r + c;
  const toTopRight = r + (6 - c);
  const toBottomLeft = (6 - r) + c;
  const toBottomRight = (6 - r) + (6 - c);
  CORNER_PROXIMITY[i] = Math.min(toTopLeft, toTopRight, toBottomLeft, toBottomRight);
}

export interface AdvancedEvalResult {
  score: number;
  components: {
    territory: number;
    mobility: number;
    mobilityPotential: number;
    centerControl: number;
    cornerAvoidance: number;
    partitionAdvantage: number;
    criticalCells: number;
    openness: number;
  };
}

/**
 * Advanced evaluation function for NEXUS-5 and NEXUS-7
 */
export function evaluateAdvanced(
  board: BoardState,
  weights: {
    territory: number;
    mobility: number;
    mobilityPotential: number;
    centerControl: number;
    cornerAvoidance: number;
    partitionAdvantage: number;
    criticalCells: number;
    openness: number;
  }
): AdvancedEvalResult {
  const { playerPos, aiPos, destroyed, boardSize } = board;

  // Create blocked bitboard
  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  blocked |= CELL_MASKS[playerIdx];
  blocked |= CELL_MASKS[aiIdx];

  // 1. Territory analysis using Voronoi
  const voronoi = calculateBitboardVoronoi(playerPos, aiPos, destroyed);
  const territoryScore = (voronoi.aiCount - voronoi.playerCount) +
                         (voronoi.contestedCount * 0.4); // Contested cells favor AI (moves second)

  // 2. Immediate mobility
  const playerMoves = getValidMoves(board, playerPos, true);
  const aiMoves = getValidMoves(board, aiPos, false);
  const mobilityScore = aiMoves.length - playerMoves.length;

  // 3. Mobility potential (2-move lookahead)
  const mobilityPotentialScore = calculateMobilityPotential(board, blocked);

  // 4. Center control
  const aiCenterDist = CENTER_DISTANCE[aiIdx];
  const playerCenterDist = CENTER_DISTANCE[playerIdx];
  const centerScore = (playerCenterDist - aiCenterDist);

  // 5. Corner avoidance
  const aiCornerDist = CORNER_PROXIMITY[aiIdx];
  const playerCornerDist = CORNER_PROXIMITY[playerIdx];
  const cornerScore = (aiCornerDist - playerCornerDist);

  // 6. Partition analysis
  const partition = detectPartitionBitboard(playerPos, aiPos, destroyed);
  let partitionScore = 0;
  if (partition.isPartitioned) {
    partitionScore = (partition.aiRegionSize - partition.playerRegionSize) * 3;
  } else {
    // Check for near-partition situations
    const criticalCells = findCriticalCellsOptimized(board, blocked);
    if (criticalCells.length <= 3) {
      // Close to partition - evaluate potential
      partitionScore = evaluatePartitionThreat(board, blocked, criticalCells);
    }
  }

  // 7. Critical cells control
  const criticalScore = evaluateCriticalCellControl(board, blocked, voronoi);

  // 8. Openness (access to open areas)
  const opennessScore = evaluateOpenness(board, blocked);

  // Combine all components
  const components = {
    territory: territoryScore,
    mobility: mobilityScore,
    mobilityPotential: mobilityPotentialScore,
    centerControl: centerScore,
    cornerAvoidance: cornerScore,
    partitionAdvantage: partitionScore,
    criticalCells: criticalScore,
    openness: opennessScore
  };

  const score =
    components.territory * weights.territory +
    components.mobility * weights.mobility +
    components.mobilityPotential * weights.mobilityPotential +
    components.centerControl * weights.centerControl +
    components.cornerAvoidance * weights.cornerAvoidance +
    components.partitionAdvantage * weights.partitionAdvantage +
    components.criticalCells * weights.criticalCells +
    components.openness * weights.openness;

  return { score, components };
}

/**
 * Calculate mobility potential (cells reachable in 2 moves)
 */
function calculateMobilityPotential(board: BoardState, blocked: bigint): number {
  const { playerPos, aiPos } = board;

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  // Get cells reachable in 1 move
  const playerMoves1 = getQueenMoves(playerPos, blocked);
  const aiMoves1 = getQueenMoves(aiPos, blocked);

  // Get cells reachable in 2 moves (from each 1-move destination)
  let playerMoves2 = 0n;
  let aiMoves2 = 0n;

  // For player
  const player1Indices = bitboardToIndices(playerMoves1);
  for (const idx of player1Indices) {
    const pos = indexToPos(idx);
    const moves2 = getQueenMoves(pos, blocked | CELL_MASKS[playerIdx]);
    playerMoves2 |= moves2;
  }
  playerMoves2 &= ~playerMoves1; // Exclude cells already reachable in 1 move

  // For AI
  const ai1Indices = bitboardToIndices(aiMoves1);
  for (const idx of ai1Indices) {
    const pos = indexToPos(idx);
    const moves2 = getQueenMoves(pos, blocked | CELL_MASKS[aiIdx]);
    aiMoves2 |= moves2;
  }
  aiMoves2 &= ~aiMoves1;

  const playerPotential = popCount(playerMoves1) + popCount(playerMoves2) * 0.5;
  const aiPotential = popCount(aiMoves1) + popCount(aiMoves2) * 0.5;

  return aiPotential - playerPotential;
}

/**
 * Find cells that would cause partition if destroyed
 */
function findCriticalCellsOptimized(board: BoardState, blocked: bigint): number[] {
  const { playerPos, aiPos, destroyed } = board;
  const critical: number[] = [];

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  // Only check cells in the "path" between players
  const minR = Math.min(playerPos.r, aiPos.r);
  const maxR = Math.max(playerPos.r, aiPos.r);
  const minC = Math.min(playerPos.c, aiPos.c);
  const maxC = Math.max(playerPos.c, aiPos.c);

  // Expand the search area slightly
  const searchMinR = Math.max(0, minR - 1);
  const searchMaxR = Math.min(6, maxR + 1);
  const searchMinC = Math.max(0, minC - 1);
  const searchMaxC = Math.min(6, maxC + 1);

  for (let r = searchMinR; r <= searchMaxR; r++) {
    for (let c = searchMinC; c <= searchMaxC; c++) {
      const idx = posToIndex(r, c);

      // Skip blocked cells
      if ((blocked & CELL_MASKS[idx]) !== 0n) continue;

      // Check if destroying this would partition
      const tempDestroyed = [...destroyed, { r, c }];
      const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);

      if (result.isPartitioned) {
        critical.push(idx);
      }
    }
  }

  return critical;
}

/**
 * Evaluate the threat of partition
 */
function evaluatePartitionThreat(
  board: BoardState,
  blocked: bigint,
  criticalCells: number[]
): number {
  if (criticalCells.length === 0) return 0;

  const { playerPos, aiPos, destroyed } = board;
  let bestAdvantage = -Infinity;

  // Check which side would benefit from partition
  for (const idx of criticalCells) {
    const pos = indexToPos(idx);
    const tempDestroyed = [...destroyed, pos];
    const result = detectPartitionBitboard(playerPos, aiPos, tempDestroyed);

    if (result.isPartitioned) {
      const advantage = result.aiRegionSize - result.playerRegionSize;
      bestAdvantage = Math.max(bestAdvantage, advantage);
    }
  }

  // If AI can create advantageous partition, that's good
  // If player can, that's bad for AI
  return bestAdvantage * 0.5;
}

/**
 * Evaluate control of critical cells
 */
function evaluateCriticalCellControl(
  board: BoardState,
  blocked: bigint,
  voronoi: ReturnType<typeof calculateBitboardVoronoi>
): number {
  // Count how many critical cells are in AI's territory vs player's
  const { playerPos, aiPos, destroyed } = board;
  const critical = findCriticalCellsOptimized(board, blocked);

  if (critical.length === 0) return 0;

  let aiControl = 0;
  let playerControl = 0;

  for (const idx of critical) {
    if ((voronoi.aiTerritory & CELL_MASKS[idx]) !== 0n) {
      aiControl++;
    } else if ((voronoi.playerTerritory & CELL_MASKS[idx]) !== 0n) {
      playerControl++;
    }
  }

  return (aiControl - playerControl) * 2;
}

/**
 * Evaluate openness (preference for open areas)
 */
function evaluateOpenness(board: BoardState, blocked: bigint): number {
  const { playerPos, aiPos, boardSize } = board;

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  // Count open cells in each direction from each piece
  let playerOpenness = 0;
  let aiOpenness = 0;

  const directions = [
    { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
    { dr: 0, dc: -1 },                      { dr: 0, dc: 1 },
    { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 }
  ];

  // For player
  for (const dir of directions) {
    let r = playerPos.r + dir.dr;
    let c = playerPos.c + dir.dc;
    let openCount = 0;

    while (r >= 0 && r < 7 && c >= 0 && c < 7) {
      const idx = posToIndex(r, c);
      if ((blocked & CELL_MASKS[idx]) === 0n) {
        openCount++;
      } else {
        break;
      }
      r += dir.dr;
      c += dir.dc;
    }
    playerOpenness += openCount;
  }

  // For AI
  for (const dir of directions) {
    let r = aiPos.r + dir.dr;
    let c = aiPos.c + dir.dc;
    let openCount = 0;

    while (r >= 0 && r < 7 && c >= 0 && c < 7) {
      const idx = posToIndex(r, c);
      if ((blocked & CELL_MASKS[idx]) === 0n) {
        openCount++;
      } else {
        break;
      }
      r += dir.dr;
      c += dir.dc;
    }
    aiOpenness += openCount;
  }

  return (aiOpenness - playerOpenness) * 0.3;
}

/**
 * Evaluate opening principles (for early game)
 */
export function evaluateOpening(board: BoardState, turnCount: number): number {
  if (turnCount > 10) return 0; // Only for early game

  const { playerPos, aiPos } = board;
  const aiIdx = posToIndex(aiPos.r, aiPos.c);

  let score = 0;

  // 1. Center control is crucial in opening
  const centerDist = CENTER_DISTANCE[aiIdx];
  score -= centerDist * 2;

  // 2. Avoid corners in opening
  const cornerDist = CORNER_PROXIMITY[aiIdx];
  score += cornerDist;

  // 3. Stay connected to large open areas
  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  let blocked = CELL_MASKS[playerIdx] | CELL_MASKS[aiIdx];
  for (const d of board.destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  const aiReachable = queenFloodFill(aiPos, blocked);
  score += popCount(aiReachable) * 0.3;

  // 4. Maintain distance from opponent (early game tactical space)
  const dist = Math.abs(playerPos.r - aiPos.r) + Math.abs(playerPos.c - aiPos.c);
  if (dist < 3) {
    score -= (3 - dist) * 2; // Penalty for being too close
  } else if (dist > 5) {
    score += 1; // Slight bonus for maintaining distance
  }

  return score;
}

/**
 * Simplified evaluation for NEXUS-3
 * Uses basic concepts but applies them correctly
 */
export function evaluateBasic(board: BoardState): number {
  const { playerPos, aiPos, destroyed, boardSize } = board;

  let blocked = 0n;
  for (const d of destroyed) {
    blocked |= CELL_MASKS[posToIndex(d.r, d.c)];
  }

  const playerIdx = posToIndex(playerPos.r, playerPos.c);
  const aiIdx = posToIndex(aiPos.r, aiPos.c);
  blocked |= CELL_MASKS[playerIdx];
  blocked |= CELL_MASKS[aiIdx];

  // 1. Immediate mobility
  const playerMoves = popCount(getQueenMoves(playerPos, blocked));
  const aiMoves = popCount(getQueenMoves(aiPos, blocked));
  let score = (aiMoves - playerMoves) * 2;

  // 2. Reachable area
  const playerArea = popCount(queenFloodFill(playerPos, blocked));
  const aiArea = popCount(queenFloodFill(aiPos, blocked));
  score += (aiArea - playerArea) * 1.5;

  // 3. Center control
  score += (CENTER_DISTANCE[playerIdx] - CENTER_DISTANCE[aiIdx]) * 0.5;

  // 4. Corner penalty
  score += (CORNER_PROXIMITY[aiIdx] - CORNER_PROXIMITY[playerIdx]) * 0.3;

  // 5. Isolation penalty
  if (aiArea < 8) {
    score -= (8 - aiArea) * 3;
  }
  if (playerArea < 8) {
    score += (8 - playerArea) * 3;
  }

  return score;
}

/**
 * Terminal state evaluation
 */
export function evaluateTerminal(
  board: BoardState,
  depth: number,
  maxDepth: number
): number | null {
  const playerMoves = getValidMoves(board, board.playerPos, true);
  const aiMoves = getValidMoves(board, board.aiPos, false);

  if (playerMoves.length === 0 && aiMoves.length === 0) {
    // Both stuck - shouldn't happen normally
    return 0;
  }

  if (aiMoves.length === 0) {
    // AI loses - return large negative score
    return -10000 + (maxDepth - depth); // Prefer longer games if losing
  }

  if (playerMoves.length === 0) {
    // Player loses - return large positive score
    return 10000 - (maxDepth - depth); // Prefer shorter games if winning
  }

  return null; // Game not over
}
