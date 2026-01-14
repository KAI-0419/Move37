/**
 * Virtual Connections Detection for ENTROPY (Hex) Game
 *
 * Virtual connections are patterns where two cells are guaranteed to connect
 * even if the opponent plays one of the connecting cells.
 *
 * Key patterns:
 * 1. Bridge: Two cells with exactly 2 common empty neighbors (most common)
 * 2. Edge Template: Guaranteed connection to edge
 * 3. Ladder: Forcing sequence that guarantees connection
 *
 * This module significantly improves AI strength by recognizing
 * that certain groups are "virtually connected" without needing to fill all cells.
 */

import type { BoardState, Move, Player, CellState } from "./types";
import {
  isValidPosition,
  getCellState,
  getValidNeighbors,
  positionToIndex,
  indexToPosition,
} from "./boardUtils";
import { UnionFind } from "./unionFind";

/**
 * Virtual connection between two positions
 */
interface VirtualConnection {
  pos1: Move;
  pos2: Move;
  type: 'BRIDGE' | 'EDGE_TEMPLATE' | 'LADDER';
  carrier: Move[]; // Cells that form the virtual connection
  strength: number; // 1 = weakest (opponent can break with 1 move), higher = stronger
}

/**
 * Extended Union-Find that considers virtual connections
 */
export class VirtualUnionFind {
  private uf: UnionFind;
  private virtualConnections: VirtualConnection[];
  private boardSize: { rows: number; cols: number };

  constructor(boardSize: { rows: number; cols: number }) {
    const totalCells = boardSize.rows * boardSize.cols;
    this.uf = new UnionFind(totalCells + 4); // +4 for virtual boundaries
    this.virtualConnections = [];
    this.boardSize = boardSize;
  }

  /**
   * Get index for virtual boundaries
   */
  get leftBoundary(): number {
    return this.boardSize.rows * this.boardSize.cols;
  }

  get rightBoundary(): number {
    return this.boardSize.rows * this.boardSize.cols + 1;
  }

  get topBoundary(): number {
    return this.boardSize.rows * this.boardSize.cols + 2;
  }

  get bottomBoundary(): number {
    return this.boardSize.rows * this.boardSize.cols + 3;
  }

  /**
   * Union two positions
   */
  union(pos1: Move, pos2: Move): void {
    const idx1 = positionToIndex(pos1, this.boardSize);
    const idx2 = positionToIndex(pos2, this.boardSize);
    this.uf.union(idx1, idx2);
  }

  /**
   * Union position with boundary
   */
  unionWithBoundary(pos: Move, boundary: number): void {
    const idx = positionToIndex(pos, this.boardSize);
    this.uf.union(idx, boundary);
  }

  /**
   * Check if two positions are connected (directly or virtually)
   */
  connected(pos1: Move, pos2: Move): boolean {
    const idx1 = positionToIndex(pos1, this.boardSize);
    const idx2 = positionToIndex(pos2, this.boardSize);
    return this.uf.connected(idx1, idx2);
  }

  /**
   * Check if position is connected to boundary
   */
  connectedToBoundary(pos: Move, boundary: number): boolean {
    const idx = positionToIndex(pos, this.boardSize);
    return this.uf.connected(idx, boundary);
  }

  /**
   * Add virtual connection (applies union)
   */
  addVirtualConnection(vc: VirtualConnection): void {
    this.virtualConnections.push(vc);
    this.union(vc.pos1, vc.pos2);
  }

  /**
   * Get all virtual connections
   */
  getVirtualConnections(): VirtualConnection[] {
    return this.virtualConnections;
  }
}

/**
 * Hex directions for neighbor calculation
 * Using offset coordinates (odd-r offset)
 */
const HEX_DIRECTIONS_EVEN_ROW = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 },
  { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  { dr: 1, dc: -1 }, { dr: 1, dc: 0 },
];

