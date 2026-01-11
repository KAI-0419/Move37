/**
 * Connection Check for ENTROPY (Hex) Game
 * 
 * Uses Union-Find data structure to efficiently check if a player
 * has connected their two sides of the board.
 * - PLAYER: Left to Right connection
 * - AI: Top to Bottom connection
 */

import type { BoardState, Player, CellState } from "./types";
import { UnionFind } from "./unionFind";
import {
  isValidPosition,
  getCellState,
  getValidNeighbors,
  positionToIndex,
} from "./boardUtils";

/**
 * Check if a player has connected their two sides
 * 
 * @param board - Current board state
 * @param player - Player to check ('PLAYER' or 'AI')
 * @returns True if the player has connected their sides
 */
export function isConnected(board: BoardState, player: Player): boolean {
  const { rows, cols } = board.boardSize;
  const totalCells = rows * cols;
  
  // Create Union-Find structure with virtual boundary nodes
  // Virtual nodes: 
  // - For PLAYER: leftBoundary = totalCells, rightBoundary = totalCells + 1
  // - For AI: topBoundary = totalCells, bottomBoundary = totalCells + 1
  const uf = new UnionFind(totalCells + 2);
  
  const leftBoundary = totalCells;
  const rightBoundary = totalCells + 1;
  const topBoundary = totalCells;
  const bottomBoundary = totalCells + 1;

  if (player === 'PLAYER') {
    // Connect left boundary to all leftmost cells
    for (let r = 0; r < rows; r++) {
      const pos = { r, c: 0 };
      const cellState = getCellState(board, pos);
      if (cellState === 'PLAYER') {
        const index = positionToIndex(pos, board.boardSize);
        uf.union(index, leftBoundary);
      }
    }

    // Connect right boundary to all rightmost cells
    for (let r = 0; r < rows; r++) {
      const pos = { r, c: cols - 1 };
      const cellState = getCellState(board, pos);
      if (cellState === 'PLAYER') {
        const index = positionToIndex(pos, board.boardSize);
        uf.union(index, rightBoundary);
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

    // Check if left and right boundaries are connected
    return uf.connected(leftBoundary, rightBoundary);
  } else {
    // AI: Top to Bottom connection
    // Connect top boundary to all topmost cells
    for (let c = 0; c < cols; c++) {
      const pos = { r: 0, c };
      const cellState = getCellState(board, pos);
      if (cellState === 'AI') {
        const index = positionToIndex(pos, board.boardSize);
        uf.union(index, topBoundary);
      }
    }

    // Connect bottom boundary to all bottommost cells
    for (let c = 0; c < cols; c++) {
      const pos = { r: rows - 1, c };
      const cellState = getCellState(board, pos);
      if (cellState === 'AI') {
        const index = positionToIndex(pos, board.boardSize);
        uf.union(index, bottomBoundary);
      }
    }

    // Connect all AI cells to their neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pos = { r, c };
        const cellState = getCellState(board, pos);
        
        if (cellState === 'AI') {
          const index = positionToIndex(pos, board.boardSize);
          const neighbors = getValidNeighbors(pos, board.boardSize);
          
          for (const neighbor of neighbors) {
            const neighborState = getCellState(board, neighbor);
            if (neighborState === 'AI') {
              const neighborIndex = positionToIndex(neighbor, board.boardSize);
              uf.union(index, neighborIndex);
            }
          }
        }
      }
    }

    // Check if top and bottom boundaries are connected
    return uf.connected(topBoundary, bottomBoundary);
  }
}

/**
 * Check if a move would create a winning connection
 * 
 * @param board - Current board state
 * @param move - Move to check
 * @param player - Player making the move
 * @returns True if the move would create a winning connection
 */
export function wouldWin(
  board: BoardState,
  move: { r: number; c: number },
  player: Player
): boolean {
  // Create a temporary board with the move applied
  const tempBoard = {
    ...board,
    cells: board.cells.map(row => [...row]),
  };
  
  const cellState: CellState = player === 'PLAYER' ? 'PLAYER' : 'AI';
  tempBoard.cells[move.r][move.c] = cellState;
  
  return isConnected(tempBoard, player);
}

/**
 * Get all empty cells on the board
 */
export function getEmptyCells(board: BoardState): { r: number; c: number }[] {
  const empty: { r: number; c: number }[] = [];
  const { rows, cols } = board.boardSize;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board.cells[r][c] === 'EMPTY') {
        empty.push({ r, c });
      }
    }
  }
  
  return empty;
}
