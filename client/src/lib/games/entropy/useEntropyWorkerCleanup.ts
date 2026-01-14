/**
 * React Hook for ENTROPY Worker Pool Cleanup
 *
 * Ensures Worker Pool is properly terminated when game is unmounted.
 * This prevents memory leaks and ensures clean shutdown of background threads.
 */

import { useEffect } from "react";
import { terminateMCTSWorkerPool } from "./mctsWorkerPool";

/**
 * Hook to clean up MCTS Worker Pool on component unmount
 *
 * Usage:
 * ```tsx
 * function EntropyGameComponent() {
 *   useEntropyWorkerCleanup();
 *   // ... rest of component
 * }
 * ```
 *
 * This hook should be used in the main game component for ENTROPY
 * to ensure Workers are terminated when the game is closed.
 */
export function useEntropyWorkerCleanup(): void {
  useEffect(() => {
    // Cleanup function called when component unmounts
    return () => {
      console.log('[useEntropyWorkerCleanup] Terminating MCTS Worker Pool');
      terminateMCTSWorkerPool();
    };
  }, []);
}
