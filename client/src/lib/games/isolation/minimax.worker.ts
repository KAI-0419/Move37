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
import { getDifficultyConfig } from "./difficultyConfig";
import { getValidMoves } from "./moveValidation";

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
  requestId: number;
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
  requestId: number;
}

// Initialize WASM immediately on worker load
initWasm().catch(err => console.error("Worker failed to init WASM:", err));

/**
 * Handle messages from main thread
 */
self.addEventListener('message', async (event: MessageEvent<MinimaxWorkerRequest>) => {
  const { type, board, playerLastMove, difficulty, turnCount, boardHistory, requestId } = event.data;

  if (type === 'CALCULATE_MOVE') {
    const startTime = performance.now();

    try {
      // Use Rust Engine
      const config = getDifficultyConfig(difficulty);
      let timeLimit = config.timeLimit;

      // Crisis Mode: If mobility is critically low, double the think time to find a way out
      if (difficulty === "NEXUS-7") {
         const aiMoves = getValidMoves(board, board.aiPos, false);
         if (aiMoves.length <= 4) {
             timeLimit = timeLimit * 2;
             // We can't use console.log in worker easily for user visibility, but good for debug
             // console.log("CRISIS MODE: AI Mobility Low (" + aiMoves.length + "), Doubling Time Limit to " + timeLimit + "ms");
         }
      }

      const result = await getBestMoveWasm(board, difficulty, timeLimit);

      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: MinimaxWorkerResponse = {
        type: 'MOVE_RESULT',
        move: result.move,
        logs: ["gameRoom.log.isolation.strategy.aiDominant"], // Placeholder logs
        stats: {
          depth: result.depth,
          timeElapsed,
          nodesEvaluated: result.nodes,
        },
        requestId
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
          },
          requestId
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
          requestId
        };
        self.postMessage(response);
      }
    }
  }
});
