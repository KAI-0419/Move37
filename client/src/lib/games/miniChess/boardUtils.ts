/**
 * Mini Chess Board Utilities
 * 
 * Functions for parsing, generating, and manipulating the chess board.
 */

import type { Board, Piece } from "./types";

export function parseFen(fen: string): Board {
  const rows = fen.split('/');
  const board: Board = [];
  for (const rowStr of rows) {
    const row: Piece[] = [];
    for (const char of rowStr) {
      if (char >= '1' && char <= '5') {
        const empties = parseInt(char);
        for (let i = 0; i < empties; i++) row.push(null);
      } else {
        row.push(char as Piece);
      }
    }
    board.push(row);
  }
  return board;
}

export function generateFen(board: Board): string {
  return board.map(row => {
    let fenRow = '';
    let emptyCount = 0;
    for (const cell of row) {
      if (cell === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += cell;
      }
    }
    if (emptyCount > 0) fenRow += emptyCount;
    return fenRow;
  }).join('/');
}

export function makeMove(board: Board, from: { r: number; c: number }, to: { r: number; c: number }): Board {
  const newBoard = board.map(row => [...row]);
  newBoard[to.r][to.c] = newBoard[from.r][from.c];
  newBoard[from.r][from.c] = null;
  return newBoard;
}
