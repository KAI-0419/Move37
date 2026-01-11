/**
 * Path Analysis for ENTROPY (Hex) Game
 * 
 * Analyzes player's connection paths and predicts their next moves.
 * This is critical for AI to block player's connection attempts.
 */

import type { BoardState, Move, Player, CellState } from "./types";
import { UnionFind } from "./unionFind";
import {
  isValidPosition,
  getCellState,
  getValidNeighbors,
  positionToIndex,
  indexToPosition,
  getHexDistance,
} from "./boardUtils";
import { getEmptyCells } from "./connectionCheck";
import type { PlayerMove } from "@shared/gameEngineInterface";

/**
 * Dijkstra-based shortest path analysis result
 */
interface ShortestPathResult {
  distance: number; // Minimum moves needed (Infinity if no path exists)
  path: Move[]; // Positions on the shortest path
  predecessors: Map<number, number>; // For path reconstruction
}

/**
 * Analysis result of player's connection path
 */
export interface PathAnalysis {
  // Groups of player pieces connected to left boundary
  leftGroups: Set<number>[];
  // Groups of player pieces connected to right boundary
  rightGroups: Set<number>[];
  // Critical positions that connect left and right groups
  criticalPositions: Move[];
  // Predicted next moves for player (sorted by importance)
  predictedMoves: Array<{ move: Move; score: number }>;
  // Threat level: how close player is to winning
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Shortest path analysis results
  shortestPathDistance: number; // Minimum moves needed to win (Infinity if impossible)
  shortestPathPositions: Move[]; // Positions on the shortest path (bottlenecks)
}

/**
 * Analyze player's connection path
 * 
 * @param board - Current board state
 * @returns Analysis of player's connection path
 */
