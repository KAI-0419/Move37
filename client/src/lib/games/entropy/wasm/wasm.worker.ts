// wasm.worker.ts
import init, { EntropyWasmEngine } from './pkg/entropy_engine.js';

let engine: EntropyWasmEngine | null = null;
let isInitialized = false;

// Initialize WASM
async function initialize() {
  if (isInitialized) return;
  
  try {
    // In a worker, we need to locate the wasm file relative to the worker script
    // Vite handles the import, but we need to ensure init is called
    await init(); 
    engine = new EntropyWasmEngine();
    isInitialized = true;
    console.log('[Worker] Entropy WASM Engine initialized');
  } catch (err) {
    console.error('[Worker] Failed to initialize WASM:', err);
    throw err;
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'CALCULATE_MOVE') {
    const { boardArray, isAiTurn, timeLimit, difficultyLevel } = payload;

    try {
      if (!isInitialized) {
        await initialize();
      }

      if (!engine) {
        throw new Error("Engine not ready");
      }

      // Perform calculation (this blocks the worker thread, but not the UI)
      const resultObj = engine.get_best_move(boardArray, isAiTurn, timeLimit, difficultyLevel || 7);
      
      // Send result back to main thread
      self.postMessage({
        type: 'CALCULATION_COMPLETE',
        payload: resultObj
      });

    } catch (error) {
      console.error('[Worker] Calculation error:', error);
      self.postMessage({
        type: 'CALCULATION_ERROR',
        error: String(error)
      });
    }
  }
};
