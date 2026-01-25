/**
 * Performance profiling utilities for Isolation AI
 * Tracks metrics to measure optimization impact
 */

export interface PerformanceMetrics {
  // Search metrics
  nodesEvaluated: number;
  depthAchieved: number;
  timeElapsed: number;
  nps: number; // Nodes per second

  // Time breakdown (in milliseconds)
  timeInMoveGen: number;
  timeInMoveOrdering: number;
  timeInEvaluation: number;
  timeInVoronoi: number;
  timeInDestroy: number;

  // Transposition table
  ttHits: number;
  ttMisses: number;
  ttCollisions: number;

  // Move ordering effectiveness
  firstMoveCutoffs: number; // Beta cutoff on first move
  totalCutoffs: number;
  orderingEfficiency: number; // firstMoveCutoffs / totalCutoffs
}

export class PerformanceProfiler {
  private metrics: PerformanceMetrics;
  private timers: Map<string, number>;
  private searchStartTime: number;

  constructor() {
    this.metrics = this.createEmptyMetrics();
    this.timers = new Map();
    this.searchStartTime = 0;
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      nodesEvaluated: 0,
      depthAchieved: 0,
      timeElapsed: 0,
      nps: 0,
      timeInMoveGen: 0,
      timeInMoveOrdering: 0,
      timeInEvaluation: 0,
      timeInVoronoi: 0,
      timeInDestroy: 0,
      ttHits: 0,
      ttMisses: 0,
      ttCollisions: 0,
      firstMoveCutoffs: 0,
      totalCutoffs: 0,
      orderingEfficiency: 0,
    };
  }

  /**
   * Reset all metrics for a new search
   */
  reset(): void {
    this.metrics = this.createEmptyMetrics();
    this.timers.clear();
    this.searchStartTime = performance.now();
  }

  /**
   * Start a named timer
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * End a named timer and return elapsed time
   */
  endTimer(name: string): number {
    const start = this.timers.get(name);
    if (!start) return 0;

    const elapsed = performance.now() - start;
    this.timers.delete(name);
    return elapsed;
  }

  /**
   * Record a metric value (incremental)
   */
  recordMetric(key: keyof PerformanceMetrics, value: number): void {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number) += value;
    }
  }

  /**
   * Set a metric value (absolute)
   */
  setMetric(key: keyof PerformanceMetrics, value: number): void {
    if (typeof this.metrics[key] === 'number') {
      (this.metrics[key] as number) = value;
    }
  }

  /**
   * Get current metrics with calculated fields
   */
  getReport(): PerformanceMetrics {
    // Calculate total elapsed time
    this.metrics.timeElapsed = performance.now() - this.searchStartTime;

    // Calculate NPS (nodes per second)
    if (this.metrics.timeElapsed > 0) {
      this.metrics.nps = Math.round(
        (this.metrics.nodesEvaluated / this.metrics.timeElapsed) * 1000
      );
    }

    // Calculate move ordering efficiency
    if (this.metrics.totalCutoffs > 0) {
      this.metrics.orderingEfficiency =
        this.metrics.firstMoveCutoffs / this.metrics.totalCutoffs;
    }

    return { ...this.metrics };
  }

  /**
   * Format metrics as a readable string
   */
  formatReport(): string {
    const report = this.getReport();
    return `
=== Isolation AI Performance Report ===
Nodes Evaluated: ${report.nodesEvaluated.toLocaleString()}
Depth Achieved: ${report.depthAchieved}
Time Elapsed: ${report.timeElapsed.toFixed(0)}ms
NPS: ${report.nps.toLocaleString()} nodes/second

Time Breakdown:
  Move Generation: ${report.timeInMoveGen.toFixed(1)}ms (${((report.timeInMoveGen / report.timeElapsed) * 100).toFixed(1)}%)
  Move Ordering: ${report.timeInMoveOrdering.toFixed(1)}ms (${((report.timeInMoveOrdering / report.timeElapsed) * 100).toFixed(1)}%)
  Evaluation: ${report.timeInEvaluation.toFixed(1)}ms (${((report.timeInEvaluation / report.timeElapsed) * 100).toFixed(1)}%)
  Voronoi: ${report.timeInVoronoi.toFixed(1)}ms (${((report.timeInVoronoi / report.timeElapsed) * 100).toFixed(1)}%)
  Destroy Gen: ${report.timeInDestroy.toFixed(1)}ms (${((report.timeInDestroy / report.timeElapsed) * 100).toFixed(1)}%)

Transposition Table:
  Hits: ${report.ttHits.toLocaleString()}
  Misses: ${report.ttMisses.toLocaleString()}
  Collisions: ${report.ttCollisions.toLocaleString()}
  Hit Rate: ${report.ttHits > 0 ? ((report.ttHits / (report.ttHits + report.ttMisses)) * 100).toFixed(1) : 0}%

Move Ordering:
  First Move Cutoffs: ${report.firstMoveCutoffs.toLocaleString()}
  Total Cutoffs: ${report.totalCutoffs.toLocaleString()}
  Efficiency: ${(report.orderingEfficiency * 100).toFixed(1)}%
=====================================
    `.trim();
  }
}

// Global profiler instance (optional, can be passed as parameter instead)
let globalProfiler: PerformanceProfiler | null = null;

/**
 * Enable profiling (creates global instance)
 */
export function enableProfiling(): void {
  globalProfiler = new PerformanceProfiler();
}

/**
 * Disable profiling (removes global instance)
 */
export function disableProfiling(): void {
  globalProfiler = null;
}

/**
 * Get global profiler instance (null if profiling disabled)
 */
export function getProfiler(): PerformanceProfiler | null {
  return globalProfiler;
}

/**
 * Check if profiling is enabled
 */
export function isProfilingEnabled(): boolean {
  return globalProfiler !== null;
}
