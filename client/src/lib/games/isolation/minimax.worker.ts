/**
 * Web Worker for Minimax Calculation
 *
 * Runs minimax algorithm in a background thread to avoid blocking the UI.
 * This ensures timer, animations, and other UI elements remain responsive
 * during AI calculation.
 */

import type { BoardState } from "./types";
import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";
import { runMinimaxSearch } from "./evaluation";

/**
 * Worker message types
 */
export interface MinimaxWorkerRequest {
  type: 'CALCULATE_MOVE';
  board: BoardState;
  playerLastMove: PlayerMove | null;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  turnCount?: number;
  boardHistory?: string[];
}

export interface MinimaxWorkerResponse {
  type: 'MOVE_RESULT';
  move: GameMove | null;
  logs: string[];
  stats?: {
    depth: number;
    timeElapsed: number;
    nodesEvaluated?: number;
  };
  error?: string;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event: MessageEvent<MinimaxWorkerRequest>) => {
  const { type, board, playerLastMove, difficulty, turnCount, boardHistory } = event.data;

  if (type === 'CALCULATE_MOVE') {
    const startTime = performance.now();

    try {
      // Run minimax search
      const result = runMinimaxSearch(board, playerLastMove, difficulty, turnCount, boardHistory);

      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: MinimaxWorkerResponse = {
        type: 'MOVE_RESULT',
        move: result.move,
        logs: result.logs,
        stats: {
          depth: result.depth || 0,
          timeElapsed,
          nodesEvaluated: result.nodesEvaluated,
        },
      };

      self.postMessage(response);
    } catch (error) {
      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: MinimaxWorkerResponse = {
        type: 'MOVE_RESULT',
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
        stats: {
          depth: 0,
          timeElapsed,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      self.postMessage(response);
    }
  }
});