const HEX_DIRECTIONS_ODD_ROW = [
  { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
  { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
];

/**
 * Get common neighbors of two positions
 */
function getCommonNeighbors(
  pos1: Move,
  pos2: Move,
  boardSize: { rows: number; cols: number }
): Move[] {
  const neighbors1 = new Set(
    getValidNeighbors(pos1, boardSize).map(n => `${n.r},${n.c}`)
  );
  const neighbors2 = getValidNeighbors(pos2, boardSize);

  return neighbors2.filter(n => neighbors1.has(`${n.r},${n.c}`));
}

/**
 * Check if two positions form a bridge (virtual connection)
 *
 * A bridge exists when:
 * 1. Both positions are occupied by the same player
 * 2. They share exactly 2 common empty neighbors
 * 3. These two neighbors can connect the positions
 */
function detectBridge(
  board: BoardState,
  pos1: Move,
  pos2: Move,
  player: Player
): VirtualConnection | null {
  // Check if both positions have player's pieces
  if (getCellState(board, pos1) !== player || getCellState(board, pos2) !== player) {
    return null;
  }

  // Get common neighbors
  const commonNeighbors = getCommonNeighbors(pos1, pos2, board.boardSize);

  // Filter to only empty common neighbors
  const emptyCommonNeighbors = commonNeighbors.filter(
    n => getCellState(board, n) === 'EMPTY'
  );

  // Bridge requires exactly 2 empty common neighbors
  if (emptyCommonNeighbors.length !== 2) {
    return null;
  }

  // This is a bridge! The two empty cells form a virtual connection
  return {
    pos1,
    pos2,
    type: 'BRIDGE',
    carrier: emptyCommonNeighbors,
    strength: 2, // Strong - opponent needs to play in specific cells to break
  };
}

/**
 * Detect all bridges for a player
 */
export function detectAllBridges(
  board: BoardState,
  player: Player
): VirtualConnection[] {
  const bridges: VirtualConnection[] = [];
  const { rows, cols } = board.boardSize;

  // Track checked pairs to avoid duplicates
  const checkedPairs = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { r, c };
      if (getCellState(board, pos) !== player) continue;

      // Check all neighbors of neighbors (bridge distance)
      const neighbors = getValidNeighbors(pos, board.boardSize);
      for (const neighbor of neighbors) {
        const neighborNeighbors = getValidNeighbors(neighbor, board.boardSize);
        for (const nn of neighborNeighbors) {
          if (nn.r === pos.r && nn.c === pos.c) continue; // Skip self

          // Create unique pair key
          const pairKey =
            pos.r < nn.r || (pos.r === nn.r && pos.c < nn.c)
              ? `${pos.r},${pos.c}-${nn.r},${nn.c}`
              : `${nn.r},${nn.c}-${pos.r},${pos.c}`;

          if (checkedPairs.has(pairKey)) continue;
          checkedPairs.add(pairKey);

          const bridge = detectBridge(board, pos, nn, player);
          if (bridge) {
            bridges.push(bridge);
          }
        }
      }
    }
  }

  return bridges;
}

/**
 * Check if a position is on the edge and could form an edge template
 *
 * Edge templates are patterns that guarantee connection to the edge
 */
