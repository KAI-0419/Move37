/**
 * Transposition Table with Zobrist Hashing for ISOLATION
 *
 * Caches evaluated positions to avoid redundant calculation.
 * Uses Zobrist hashing for efficient board state identification.
 * Implements LRU-like eviction to manage memory.
 */

import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";

// Maximum board size (7x7 = 49 cells)
const BOARD_SIZE = 49;

// Generate random 32-bit numbers for Zobrist hashing
// Using 32-bit for better JavaScript number handling
function generateRandomInt32(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}

// Pre-computed random numbers for Zobrist hashing
// We need: player position (49), AI position (49), destroyed cells (49), turn (1)
const ZOBRIST_PLAYER: number[] = [];
const ZOBRIST_AI: number[] = [];
const ZOBRIST_DESTROYED: number[] = [];
let ZOBRIST_TURN: number;

// Initialize Zobrist keys
function initializeZobristKeys(): void {
  for (let i = 0; i < BOARD_SIZE; i++) {
    ZOBRIST_PLAYER[i] = generateRandomInt32();
    ZOBRIST_AI[i] = generateRandomInt32();
    ZOBRIST_DESTROYED[i] = generateRandomInt32();
  }
  ZOBRIST_TURN = generateRandomInt32();
}

// Initialize on module load
initializeZobristKeys();

export type TTFlag = 'EXACT' | 'LOWER' | 'UPPER';

export interface TranspositionEntry {
  hash: number;
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove: {
    to: { r: number; c: number };
    destroy: { r: number; c: number };
  } | null;
  age: number; // For replacement strategy
}

export class TranspositionTable {
  private table: Map<number, TranspositionEntry>;
  private readonly maxSize: number;
  private currentAge: number;
  private hits: number;
  private misses: number;
  private collisions: number;

  constructor(maxSize: number = 100000) {
    this.table = new Map();
    this.maxSize = maxSize;
    this.currentAge = 0;
    this.hits = 0;
    this.misses = 0;
    this.collisions = 0;
  }

  /**
   * Compute Zobrist hash for a board state
   */
  computeHash(board: BoardState, isAITurn: boolean): number {
    const { playerPos, aiPos, destroyed, boardSize } = board;

    // Convert positions to indices
    const playerIdx = playerPos.r * boardSize.cols + playerPos.c;
    const aiIdx = aiPos.r * boardSize.cols + aiPos.c;

    let hash = ZOBRIST_PLAYER[playerIdx] ^ ZOBRIST_AI[aiIdx];

    // Hash destroyed cells
    for (const d of destroyed) {
      const idx = d.r * boardSize.cols + d.c;
      hash ^= ZOBRIST_DESTROYED[idx];
    }

    // XOR turn if it's AI's turn
    if (isAITurn) {
      hash ^= ZOBRIST_TURN;
    }

    return hash >>> 0; // Ensure unsigned
  }

  /**
   * Probe the transposition table
   * Returns the entry if found and valid, null otherwise
   */
  probe(
    hash: number,
    depth: number,
    alpha: number,
    beta: number
  ): { score: number; flag: TTFlag; bestMove: TranspositionEntry['bestMove'] } | null {
    const entry = this.table.get(hash);

    if (!entry || entry.hash !== hash) {
      this.misses++;
      return null;
    }

    this.hits++;

    // Only use if the stored depth is sufficient
    if (entry.depth < depth) {
      // Entry exists but depth is insufficient - just return best move hint
      return {
        score: entry.score,
        flag: entry.flag,
        bestMove: entry.bestMove
      };
    }

    // Check if we can use the score
    if (entry.flag === 'EXACT') {
      return {
        score: entry.score,
        flag: 'EXACT',
        bestMove: entry.bestMove
      };
    } else if (entry.flag === 'LOWER' && entry.score >= beta) {
      return {
        score: entry.score,
        flag: 'LOWER',
        bestMove: entry.bestMove
      };
    } else if (entry.flag === 'UPPER' && entry.score <= alpha) {
      return {
        score: entry.score,
        flag: 'UPPER',
        bestMove: entry.bestMove
      };
    }

    // Can't use score, but can use best move
    return {
      score: entry.score,
      flag: entry.flag,
      bestMove: entry.bestMove
    };
  }

