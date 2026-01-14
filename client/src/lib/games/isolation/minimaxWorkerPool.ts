/**
 * Minimax Worker Pool for Isolation AI
 *
 * Manages a Web Worker to run minimax calculations in a background thread.
 * Unlike Entropy's MCTS which benefits from parallelization, minimax with
 * alpha-beta pruning is inherently sequential, so we use a single worker
 * to avoid blocking the main thread while maintaining algorithm efficiency.
 *
 * Architecture:
 * - Creates a single Worker for minimax calculation
 * - Main thread remains responsive for UI updates (timer, animations)
 * - Handles Worker failures gracefully with timeout
 */

import type { BoardState } from "./types";
import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";

/**
 * Worker request message type
 */
export interface MinimaxWorkerRequest {
  type: 'CALCULATE_MOVE';
  board: BoardState;
  playerLastMove: PlayerMove | null;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  turnCount?: number;
  boardHistory?: string[];
}

/**
 * Worker response message type
 */
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
 * Worker Pool Configuration
 */
export interface MinimaxWorkerPoolConfig {
  workerTimeout?: number; // Timeout in ms (default: 15000 for deep search)
}

/**
 * Minimax Worker Pool
 *
 * Manages a single Web Worker for minimax computation.
 * The worker is created on-demand and reused across multiple AI move calculations.
 */
export class MinimaxWorkerPool {
  private worker: Worker | null = null;
  private workerTimeout: number;
  private isInitialized: boolean = false;
  private pendingRequest: {
    resolve: (result: { move: GameMove | null; logs: string[] }) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  } | null = null;

  constructor(config: MinimaxWorkerPoolConfig = {}) {
    const { workerTimeout = 15000 } = config;
    this.workerTimeout = workerTimeout;
    console.log(`[MinimaxWorkerPool] Initializing with timeout: ${workerTimeout}ms`);
  }

  /**
   * Initialize Worker
   * Creates Worker lazily on first use
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Use Vite's Web Worker syntax
      this.worker = new Worker(
        new URL('./minimax.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Set up message handler
      this.worker.addEventListener('message', this.handleMessage.bind(this));
      this.worker.addEventListener('error', this.handleError.bind(this));

      this.isInitialized = true;
      console.log(`[MinimaxWorkerPool] Worker initialized successfully`);
    } catch (error) {
      console.error('[MinimaxWorkerPool] Failed to initialize worker:', error);
      this.worker = null;
      this.isInitialized = true; // Mark as initialized to prevent retry loop
    }
  }

  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent<MinimaxWorkerResponse>): void {
    if (!this.pendingRequest) {
      console.warn('[MinimaxWorkerPool] Received message but no pending request');
      return;
    }

    const { resolve, timeoutId } = this.pendingRequest;
    clearTimeout(timeoutId);
    this.pendingRequest = null;

    const response = event.data;
    if (response.type === 'MOVE_RESULT') {
      if (response.stats) {
        console.log(`[MinimaxWorkerPool] Calculation completed: depth=${response.stats.depth}, time=${response.stats.timeElapsed.toFixed(0)}ms`);
      }
      resolve({
        move: response.move,
        logs: response.logs,
      });
    }
  }

  /**
   * Handle worker errors
   */
  private handleError(error: ErrorEvent): void {
    console.error('[MinimaxWorkerPool] Worker error:', error);

    if (this.pendingRequest) {
      const { reject, timeoutId } = this.pendingRequest;
      clearTimeout(timeoutId);
      this.pendingRequest = null;
      reject(new Error(`Worker error: ${error.message}`));
    }
  }

  /**
   * Calculate AI move using minimax in worker thread
   *
   * @param board - Current board state
   * @param playerLastMove - Player's last move for psychology analysis
   * @param difficulty - AI difficulty level
   * @param turnCount - Current turn count
   * @param boardHistory - History of board states
   * @returns AI move result with move and logs
   */
  async calculateMove(
    board: BoardState,
    playerLastMove: PlayerMove | null,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    turnCount?: number,
    boardHistory?: string[]
  ): Promise<{ move: GameMove | null; logs: string[] }> {
    // Initialize worker if not already done
    await this.initialize();

    // If worker failed to initialize, throw error (caller should handle fallback)
    if (!this.worker) {
      throw new Error('Worker not available');
    }

    // If there's already a pending request, reject it
    if (this.pendingRequest) {
      const { reject, timeoutId } = this.pendingRequest;
      clearTimeout(timeoutId);
      reject(new Error('Request superseded by new request'));
      this.pendingRequest = null;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequest) {
          this.pendingRequest = null;
          reject(new Error(`Worker timeout after ${this.workerTimeout}ms`));
        }
      }, this.workerTimeout);

      this.pendingRequest = { resolve, reject, timeoutId };

      // Send request to worker
      const request: MinimaxWorkerRequest = {
        type: 'CALCULATE_MOVE',
        board,
        playerLastMove,
        difficulty,
        turnCount,
        boardHistory,
      };

      this.worker!.postMessage(request);
    });
  }

  /**
   * Terminate worker and clean up resources
   */
  terminate(): void {
    console.log('[MinimaxWorkerPool] Terminating worker');

    if (this.pendingRequest) {
      const { reject, timeoutId } = this.pendingRequest;
      clearTimeout(timeoutId);
      reject(new Error('Worker terminated'));
      this.pendingRequest = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.isInitialized = false;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    isInitialized: boolean;
    hasPendingRequest: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      hasPendingRequest: this.pendingRequest !== null,
    };
  }
}

// Global singleton instance
let globalWorkerPool: MinimaxWorkerPool | null = null;

/**
 * Get or create the global Minimax Worker Pool
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Global Worker Pool instance
 */
export function getMinimaxWorkerPool(config?: MinimaxWorkerPoolConfig): MinimaxWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new MinimaxWorkerPool(config);
  }
  return globalWorkerPool;
}

/**
 * Terminate the global Worker Pool
 * Call this when the game is unmounted or app is closing
 */
export function terminateMinimaxWorkerPool(): void {
  if (globalWorkerPool) {
    globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