function detectEdgeTemplate(
  board: BoardState,
  pos: Move,
  player: Player
): VirtualConnection | null {
  if (getCellState(board, pos) !== player) return null;

  const { rows, cols } = board.boardSize;

  // For AI (top-bottom connection)
  if (player === 'AI') {
    // Check top edge template (row 1, one step from edge)
    if (pos.r === 1) {
      const topCell = { r: 0, c: pos.c };
      if (getCellState(board, topCell) === 'EMPTY') {
        // Check if there's a bridge-like pattern to edge
        const leftTop = { r: 0, c: pos.c - 1 };
        const rightTop = { r: 0, c: pos.c + 1 };

        let carrierCells: Move[] = [];
        if (isValidPosition(leftTop, board.boardSize) &&
            getCellState(board, leftTop) === 'EMPTY') {
          carrierCells.push(leftTop);
        }
        if (isValidPosition(rightTop, board.boardSize) &&
            getCellState(board, rightTop) === 'EMPTY') {
          carrierCells.push(rightTop);
        }
        carrierCells.push(topCell);

        if (carrierCells.length >= 2) {
          return {
            pos1: pos,
            pos2: { r: -1, c: pos.c }, // Virtual top boundary marker
            type: 'EDGE_TEMPLATE',
            carrier: carrierCells,
            strength: carrierCells.length,
          };
        }
      }
    }

    // Check bottom edge template (row rows-2)
    if (pos.r === rows - 2) {
      const bottomCell = { r: rows - 1, c: pos.c };
      if (getCellState(board, bottomCell) === 'EMPTY') {
        const leftBottom = { r: rows - 1, c: pos.c - 1 };
        const rightBottom = { r: rows - 1, c: pos.c + 1 };

        let carrierCells: Move[] = [];
        if (isValidPosition(leftBottom, board.boardSize) &&
            getCellState(board, leftBottom) === 'EMPTY') {
          carrierCells.push(leftBottom);
        }
        if (isValidPosition(rightBottom, board.boardSize) &&
            getCellState(board, rightBottom) === 'EMPTY') {
          carrierCells.push(rightBottom);
        }
        carrierCells.push(bottomCell);

        if (carrierCells.length >= 2) {
          return {
            pos1: pos,
            pos2: { r: rows, c: pos.c }, // Virtual bottom boundary marker
            type: 'EDGE_TEMPLATE',
            carrier: carrierCells,
            strength: carrierCells.length,
          };
        }
      }
    }
  }

  // For PLAYER (left-right connection)
  if (player === 'PLAYER') {
    // Check left edge template (column 1)
    if (pos.c === 1) {
      const leftCell = { r: pos.r, c: 0 };
      if (getCellState(board, leftCell) === 'EMPTY') {
        const topLeft = { r: pos.r - 1, c: 0 };
        const bottomLeft = { r: pos.r + 1, c: 0 };

        let carrierCells: Move[] = [];
        if (isValidPosition(topLeft, board.boardSize) &&
            getCellState(board, topLeft) === 'EMPTY') {
          carrierCells.push(topLeft);
        }
        if (isValidPosition(bottomLeft, board.boardSize) &&
            getCellState(board, bottomLeft) === 'EMPTY') {
          carrierCells.push(bottomLeft);
        }
        carrierCells.push(leftCell);

        if (carrierCells.length >= 2) {
          return {
            pos1: pos,
            pos2: { r: pos.r, c: -1 }, // Virtual left boundary marker
            type: 'EDGE_TEMPLATE',
            carrier: carrierCells,
            strength: carrierCells.length,
          };
        }
      }
    }

    // Check right edge template
    if (pos.c === cols - 2) {
      const rightCell = { r: pos.r, c: cols - 1 };
      if (getCellState(board, rightCell) === 'EMPTY') {
        const topRight = { r: pos.r - 1, c: cols - 1 };
        const bottomRight = { r: pos.r + 1, c: cols - 1 };

        let carrierCells: Move[] = [];
        if (isValidPosition(topRight, board.boardSize) &&
            getCellState(board, topRight) === 'EMPTY') {
          carrierCells.push(topRight);
        }
        if (isValidPosition(bottomRight, board.boardSize) &&
            getCellState(board, bottomRight) === 'EMPTY') {
          carrierCells.push(bottomRight);
        }
        carrierCells.push(rightCell);

        if (carrierCells.length >= 2) {
          return {
            pos1: pos,
            pos2: { r: pos.r, c: cols }, // Virtual right boundary marker
            type: 'EDGE_TEMPLATE',
            carrier: carrierCells,
            strength: carrierCells.length,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Analyze virtual connections for a player
 * Returns a VirtualUnionFind that includes both direct and virtual connections
 */
export function analyzeVirtualConnections(
  board: BoardState,
  player: Player
): VirtualUnionFind {
  const { rows, cols } = board.boardSize;
  const vuf = new VirtualUnionFind(board.boardSize);

  // First, connect all directly adjacent pieces
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { r, c };
      if (getCellState(board, pos) !== player) continue;

      // Connect to boundaries
      if (player === 'PLAYER') {
        if (c === 0) vuf.unionWithBoundary(pos, vuf.leftBoundary);
        if (c === cols - 1) vuf.unionWithBoundary(pos, vuf.rightBoundary);
      } else {
        if (r === 0) vuf.unionWithBoundary(pos, vuf.topBoundary);
        if (r === rows - 1) vuf.unionWithBoundary(pos, vuf.bottomBoundary);
      }

      // Connect to adjacent pieces
      const neighbors = getValidNeighbors(pos, board.boardSize);
      for (const neighbor of neighbors) {
        if (getCellState(board, neighbor) === player) {
          vuf.union(pos, neighbor);
        }
      }
    }
  }

  // Detect and add bridges (virtual connections)
  const bridges = detectAllBridges(board, player);
  for (const bridge of bridges) {
    vuf.addVirtualConnection(bridge);
  }

  // Detect and add edge templates
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pos = { r, c };
      const edgeTemplate = detectEdgeTemplate(board, pos, player);
      if (edgeTemplate) {
        vuf.addVirtualConnection(edgeTemplate);
        // Connect to appropriate boundary
        if (player === 'AI') {
          if (edgeTemplate.pos2.r < 0) {
            vuf.unionWithBoundary(pos, vuf.topBoundary);
          } else if (edgeTemplate.pos2.r >= rows) {
            vuf.unionWithBoundary(pos, vuf.bottomBoundary);
          }
        } else {
          if (edgeTemplate.pos2.c < 0) {
            vuf.unionWithBoundary(pos, vuf.leftBoundary);
          } else if (edgeTemplate.pos2.c >= cols) {
            vuf.unionWithBoundary(pos, vuf.rightBoundary);
          }
        }
      }
    }
  }

  return vuf;
}

/**
 * Check if a player has won considering virtual connections
 */
export function hasVirtualWin(board: BoardState, player: Player): boolean {
  const vuf = analyzeVirtualConnections(board, player);
  const { rows, cols } = board.boardSize;

  // Check if we can find a path from one boundary to another
  // including virtual connections
  if (player === 'PLAYER') {
    // Check if any left-connected piece is virtually connected to right
    for (let r = 0; r < rows; r++) {
      const leftPos = { r, c: 0 };
      const rightPos = { r, c: cols - 1 };
      if (getCellState(board, leftPos) === 'PLAYER' &&
          vuf.connectedToBoundary(leftPos, vuf.rightBoundary)) {
        return true;
      }
    }
  } else {
    // Check if any top-connected piece is virtually connected to bottom
    for (let c = 0; c < cols; c++) {
      const topPos = { r: 0, c };
      if (getCellState(board, topPos) === 'AI' &&
          vuf.connectedToBoundary(topPos, vuf.bottomBoundary)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get cells that are part of virtual connections (carrier cells)
 * These are important blocking positions for the opponent
 */
export function getVirtualConnectionCarriers(
  board: BoardState,
  player: Player
): Move[] {
  const vuf = analyzeVirtualConnections(board, player);
  const connections = vuf.getVirtualConnections();

  const carriers: Move[] = [];
  const seen = new Set<string>();

  for (const vc of connections) {
    for (const carrier of vc.carrier) {
      const key = `${carrier.r},${carrier.c}`;
      if (!seen.has(key) && getCellState(board, carrier) === 'EMPTY') {
        seen.add(key);
        carriers.push(carrier);
      }
    }
  }

  return carriers;
}

/**
 * Calculate virtual shortest path distance
 * This considers virtual connections as having distance 0
 */
export function calculateVirtualShortestPath(
  board: BoardState,
  player: Player
): number {
  const { rows, cols } = board.boardSize;
  const vuf = analyzeVirtualConnections(board, player);

  // Simple heuristic: count minimum virtual groups needed to span
  // This is a simplified version - full implementation would use
  // shortest path with virtual connection edges having weight 0

  let minDistance = Infinity;

  // Use BFS considering virtual connections
  // For now, return a modified shortest path estimate
  // that reduces distance when virtual connections exist

  const connections = vuf.getVirtualConnections();
  const bridgeBonus = Math.min(connections.length * 0.5, 3);

  // Get actual shortest path
  // (This would integrate with pathAnalysis.ts)

  return Math.max(0, minDistance - bridgeBonus);
}
