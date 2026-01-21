/**
 * Mini Chess Worker Pool
 * 
 * Manages a Web Worker to run Mini Chess AI calculations in a background thread.
 * This ensures the UI remains responsive during AI thinking time.
 */

import type { GameMove, PlayerMove } from "@shared/gameEngineInterface";
import type { MiniChessWorkerRequest, MiniChessWorkerResponse } from "./miniChess.worker";

export interface MiniChessWorkerPoolConfig {
  workerTimeout?: number; // Timeout in ms
}

export class MiniChessWorkerPool {
  private worker: Worker | null = null;
  private workerTimeout: number;
  private isInitialized: boolean = false;
  private pendingRequest: {
    resolve: (result: { move: GameMove | null; logs: string[] }) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  } | null = null;

  constructor(config: MiniChessWorkerPoolConfig = {}) {
    const { workerTimeout = 10000 } = config; // 10s timeout should be enough for Mini Chess
    this.workerTimeout = workerTimeout;
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.worker = new Worker(
        new URL('./miniChess.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.addEventListener('message', this.handleMessage.bind(this));
      this.worker.addEventListener('error', this.handleError.bind(this));

      this.isInitialized = true;
      console.log(`[MiniChessWorkerPool] Worker initialized successfully`);
    } catch (error) {
      console.error('[MiniChessWorkerPool] Failed to initialize worker:', error);
      this.worker = null;
      this.isInitialized = true;
    }
  }

  private handleMessage(event: MessageEvent<MiniChessWorkerResponse>): void {
    if (!this.pendingRequest) {
      return;
    }

    const { resolve, timeoutId } = this.pendingRequest;
    clearTimeout(timeoutId);
    this.pendingRequest = null;

    const response = event.data;
    if (response.type === 'MOVE_RESULT') {
      resolve({
        move: response.move,
        logs: response.logs,
      });
    }
  }

  private handleError(error: ErrorEvent): void {
    console.error('[MiniChessWorkerPool] Worker error:', error);

    if (this.pendingRequest) {
      const { reject, timeoutId } = this.pendingRequest;
      clearTimeout(timeoutId);
      this.pendingRequest = null;
      reject(new Error(`Worker error: ${error.message}`));
    }
  }

  async calculateMove(
    boardState: string,
    playerLastMove: PlayerMove | null,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    turnCount?: number,
    boardHistory?: string[]
  ): Promise<{ move: GameMove | null; logs: string[] }> {
    await this.initialize();

    if (!this.worker) {
      throw new Error('Worker not available');
    }

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

      const request: MiniChessWorkerRequest = {
        type: 'CALCULATE_MOVE',
        boardState,
        playerLastMove,
        difficulty,
        turnCount,
        boardHistory
      };

      this.worker!.postMessage(request);
    });
  }

  terminate(): void {
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
}

let globalWorkerPool: MiniChessWorkerPool | null = null;

export function getMiniChessWorkerPool(config?: MiniChessWorkerPoolConfig): MiniChessWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new MiniChessWorkerPool(config);
  }
  return globalWorkerPool;
}

export function terminateMiniChessWorkerPool(): void {
  if (globalWorkerPool) {
    globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
