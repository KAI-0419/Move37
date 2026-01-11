/**
 * Web Worker for MCTS Calculation
 * 
 * Runs MCTS algorithm in a background thread to avoid blocking the UI.
 */

import type { BoardState, Move, Player } from "./types";
import { runMCTS, type MCTSConfig } from "./mcts";

/**
 * Worker message types
 */
interface WorkerRequest {
  type: 'CALCULATE_MOVE';
  board: BoardState;
  player: Player;
  config: MCTSConfig;
}

interface WorkerResponse {
  type: 'MOVE_RESULT';
  move: Move | null;
  error?: string;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { type, board, player, config } = event.data;

  if (type === 'CALCULATE_MOVE') {
    try {
      const move = runMCTS(board, player, config);
      
      const response: WorkerResponse = {
        type: 'MOVE_RESULT',
        move,
      };
      
      self.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        type: 'MOVE_RESULT',
        move: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      self.postMessage(response);
    }
  }
});
