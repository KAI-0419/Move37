/**
 * MCTS Worker Pool for Parallel Simulation
 *
 * Manages a pool of Web Workers to distribute MCTS simulations across multiple threads.
 * This dramatically improves AI calculation speed by leveraging multi-core CPUs.
 *
 * Architecture:
 * - Creates 4-8 Workers based on CPU core count
 * - Distributes simulations evenly across Workers
 * - Merges results from all Workers into a single best move
 * - Handles Worker failures gracefully with fallback to synchronous MCTS
 */

import type { BoardState, Move, Player } from "./types";
import type { MCTSConfig, AIPersonality } from "./mcts";
import { runMCTS } from "./mcts";

/**
 * Worker request message type
 */
export interface WorkerRequest {
  type: 'CALCULATE_MOVE';
  board: BoardState;
  player: Player;
  config: MCTSConfig;
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Worker response message type (enhanced with win rate)
 */
export interface WorkerResponse {
  type: 'MOVE_RESULT';
  move: Move | null;
  stats?: {
    simulations: number;
    timeElapsed: number;
    visits?: number;    // Total visits for this move
    wins?: number;      // Total wins for this move
    winRate?: number;   // Win rate for this move
  };
  error?: string;
}

/**
 * Aggregated results from multiple Workers
 */
export interface AggregatedResult {
  move: Move | null;
  totalSimulations: number;
  totalTimeElapsed: number;
}

/**
 * Worker Pool Configuration
 */
export interface WorkerPoolConfig {
  minWorkers?: number; // Minimum number of Workers (default: 2)
  maxWorkers?: number; // Maximum number of Workers (default: 8)
  workerTimeout?: number; // Timeout per Worker in ms (default: 10000)
}

/**
 * MCTS Worker Pool
 *
 * Manages a pool of Web Workers for parallel MCTS computation.
 * Workers are created on-demand and reused across multiple AI move calculations.
 */
export class MCTSWorkerPool {
  private workers: Worker[] = [];
  private workerCount: number;
  private workerTimeout: number;
  private isInitialized: boolean = false;

  constructor(config: WorkerPoolConfig = {}) {
    const {
      minWorkers = 2,
      maxWorkers = 8,
      workerTimeout = 10000,
    } = config;

    // Determine optimal worker count based on CPU cores
    // Use navigator.hardwareConcurrency to detect available cores
    const availableCores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4; // Fallback to 4 if not available

    // Detect mobile device for thermal management
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // On mobile, cap workers to 4 to prevent overheating
    // On desktop, allow up to 8 (or maxWorkers config)
    const effectiveMaxWorkers = isMobile ? Math.min(maxWorkers, 4) : maxWorkers;

    // Use min(effectiveMaxWorkers, max(minWorkers, cores - 1))
    // Reserve 1 core for main thread and UI
    this.workerCount = Math.min(
      effectiveMaxWorkers,
      Math.max(minWorkers, availableCores - 1)
    );

    this.workerTimeout = workerTimeout;

    console.log(`[MCTSWorkerPool] Initializing with ${this.workerCount} workers (${availableCores} cores, mobile=${isMobile})`);
  }

