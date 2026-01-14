/**
 * MCTS Node Pool for Memory Optimization
 * 
 * Implements object pooling to reduce garbage collection pressure.
 * Reuses MCTSNode objects instead of creating new ones, dramatically
 * reducing memory allocations and GC pauses in mobile environments.
 */

import type { BoardState, Move, Player } from "./types";
import type { MCTSNode } from "./mcts";
import { cloneBoard } from "./boardUtils";
import { getValidMoves } from "./moveValidation";

/**
 * Object pool for MCTSNode instances
 * 
 * Strategy:
 * - Pre-allocate a pool of nodes
 * - Reuse nodes by resetting their state
 * - Release all nodes after each MCTS search
 */
export class MCTSNodePool {
  private pool: MCTSNode[] = [];
  private activeNodes: Set<MCTSNode> = new Set();
  private poolSize: number;
  private currentIndex: number = 0;

  constructor(initialSize: number = 1000) {
    this.poolSize = initialSize;
    this.initializePool();
  }

  /**
   * Pre-allocate nodes in the pool
   */
  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.pool.push(this.createNode());
    }
  }

  /**
   * Create a new node (used for pool initialization)
   */
  private createNode(): MCTSNode {
    return {
      board: {
        boardSize: { rows: 11, cols: 11 },
        cells: [],
        turnCount: 0,
      },
      move: null,
      parent: null,
      children: [],
      visits: 0,
      wins: 0,
      untriedMoves: [],
      player: 'AI',
    };
  }

  /**
   * Acquire a node from the pool
   * 
   * @param parent - Parent node (null for root)
   * @param move - Move that led to this node
   * @param board - Board state for this node
   * @param player - Player who made the move
   * @returns Reused or new MCTSNode
   */
  acquire(
    parent: MCTSNode | null,
    move: Move | null,
    board: BoardState,
    player: Player
  ): MCTSNode {
    let node: MCTSNode;

    // Try to get from pool
    if (this.currentIndex < this.pool.length) {
      node = this.pool[this.currentIndex++];
    } else {
      // Pool exhausted, create new node (will be added to pool later)
      node = this.createNode();
      this.pool.push(node);
    }

    // Reset and initialize node
    this.resetNode(node, parent, move, board, player);
    this.activeNodes.add(node);

    return node;
  }

  /**
   * Reset a node's state for reuse
   */
  private resetNode(
    node: MCTSNode,
    parent: MCTSNode | null,
    move: Move | null,
    board: BoardState,
    player: Player
  ): void {
    // Reuse board object if possible (avoid cloning if not needed)
    node.board = cloneBoard(board);
    node.move = move;
    node.parent = parent;
    node.children = []; // Clear children array
    node.visits = 0;
    node.wins = 0;
    node.untriedMoves = getValidMoves(board);
    node.player = player;
  }

  /**
   * Release all nodes back to the pool
   * Called after each MCTS search completes
   */
  releaseAll(): void {
    // Clear all active node references
    // Convert Set to array for iteration
    const activeNodesArray = Array.from(this.activeNodes);
    for (const node of activeNodesArray) {
      // Clean up references to prevent memory leaks
      node.parent = null;
      node.children = [];
      node.untriedMoves = [];
    }

    this.activeNodes.clear();
    this.currentIndex = 0; // Reset pool index
  }

  /**
   * Get current pool statistics
   */
  getStats(): { poolSize: number; activeNodes: number; currentIndex: number } {
    return {
      poolSize: this.pool.length,
      activeNodes: this.activeNodes.size,
      currentIndex: this.currentIndex,
    };
  }

  /**
   * Expand pool size if needed
   */
  expandPool(additionalSize: number): void {
    for (let i = 0; i < additionalSize; i++) {
      this.pool.push(this.createNode());
    }
    this.poolSize = this.pool.length;
  }
}

// Global pool instance (singleton pattern)
let globalNodePool: MCTSNodePool | null = null;

/**
 * Get or create the global node pool
 */
export function getNodePool(): MCTSNodePool {
  if (!globalNodePool) {
    globalNodePool = new MCTSNodePool(2000); // Larger pool for NEXUS-7
  }
  return globalNodePool;
}

/**
 * Reset the global node pool (call after each game or move)
 */
export function resetNodePool(): void {
  if (globalNodePool) {
    globalNodePool.releaseAll();
  }
}