export function analyzePlayerPath(board: BoardState): PathAnalysis {
  const { rows, cols } = board.boardSize;
  const totalCells = rows * cols;
  
  // Create Union-Find structure
  const uf = new UnionFind(totalCells + 2);
  const leftBoundary = totalCells;
  const rightBoundary = totalCells + 1;
  
  // Connect left boundary to all leftmost player cells
  const leftConnectedCells: number[] = [];
  for (let r = 0; r < rows; r++) {
    const pos = { r, c: 0 };
    const cellState = getCellState(board, pos);
    if (cellState === 'PLAYER') {
      const index = positionToIndex(pos, board.boardSize);
      uf.union(index, leftBoundary);
      leftConnectedCells.push(index);
    }
  }
  
  // Connect right boundary to all rightmost player cells
  const rightConnectedCells: number[] = [];
  for (let r = 0; r < rows; r++) {
    const pos = { r, c: cols - 1 };
    const cellState = getCellState(board, pos);
    if (cellState === 'PLAYER') {
      const index = positionToIndex(pos, board.boardSize);
      uf.union(index, rightBoundary);
      rightConnectedCells.push(index);
    }
  }
  
  // Connect all PLAYER cells to their neighbors
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { r, c };
      const cellState = getCellState(board, pos);
      
      if (cellState === 'PLAYER') {
        const index = positionToIndex(pos, board.boardSize);
        const neighbors = getValidNeighbors(pos, board.boardSize);
        
        for (const neighbor of neighbors) {
          const neighborState = getCellState(board, neighbor);
          if (neighborState === 'PLAYER') {
            const neighborIndex = positionToIndex(neighbor, board.boardSize);
            uf.union(index, neighborIndex);
          }
        }
      }
    }
  }
  
  // Find groups connected to left boundary
  const leftGroups: Set<number>[] = [];
  const leftGroupRoots = new Map<number, number>();
  
  for (const cellIndex of leftConnectedCells) {
    const root = uf.find(cellIndex);
    if (!leftGroupRoots.has(root)) {
      leftGroupRoots.set(root, leftGroups.length);
      leftGroups.push(new Set([cellIndex]));
    } else {
      const groupIndex = leftGroupRoots.get(root)!;
      leftGroups[groupIndex].add(cellIndex);
    }
  }
  
  // Find groups connected to right boundary
  const rightGroups: Set<number>[] = [];
  const rightGroupRoots = new Map<number, number>();
  
  for (const cellIndex of rightConnectedCells) {
    const root = uf.find(cellIndex);
    if (!rightGroupRoots.has(root)) {
      rightGroupRoots.set(root, rightGroups.length);
      rightGroups.push(new Set([cellIndex]));
    } else {
      const groupIndex = rightGroupRoots.get(root)!;
      rightGroups[groupIndex].add(cellIndex);
    }
  }
  
  // Find critical positions: empty cells that connect left and right groups
  const criticalPositions: Move[] = [];
  const emptyCells = getEmptyCells(board);
  
  for (const empty of emptyCells) {
    // Check if this position connects left and right groups
    const neighbors = getValidNeighbors(empty, board.boardSize);
    let hasLeftNeighbor = false;
    let hasRightNeighbor = false;
    
    for (const neighbor of neighbors) {
      const neighborState = getCellState(board, neighbor);
      if (neighborState === 'PLAYER') {
        const neighborIndex = positionToIndex(neighbor, board.boardSize);
        const root = uf.find(neighborIndex);
        
        // Check if connected to left boundary
        if (uf.connected(root, leftBoundary)) {
          hasLeftNeighbor = true;
        }
        // Check if connected to right boundary
        if (uf.connected(root, rightBoundary)) {
          hasRightNeighbor = true;
        }
      }
    }
    
    // If this position connects left and right groups, it's critical
    if (hasLeftNeighbor && hasRightNeighbor) {
      criticalPositions.push(empty);
    }
  }
  
  // Calculate shortest path using Dijkstra FIRST
  const shortestPathResult = calculateShortestPath(board, 'PLAYER');
  
  // Update critical positions based on shortest path
  const pathBasedCriticalPositions = [...criticalPositions];
  // Add positions on shortest path that are bottlenecks
  for (const pos of shortestPathResult.path) {
    const isDuplicate = pathBasedCriticalPositions.some(
      cp => cp.r === pos.r && cp.c === pos.c
    );
    if (!isDuplicate) {
      pathBasedCriticalPositions.push(pos);
    }
  }
  
  // Predict player's next moves (now with shortest path information)
  const predictedMoves = predictPlayerNextMoves(board, uf, leftBoundary, rightBoundary, shortestPathResult);
  
  // Calculate threat level (now using shortest path distance)
  const threatLevel = calculateThreatLevel(
    board,
    leftGroups,
    rightGroups,
    pathBasedCriticalPositions,
    uf,
    leftBoundary,
    rightBoundary,
    shortestPathResult.distance
  );
  
  return {
    leftGroups,
    rightGroups,
    criticalPositions: pathBasedCriticalPositions,
    predictedMoves,
    threatLevel,
    shortestPathDistance: shortestPathResult.distance,
    shortestPathPositions: shortestPathResult.path,
  };
}

/**
 * Predict player's next moves based on path analysis and shortest path
 */
