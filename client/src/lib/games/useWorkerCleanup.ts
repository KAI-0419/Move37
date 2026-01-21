/**
 * Universal Worker Cleanup Hook
 *
 * A reusable hook to ensure background worker threads are terminated
 * when a game component unmounts.
 *
 * @param cleanupFn - The cleanup function to execute (e.g., terminateWorkerPool)
 * @param gameName - Optional name of the game for logging purposes
 */

import { useEffect } from "react";

export function useWorkerCleanup(cleanupFn: () => void, gameName: string = "Game"): void {
    useEffect(() => {
        // Cleanup function called when component unmounts
        return () => {
            console.log(`[useWorkerCleanup] Terminating worker pool for: ${gameName}`);
            cleanupFn();
        };
    }, [cleanupFn, gameName]);
}
