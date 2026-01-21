/**
 * Web Worker for MCTS Calculation
 *
 * Runs MCTS algorithm in a background thread to avoid blocking the UI.
 * Enhanced to support parallel computation with performance metrics.
 */

import type { BoardState, Move, Player } from "./types";
import { runMCTSSync, type MCTSConfig } from "./mcts";

/**
 * Worker message types
 */
interface WorkerRequest {
  type: 'CALCULATE_MOVE';
  board: BoardState;
  player: Player;
  config: MCTSConfig;
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface WorkerResponse {
  type: 'MOVE_RESULT';
  move: Move | null;
  stats?: {
    simulations: number;
    timeElapsed: number;
  };
  error?: string;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { type, board, player, config, threatLevel } = event.data;

  if (type === 'CALCULATE_MOVE') {
    const startTime = performance.now();

    try {
      // Run MCTS with threat level for dynamic UCB1
      // Use sync version in worker (workers can't await in message handlers easily)
      // Progressive widening is enabled by default in runMCTSSync for thermal management
      const move = runMCTSSync(board, player, config, threatLevel);

      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: WorkerResponse = {
        type: 'MOVE_RESULT',
        move,
        stats: {
          simulations: config.simulations,
          timeElapsed,
        },
      };

      self.postMessage(response);
    } catch (error) {
      const endTime = performance.now();
      const timeElapsed = endTime - startTime;

      const response: WorkerResponse = {
        type: 'MOVE_RESULT',
        move: null,
        stats: {
          simulations: 0,
          timeElapsed,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      self.postMessage(response);
    }
  }
});