function predictPlayerNextMoves(
  board: BoardState,
  uf: UnionFind,
  leftBoundary: number,
  rightBoundary: number,
  shortestPathResult: ShortestPathResult
): Array<{ move: Move; score: number }> {
  const emptyCells = getEmptyCells(board);
  const predictions: Array<{ move: Move; score: number }> = [];
  const { rows, cols } = board.boardSize;
  
  // Create set of positions on shortest path for quick lookup
  const shortestPathSet = new Set<string>();
  for (const pos of shortestPathResult.path) {
    shortestPathSet.add(`${pos.r},${pos.c}`);
  }
  
  for (const empty of emptyCells) {
    let score = 0;
    const emptyKey = `${empty.r},${empty.c}`;
    const neighbors = getValidNeighbors(empty, board.boardSize);
    
    // HIGHEST PRIORITY: Position is on the shortest path
    if (shortestPathSet.has(emptyKey)) {
      score += 150; // Very high priority - this is on the winning path
    }
    
    // Count how many player neighbors this position has
    let playerNeighborCount = 0;
    let leftConnectedNeighbors = 0;
    let rightConnectedNeighbors = 0;
    
    for (const neighbor of neighbors) {
      const neighborState = getCellState(board, neighbor);
      if (neighborState === 'PLAYER') {
        playerNeighborCount++;
        const neighborIndex = positionToIndex(neighbor, board.boardSize);
        const root = uf.find(neighborIndex);
        
        if (uf.connected(root, leftBoundary)) {
          leftConnectedNeighbors++;
        }
        if (uf.connected(root, rightBoundary)) {
          rightConnectedNeighbors++;
        }
      }
    }
    
    // High score if connects left and right groups
    if (leftConnectedNeighbors > 0 && rightConnectedNeighbors > 0) {
      score += 100; // Critical connection point
    }
    
    // Score based on proximity to player pieces
    if (playerNeighborCount > 0) {
      score += playerNeighborCount * 10;
    }
    
    // Prefer positions closer to center (strategic value in Hex)
    const centerR = Math.floor(rows / 2);
    const centerC = Math.floor(cols / 2);
    const centerDistance = Math.abs(empty.r - centerR) + Math.abs(empty.c - centerC);
    score += Math.max(0, 10 - centerDistance);
    
    // Prefer positions that extend existing groups
    if (leftConnectedNeighbors > 0) {
      score += 15; // Extends left-connected group
    }
    if (rightConnectedNeighbors > 0) {
      score += 15; // Extends right-connected group
    }
    
    // Prefer positions in the middle columns (connection path)
    const colDistanceFromCenter = Math.abs(empty.c - Math.floor(cols / 2));
    score += Math.max(0, 5 - colDistanceFromCenter);
    
    // Bonus: if this position is adjacent to shortest path positions
    for (const pathPos of shortestPathResult.path) {
      const distance = getHexDistance(empty, pathPos);
      if (distance === 1) {
        score += 20; // Adjacent to shortest path - good extension
        break;
      }
    }
    
    if (score > 0) {
      predictions.push({ move: empty, score });
    }
  }
  
  // Sort by score (highest first)
  predictions.sort((a, b) => b.score - a.score);
  
  return predictions;
}

/**
 * Calculate shortest path using Dijkstra algorithm
 * 
 * For PLAYER: finds shortest path from any left boundary cell to any right boundary cell
 * For AI: finds shortest path from any top boundary cell to any bottom boundary cell
 * 
 * Weight scheme:
 * - Own pieces: 0 (already connected)
 * - Empty cells: 1 (one move needed)
 * - Opponent pieces: Infinity (cannot pass through)
 */
