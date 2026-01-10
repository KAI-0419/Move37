/**
 * Mini Chess Repetition Detection
 * 
 * Functions for detecting threefold repetition.
 */

import type { Board } from "./types";
import { makeMove } from "./boardUtils";
import { generateFen } from "./boardUtils";

export function wouldCauseThreefoldRepetition(
  board: Board,
  from: { r: number; c: number },
  to: { r: number; c: number },
  boardHistory: string[]
): boolean {
  // Apply the move to get the resulting board state
  const resultingBoard = makeMove(board, from, to);
  const resultingFen = generateFen(resultingBoard);
  
  // Count how many times this board state has appeared
  const occurrenceCount = boardHistory.filter(fen => fen === resultingFen).length;
  
  // If it has appeared 2 or more times, this move would be the 3rd occurrence
  return occurrenceCount >= 2;
}
