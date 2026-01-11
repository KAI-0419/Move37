/**
 * Union-Find (Disjoint Set) Data Structure
 * 
 * Used for efficient connection checking in Hex game.
 * O(1) amortized time complexity for union and find operations.
 */

export class UnionFind {
  private parent: number[];
  private rank: number[];
  private size: number;

  constructor(size: number) {
    this.size = size;
    this.parent = new Array(size);
    this.rank = new Array(size);
    
    // Initialize: each element is its own parent
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  /**
   * Find the root of the set containing x
   * Uses path compression for optimization
   */
  find(x: number): number {
    if (this.parent[x] !== x) {
      // Path compression: make parent point directly to root
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  /**
   * Union two sets containing x and y
   * Uses union by rank for optimization
   */
  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) {
      return; // Already in the same set
    }

    // Union by rank: attach smaller tree to larger tree
    if (this.rank[rootX] < this.rank[rootY]) {
      this.parent[rootX] = rootY;
    } else if (this.rank[rootX] > this.rank[rootY]) {
      this.parent[rootY] = rootX;
    } else {
      // Same rank: attach one to the other and increase rank
      this.parent[rootY] = rootX;
      this.rank[rootX]++;
    }
  }

  /**
   * Check if x and y are in the same set
   */
  connected(x: number, y: number): boolean {
    return this.find(x) === this.find(y);
  }

  /**
   * Reset the Union-Find structure
   */
  reset(): void {
    for (let i = 0; i < this.size; i++) {
      this.parent[i] = i;
      this.rank[i] = 0;
    }
  }

  /**
   * Get the size of the Union-Find structure
   */
  getSize(): number {
    return this.size;
  }
}