export function calculateShortestPath(
  board: BoardState,
  player: Player
): ShortestPathResult {
  const { rows, cols } = board.boardSize;
  const totalCells = rows * cols;
  
  // Initialize distances: Infinity for all cells
  const distances = new Map<number, number>();
  const predecessors = new Map<number, number>();
  const visited = new Set<number>();
  
  // Priority queue: [distance, cellIndex]
  const queue: Array<[number, number]> = [];
  
  // Initialize starting points based on player
  if (player === 'PLAYER') {
    // PLAYER: start from all left boundary cells (c = 0)
    for (let r = 0; r < rows; r++) {
      const pos = { r, c: 0 };
      const cellState = getCellState(board, pos);
      const index = positionToIndex(pos, board.boardSize);
      
      if (cellState === 'PLAYER') {
        // Already has a piece: distance 0
        distances.set(index, 0);
        queue.push([0, index]);
      } else if (cellState === 'EMPTY') {
        // Empty cell: distance 1
        distances.set(index, 1);
        queue.push([1, index]);
      }
      // AI piece: cannot start from here (distance remains Infinity)
    }
  } else {
    // AI: start from all top boundary cells (r = 0)
    for (let c = 0; c < cols; c++) {
      const pos = { r: 0, c };
      const cellState = getCellState(board, pos);
      const index = positionToIndex(pos, board.boardSize);
      
      if (cellState === 'AI') {
        distances.set(index, 0);
        queue.push([0, index]);
      } else if (cellState === 'EMPTY') {
        distances.set(index, 1);
        queue.push([1, index]);
      }
    }
  }
  
  // Sort queue by distance (min-heap simulation)
  queue.sort((a, b) => a[0] - b[0]);
  
  let minDistanceToGoal = Infinity;
  let goalCell: number | null = null;
  
  // Dijkstra main loop
  while (queue.length > 0) {
    // Extract minimum distance cell
    const [currentDist, currentIndex] = queue.shift()!;
    
    if (visited.has(currentIndex)) {
      continue;
    }
    
    visited.add(currentIndex);
    const currentPos = indexToPosition(currentIndex, board.boardSize);
    
    // Check if we reached the goal
    if (player === 'PLAYER') {
      // Goal: right boundary (c = cols - 1)
      if (currentPos.c === cols - 1) {
        if (currentDist < minDistanceToGoal) {
          minDistanceToGoal = currentDist;
          goalCell = currentIndex;
        }
        // Continue to find all paths, but track minimum
      }
    } else {
      // Goal: bottom boundary (r = rows - 1)
      if (currentPos.r === rows - 1) {
        if (currentDist < minDistanceToGoal) {
          minDistanceToGoal = currentDist;
          goalCell = currentIndex;
        }
      }
    }
    
    // Explore neighbors
    const neighbors = getValidNeighbors(currentPos, board.boardSize);
    for (const neighbor of neighbors) {
      const neighborIndex = positionToIndex(neighbor, board.boardSize);
      
      if (visited.has(neighborIndex)) {
        continue;
      }
      
      const neighborState = getCellState(board, neighbor);
      let edgeWeight: number;
      
      if (neighborState === player) {
        // Own piece: weight 0 (already connected)
        edgeWeight = 0;
      } else if (neighborState === 'EMPTY') {
        // Empty cell: weight 1 (one move needed)
        edgeWeight = 1;
      } else {
        // Opponent piece: weight Infinity (cannot pass)
        continue;
      }
      
      const newDist = currentDist + edgeWeight;
      const oldDist = distances.get(neighborIndex) ?? Infinity;
      
      if (newDist < oldDist) {
        distances.set(neighborIndex, newDist);
        predecessors.set(neighborIndex, currentIndex);
        
        // Add to queue
        queue.push([newDist, neighborIndex]);
        queue.sort((a, b) => a[0] - b[0]);
      }
    }
  }
  
  // Reconstruct path from goal to start
  const path: Move[] = [];
  if (goalCell !== null && minDistanceToGoal < Infinity) {
    let current: number | undefined = goalCell;
    const pathSet = new Set<number>();
    
    while (current !== undefined) {
      pathSet.add(current);
      const pos = indexToPosition(current, board.boardSize);
      
      // Only add empty cells to path (bottlenecks)
      const cellState = getCellState(board, pos);
      if (cellState === 'EMPTY') {
        path.push(pos);
      }
      
      current = predecessors.get(current);
    }
  }
  
  return {
    distance: minDistanceToGoal,
    path,
    predecessors,
  };
}

/**
 * Calculate threat level based on path analysis and shortest path distance
 */
