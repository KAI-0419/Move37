/**
 * React Hook for Isolation (Game 2) Worker Pool Cleanup
 *
 * Ensures Worker Pool is properly terminated when game is unmounted.
 * This prevents memory leaks and ensures clean shutdown of background threads.
 */

import { useEffect } from "react";
import { terminateMinimaxWorkerPool } from "./minimaxWorkerPool";

/**
 * Hook to clean up Isolation Worker Pool on component unmount
 */
export function useIsolationWorkerCleanup(): void {
    useEffect(() => {
        // Cleanup function called when component unmounts
        return () => {
            console.log('[useIsolationWorkerCleanup] Terminating Isolation Minimax Worker Pool');
            terminateMinimaxWorkerPool();
        };
    }, []);
}