  /**
   * Initialize Worker pool
   * Creates Workers lazily on first use
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create Workers using Vite's Web Worker syntax
      // Vite will handle bundling and code splitting for Workers
      for (let i = 0; i < this.workerCount; i++) {
        // Use Vite's ?worker suffix to import as Worker
        const worker = new Worker(
          new URL('./mcts.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.workers.push(worker);
      }

      this.isInitialized = true;
      console.log(`[MCTSWorkerPool] Initialized ${this.workers.length} workers`);
    } catch (error) {
      console.error('[MCTSWorkerPool] Failed to initialize workers:', error);
      // Fallback: no workers, will use synchronous MCTS
      this.workers = [];
      this.isInitialized = true;
    }
  }

  /**
   * Calculate AI move using parallel MCTS across multiple Workers
   *
   * @param board - Current board state
   * @param player - Player to calculate move for (typically 'AI')
   * @param config - MCTS configuration (simulations, UCB1, etc.)
   * @param threatLevel - Threat level for dynamic UCB1
   * @returns Best move found by parallel MCTS
   */
  async calculateMove(
    board: BoardState,
    player: Player,
    config: MCTSConfig,
    threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<Move | null> {
    // Initialize workers if not already done
    await this.initialize();

    // If no workers available, fall back to synchronous MCTS
    if (this.workers.length === 0) {
      console.warn('[MCTSWorkerPool] No workers available, using synchronous MCTS');
      return runMCTS(board, player, config, threatLevel);
    }

    try {
      // Distribute simulations across workers
      const simulationsPerWorker = Math.floor(config.simulations / this.workers.length);
      const remainingSimulations = config.simulations % this.workers.length;

      // Create worker tasks
      const workerTasks = this.workers.map((worker, index) => {
        // Distribute remaining simulations to first few workers
        const workerSimulations = simulationsPerWorker + (index < remainingSimulations ? 1 : 0);

        const workerConfig: MCTSConfig = {
          ...config,
          simulations: workerSimulations,
          // Each worker gets proportional time limit
          timeLimit: config.timeLimit
            ? Math.floor(config.timeLimit * (workerSimulations / config.simulations))
            : undefined,
        };

        return this.runWorkerTask(worker, board, player, workerConfig, threatLevel);
      });

      // Wait for all workers to complete (with timeout)
      const results = await Promise.all(workerTasks);

      // Merge results from all workers
      const aggregatedResult = this.mergeResults(results, board);

      console.log(`[MCTSWorkerPool] Completed ${aggregatedResult.totalSimulations} simulations in ${aggregatedResult.totalTimeElapsed.toFixed(0)}ms`);

      return aggregatedResult.move;
    } catch (error) {
      console.error('[MCTSWorkerPool] Error in parallel MCTS:', error);
      // Fallback to synchronous MCTS on error
      console.warn('[MCTSWorkerPool] Falling back to synchronous MCTS');
      return runMCTS(board, player, config, threatLevel);
    }
  }

  /**
   * Run MCTS calculation in a single Worker
   *
   * @param worker - Worker instance
   * @param board - Board state
   * @param player - Player
   * @param config - MCTS config for this worker
   * @param threatLevel - Threat level
   * @returns Worker response with move and stats
   */
  private runWorkerTask(
    worker: Worker,
    board: BoardState,
    player: Player,
    config: MCTSConfig,
    threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker timeout after ${this.workerTimeout}ms`));
      }, this.workerTimeout);

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);

        if (event.data.type === 'MOVE_RESULT') {
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data);
          }
        } else {
          reject(new Error('Invalid worker response type'));
        }
      };

      const handleError = (error: ErrorEvent) => {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);
        worker.removeEventListener('error', handleError);
        reject(error);
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError);

      // Send request to worker
      const request: WorkerRequest = {
        type: 'CALCULATE_MOVE',
        board,
        player,
        config,
        threatLevel,
      };

      worker.postMessage(request);
    });
  }

  /**
   * Merge results from multiple Workers
   *
   * ENHANCED STRATEGY:
   * - Primary: Weighted voting by win rate (not just vote count)
   * - Each worker's vote is weighted by its win rate for that move
   * - This gives more weight to confident selections
   *
   * @param results - Array of Worker responses
   * @param board - Board state (for validation)
   * @returns Aggregated result with best move
   */
  private mergeResults(
    results: WorkerResponse[],
    board: BoardState
  ): AggregatedResult {
    // Filter out null moves and errors
    const validResults = results.filter(r => r.move !== null && !r.error);

    if (validResults.length === 0) {
      // No valid moves found
      return {
        move: null,
        totalSimulations: 0,
        totalTimeElapsed: 0,
      };
    }

    // Aggregate moves with weighted scoring
    const moveScores = new Map<string, {
      move: Move;
      voteCount: number;
      totalWeight: number;
      totalVisits: number;
      totalWins: number;
    }>();

    for (const result of validResults) {
      if (!result.move) continue;

      const moveKey = `${result.move.r},${result.move.c}`;
      const existing = moveScores.get(moveKey);

      // Weight calculation:
      // - Base weight: 1 (one vote)
      // - Bonus weight from win rate (0-1)
      // - Bonus weight from visit count (normalized)
      const winRate = result.stats?.winRate ?? 0.5;
      const visits = result.stats?.visits ?? 1;
      const wins = result.stats?.wins ?? 0;

      // Weight: vote + (winRate * 2) + (visits / 1000)
      // This gives significant weight to high win rates
      const weight = 1 + (winRate * 2) + Math.min(visits / 1000, 1);

      if (existing) {
        existing.voteCount++;
        existing.totalWeight += weight;
        existing.totalVisits += visits;
        existing.totalWins += wins;
      } else {
        moveScores.set(moveKey, {
          move: result.move,
          voteCount: 1,
          totalWeight: weight,
          totalVisits: visits,
          totalWins: wins,
        });
      }
    }

    // Find move with highest weighted score
    let bestMove: Move | null = null;
    let maxScore = -1;

    const scoresArray = Array.from(moveScores.values());
    for (const entry of scoresArray) {
      // Score = totalWeight (includes vote count, win rate, and visits)
      // With tie-breaking by raw vote count
      const score = entry.totalWeight + (entry.voteCount * 0.1);

      if (score > maxScore) {
        maxScore = score;
        bestMove = entry.move;
      }
    }

    // Calculate total stats
    const totalSimulations = results.reduce((sum, r) => sum + (r.stats?.simulations || 0), 0);
    const totalTimeElapsed = results.reduce((sum, r) => sum + (r.stats?.timeElapsed || 0), 0);

    return {
      move: bestMove,
      totalSimulations,
      totalTimeElapsed,
    };
  }

  /**
   * Terminate all workers and clean up resources
   * Call this when shutting down the application or game
   */
  terminate(): void {
    console.log(`[MCTSWorkerPool] Terminating ${this.workers.length} workers`);

    for (const worker of this.workers) {
      worker.terminate();
    }

    this.workers = [];
    this.isInitialized = false;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    workerCount: number;
    isInitialized: boolean;
  } {
    return {
      workerCount: this.workers.length,
      isInitialized: this.isInitialized,
    };
  }
}

// Global singleton instance
let globalWorkerPool: MCTSWorkerPool | null = null;

/**
 * Get or create the global MCTS Worker Pool
 *
 * @param config - Optional configuration (only used on first call)
 * @returns Global Worker Pool instance
 */
export function getMCTSWorkerPool(config?: WorkerPoolConfig): MCTSWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new MCTSWorkerPool(config);
  }
  return globalWorkerPool;
}

/**
 * Terminate the global Worker Pool
 * Call this when the game is unmounted or app is closing
 */
export function terminateMCTSWorkerPool(): void {
  if (globalWorkerPool) {
    globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
