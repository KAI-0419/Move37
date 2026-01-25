/**
 * Web Worker for Minimax Calculation
 *
 * Runs minimax algorithm in a background thread to avoid blocking the UI.
 * This ensures timer, animations, and other UI elements remain responsive
 * during AI calculation.
 */

import type { BoardState } from "./types";
import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";
import { getBestMoveWasm, initWasm } from "./IsolationWasmAdapter";
import { runMinimaxSearch } from "./evaluation"; // Keep for fallback if needed, or remove?

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

// Initialize WASM immediately on worker load
initWasm().catch(err => console.error("Worker failed to init WASM:", err));

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (event: MessageEvent<MinimaxWorkerRequest>) => {
  const { type, board, playerLastMove, difficulty, turnCount, boardHistory } = event.data;

  if (type === 'CALCULATE_MOVE') {
    const startTime = performance.now();

    try {
      // Use Rust Engine
      const result = await getBestMoveWasm(board, difficulty, 2000); // 2000ms limit? or difficulty based?

      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: MinimaxWorkerResponse = {
        type: 'MOVE_RESULT',
        move: result.move,
        logs: ["gameRoom.log.isolation.strategy.aiDominant"], // Placeholder logs, need better logs from Rust
        stats: {
          depth: 10, // Rust search depth
          timeElapsed,
          nodesEvaluated: 0,
        },
      };

      self.postMessage(response);
    } catch (error) {
      console.warn("WASM Engine failed, falling back to TS:", error);

      try {
        const result = runMinimaxSearch(board, playerLastMove, difficulty, turnCount, boardHistory);
        const endTime = performance.now();
        const response: MinimaxWorkerResponse = {
          type: 'MOVE_RESULT',
          move: result.move,
          logs: result.logs,
          stats: {
            depth: result.depth || 0,
            timeElapsed: endTime - startTime,
          }
        };
        self.postMessage(response);
      } catch (fbError) {
        const endTime = performance.now();
        const response: MinimaxWorkerResponse = {
          type: 'MOVE_RESULT',
          move: null,
          logs: ["gameRoom.log.calculationErrorKo"],
          stats: {
            depth: 0,
            timeElapsed: endTime - startTime,
          },
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        self.postMessage(response);
      }
    }
  }
});
