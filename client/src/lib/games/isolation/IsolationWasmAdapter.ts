/**
 * Isolation WASM Adapter
 * 
 * Bridges TypeScript Game Engine with Rust/WASM Core.
 * Handles loading, state serialization, and move retrieval.
 */

import init, { IsolationEngine } from "./wasm/pkg/isolation_engine";
import type { BoardState } from "./types";
import type { GameMove } from "@shared/gameEngineInterface";

// Singleton instance to prevent multiple initializations
let engineInstance: IsolationEngine | null = null;
let isInitializing = false;

export interface WasmMoveResult {
    best_move: {
        from: [number, number];
        to: [number, number];
        destroy: [number, number];
    } | null;
    depth: number;
    score: number;
    nodes: number;
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
): Promise<{ move: GameMove | null; score: number; depth: number; nodes: number }> {
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
    const result = engine.get_best_move_advanced(difficulty, timeLimitMs);

    if (!result) {
        throw new Error("WASM returned null result");
    }

    const res = result as unknown as WasmMoveResult;

    let finalMove: GameMove | null = null;
    if (res.best_move) {
        finalMove = {
            from: { r: res.best_move.from[0], c: res.best_move.from[1] },
            to: { r: res.best_move.to[0], c: res.best_move.to[1] },
            destroy: { r: res.best_move.destroy[0], c: res.best_move.destroy[1] }
        };
    }

    // Free the temporary engine instance (Rust memory)
    engine.free();

    return {
        move: finalMove,
        score: res.score,
        depth: res.depth,
        nodes: res.nodes
    };
}
