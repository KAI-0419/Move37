/**
 * Isolation WASM Adapter
 * 
 * Bridges TypeScript Game Engine with Rust/WASM Core.
 * Handles loading, state serialization, and move retrieval.
 */

import init, { IsolationEngine } from "./wasm/pkg_new/isolation_engine";
import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";

// Singleton instance to prevent multiple initializations
let engineInstance: IsolationEngine | null = null;
let isInitializing = false;

export interface WasmMoveResult {
    from: [number, number];
    to: [number, number];
    destroy: [number, number];
    score: number;
}

/**
 * Initialize the WASM module
 */
export async function initWasm(): Promise<void> {
    if (engineInstance) return;
    if (isInitializing) {
        // Wait for initialization to complete
        while (isInitializing) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (engineInstance) return;
        }
    }

    isInitializing = true;
    try {
        await init();
        // Create reusable engine instance
        engineInstance = new IsolationEngine();
        console.log("Isolation Rust/WASM Engine Initialized");
    } catch (error) {
        console.error("Failed to initialize Isolation WASM:", error);
        throw error;
    } finally {
        isInitializing = false;
    }
}

/**
 * Get Best Move using Rust Engine
 */
export async function getBestMoveWasm(
    board: BoardState,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    timeLimitMs: number
): Promise<{ move: GameMove; score: number }> {
    if (!engineInstance) {
        await initWasm();
    }

    // Convert Destroyed array to flat array for Wasm
    const destroyedFlat: number[] = [];
    for (const d of board.destroyed) {
        destroyedFlat.push(d.r, d.c);
    }
    const destroyedUint8 = new Uint8Array(destroyedFlat);

    // Create a temporary engine instance for this state
    // Using from_state for stateless pattern (thread safety)
    const engine = IsolationEngine.from_state(
        board.playerPos.r,
        board.playerPos.c,
        board.aiPos.r,
        board.aiPos.c,
        destroyedUint8
    );

    // Call get_best_move_advanced with difficulty and enhanced evaluation
    // The Rust implementation will automatically use the appropriate:
    // - Evaluation weights (8-component advanced eval)
    // - Search depth (NEXUS-3: 5, NEXUS-5: 7, NEXUS-7: 10)
    // - Destroy candidate count
    const result = engine.get_best_move_advanced(difficulty, timeLimitMs);

    // Parse result
    // result is JsValue object matching `Move` struct: { from: [r,c], to: [r,c], destroy: [r,c], score: i32 }
    // Actually WASM bindgen usually maps tuples to arrays or objects?
    // In Rust `Move` struct: pub from: (u8, u8) -> in JS: [u8, u8] if using serde tuple?
    // Wait, I defined `Move` struct with named fields in Rust `board.rs`.
    // So JS will see an object: { from: [r,c], to: [r,c], ... } IF serde handles tuples as arrays.
    // Default serde tuple -> array. 

    if (!result) {
        throw new Error("WASM returned null move");
    }

    // Cast to expected type (checked at runtime implicitly)
    const moveData = result as unknown as WasmMoveResult;

    // Rust returns u8, need to convert to number
    const finalMove: GameMove = {
        from: { r: moveData.from[0], c: moveData.from[1] },
        to: { r: moveData.to[0], c: moveData.to[1] },
        destroy: { r: moveData.destroy[0], c: moveData.destroy[1] }
    };

    // Free the temporary engine instance (Rust memory)
    engine.free();

    return {
        move: finalMove,
        score: moveData.score
    };
}
