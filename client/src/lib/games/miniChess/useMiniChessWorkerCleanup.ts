/**
 * React Hook for Mini Chess Worker Pool Cleanup
 *
 * Ensures Worker Pool is properly terminated when game is unmounted.
 * This prevents memory leaks and ensures clean shutdown of background threads.
 */

import { useEffect } from "react";
import { terminateMiniChessWorkerPool } from "./miniChessWorkerPool";

/**
 * Hook to clean up Mini Chess Worker Pool on component unmount
 */
export function useMiniChessWorkerCleanup(): void {
    useEffect(() => {
        // Cleanup function called when component unmounts
        return () => {
            console.log('[useMiniChessWorkerCleanup] Terminating Mini Chess Worker Pool');
            terminateMiniChessWorkerPool();
        };
    }, []);
}