  /**
   * Store an entry in the transposition table
   */
  store(
    hash: number,
    depth: number,
    score: number,
    flag: TTFlag,
    bestMove: TranspositionEntry['bestMove']
  ): void {
    const existing = this.table.get(hash);

    // Replacement strategy:
    // 1. Always replace if new depth is greater
    // 2. Replace if same depth and new entry is from current search
    // 3. Replace if entry is from older search
    if (existing) {
      if (existing.depth > depth && existing.age === this.currentAge) {
        return; // Keep existing entry (deeper and current)
      }
      this.collisions++;
    }

    // Evict if at capacity
    if (this.table.size >= this.maxSize && !existing) {
      this.evictOldest();
    }

    this.table.set(hash, {
      hash,
      depth,
      score,
      flag,
      bestMove,
      age: this.currentAge
    });
  }

  /**
   * Evict oldest entries when at capacity
   */
  private evictOldest(): void {
    // Simple strategy: remove entries from oldest age
    const entriesToRemove: number[] = [];
    const targetRemoval = Math.floor(this.maxSize * 0.1); // Remove 10%

    const entries = Array.from(this.table.entries());
    for (const [key, entry] of entries) {
      if (entry.age < this.currentAge) {
        entriesToRemove.push(key);
        if (entriesToRemove.length >= targetRemoval) break;
      }
    }

    // If not enough old entries, remove any
    if (entriesToRemove.length < targetRemoval) {
      let count = 0;
      const keys = Array.from(this.table.keys());
      for (const key of keys) {
        if (count >= targetRemoval - entriesToRemove.length) break;
        if (!entriesToRemove.includes(key)) {
          entriesToRemove.push(key);
          count++;
        }
      }
    }

    for (const key of entriesToRemove) {
      this.table.delete(key);
    }
  }

  /**
   * Increment the age for new search
   */
  newSearch(): void {
    this.currentAge++;
  }

  /**
   * Clear the table
   */
  clear(): void {
    this.table.clear();
    this.currentAge = 0;
    this.hits = 0;
    this.misses = 0;
    this.collisions = 0;
  }

  /**
   * Get statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    collisions: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.table.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      collisions: this.collisions
    };
  }

  get size(): number {
    return this.table.size;
  }
}

// Singleton instance for global use
let globalTranspositionTable: TranspositionTable | null = null;

export function getTranspositionTable(maxSize?: number): TranspositionTable {
  if (!globalTranspositionTable) {
    globalTranspositionTable = new TranspositionTable(maxSize);
  }
  return globalTranspositionTable;
}

export function clearTranspositionTable(): void {
  if (globalTranspositionTable) {
    globalTranspositionTable.clear();
  }
}

/**
 * Incrementally update hash after a move
 * More efficient than recomputing from scratch
 */
export function updateHashAfterMove(
  currentHash: number,
  board: BoardState,
  move: GameMove,
  isPlayer: boolean
): number {
  const { boardSize } = board;

  // XOR out old position
  const oldPos = isPlayer ? board.playerPos : board.aiPos;
  const oldIdx = oldPos.r * boardSize.cols + oldPos.c;
  const zobristOld = isPlayer ? ZOBRIST_PLAYER[oldIdx] : ZOBRIST_AI[oldIdx];

  // XOR in new position
  const newIdx = move.to.r * boardSize.cols + move.to.c;
  const zobristNew = isPlayer ? ZOBRIST_PLAYER[newIdx] : ZOBRIST_AI[newIdx];

  let newHash = currentHash ^ zobristOld ^ zobristNew;

  // XOR in destroyed cell
  if (move.destroy) {
    const destroyPos = move.destroy as { r: number; c: number };
    const destroyIdx = destroyPos.r * boardSize.cols + destroyPos.c;
    newHash ^= ZOBRIST_DESTROYED[destroyIdx];
  }

  // Toggle turn
  newHash ^= ZOBRIST_TURN;

  return newHash >>> 0;
}