function calculateThreatLevel(
  board: BoardState,
  leftGroups: Set<number>[],
  rightGroups: Set<number>[],
  criticalPositions: Move[],
  uf: UnionFind,
  leftBoundary: number,
  rightBoundary: number,
  shortestPathDistance: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const { rows, cols } = board.boardSize;
  
  // If player has already won, it's critical
  if (uf.connected(leftBoundary, rightBoundary)) {
    return 'CRITICAL';
  }
  
  // PRIMARY: Use shortest path distance to determine threat
  // This catches threats even when player hasn't reached boundaries yet
  if (shortestPathDistance <= 1) {
    return 'CRITICAL'; // Player can win in 1 move
  }
  if (shortestPathDistance <= 2) {
    return 'CRITICAL'; // Player can win in 2 moves (very dangerous)
  }
  if (shortestPathDistance <= 3) {
    return 'HIGH'; // Player can win in 3 moves
  }
  if (shortestPathDistance <= 5) {
    return 'HIGH'; // Player can win in 5 moves
  }
  if (shortestPathDistance <= 7) {
    return 'MEDIUM'; // Player can win in 7 moves
  }
  
  // FALLBACK: Use traditional analysis if shortest path is not available
  // Count critical positions (positions that would connect left and right)
  if (criticalPositions.length >= 2) {
    return 'CRITICAL'; // Multiple winning paths
  }
  if (criticalPositions.length === 1) {
    return 'HIGH'; // One winning path exists
  }
  
  // Check if player has strong groups on both sides
  if (leftGroups.length > 0 && rightGroups.length > 0) {
    // Check how close the groups are
    let minDistance = Infinity;
    
    for (const leftGroup of leftGroups) {
      for (const rightGroup of rightGroups) {
        // Find minimum distance between groups
        for (const leftCell of leftGroup) {
          for (const rightCell of rightGroup) {
            const leftPos = indexToPosition(leftCell, board.boardSize);
            const rightPos = indexToPosition(rightCell, board.boardSize);
            
            // Calculate hex distance
            const distance = getHexDistance(leftPos, rightPos);
            minDistance = Math.min(minDistance, distance);
          }
        }
      }
    }
    
    if (minDistance <= 2) {
      return 'HIGH'; // Groups are very close
    }
    if (minDistance <= 4) {
      return 'MEDIUM'; // Groups are moderately close
    }
  }
  
  // Check if player has pieces on both boundaries
  const hasLeftPieces = leftGroups.length > 0;
  const hasRightPieces = rightGroups.length > 0;
  
  if (hasLeftPieces && hasRightPieces) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

/**
 * Calculate hexagonal distance between two positions
 */
function getHexDistance(
  pos1: { r: number; c: number },
  pos2: { r: number; c: number }
): number {
  const dr = pos2.r - pos1.r;
  const dc = pos2.c - pos1.c;
  
  // Convert offset coordinates to cube coordinates
  const x1 = pos1.c - (pos1.r - (pos1.r & 1)) / 2;
  const z1 = pos1.r;
  const y1 = -x1 - z1;
  
  const x2 = pos2.c - (pos2.r - (pos2.r & 1)) / 2;
  const z2 = pos2.r;
  const y2 = -x2 - z2;
  
  // Cube distance
  return (Math.abs(x2 - x1) + Math.abs(y2 - y1) + Math.abs(z2 - z1)) / 2;
}

/**
 * Find critical positions that block player's connection
 * 
 * @param board - Current board state
 * @returns Array of critical positions to block
 */
export function findCriticalPositions(board: BoardState): Move[] {
  const analysis = analyzePlayerPath(board);
  return analysis.criticalPositions;
}

/**
 * Predict player's next move based on their last move and path analysis
 * 
 * @param board - Current board state
 * @param playerLastMove - Player's last move (optional)
 * @returns Array of predicted moves sorted by likelihood
 */
export function predictPlayerNextMove(
  board: BoardState,
  playerLastMove: PlayerMove | null
): Move[] {
  const analysis = analyzePlayerPath(board);
  
  // If we have critical positions, those are most likely
  if (analysis.criticalPositions.length > 0) {
    return analysis.criticalPositions;
  }
  
  // Otherwise, return top predicted moves
  return analysis.predictedMoves.slice(0, 5).map(p => p.move);
}
