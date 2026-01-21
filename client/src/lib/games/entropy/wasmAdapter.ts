import type { AIMoveResult } from "@shared/gameEngineInterface";
import type { BoardState } from "./types";

// Interface matching Rust's AnalysisResult struct
interface WasmMoveInfo {
  r: number;
  c: number;
  visits: number;
  wins: number;
  win_rate: number;
}

interface WasmAnalysisResult {
  best_move: WasmMoveInfo | null;
  alternatives: WasmMoveInfo[];
  total_simulations: number;
  elapsed_ms: number;
  nps: number;
}

// Worker management
let worker: Worker | null = null;
let activeRequest: { resolve: (val: any) => void; reject: (err: any) => void } | null = null;

function getWorker(): Worker {
  if (!worker) {
    // Create new worker
    // Note: The path must be recognized by Vite's worker import
    worker = new Worker(new URL('./wasm/wasm.worker.ts', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (e) => {
      const { type, payload, error } = e.data;

      if (activeRequest) {
        if (type === 'CALCULATION_COMPLETE') {
          activeRequest.resolve(payload);
        } else if (type === 'CALCULATION_ERROR') {
          activeRequest.reject(error);
        }
        activeRequest = null;
      }
    };

    worker.onerror = (err) => {
      console.error("WASM Worker Error:", err);
      if (activeRequest) {
        activeRequest.reject(err);
        activeRequest = null;
      }
    };
  }
  return worker;
}

export function terminateWasmWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    activeRequest = null;
  }
}

function printAnalysisLog(result: WasmAnalysisResult, difficulty: string) {
  const best = result.best_move;
  if (!best) return;

  const winRatePercent = (best.win_rate * 100).toFixed(1);
  const npsFormatted = Math.round(result.nps).toLocaleString();
  const simsFormatted = result.total_simulations.toLocaleString();

  console.group(`🤖 NEXUS-7 AI Analysis [${difficulty}] (Enhanced v2)`);
  console.log(
    `%c🏆 Best Move: (${best.r}, ${best.c}) | Win Rate: ${winRatePercent}%`,
    "color: #4ade80; font-weight: bold; font-size: 14px;"
  );
  console.log(
    `⏱️ Time: ${result.elapsed_ms.toFixed(0)}ms | 🔄 Sims: ${simsFormatted} | 🚀 Speed: ${npsFormatted} nps`
  );

  console.groupCollapsed("📊 Candidate Details");

  if (best) {
    console.log(
      `1. (${best.r}, ${best.c}) - Rate: ${winRatePercent}% [Visits: ${best.visits}, Wins: ${best.wins}]`
    );
  }

  result.alternatives.forEach((alt, idx) => {
    const altRate = (alt.win_rate * 100).toFixed(1);
    console.log(
      `${idx + 2}. (${alt.r}, ${alt.c}) - Rate: ${altRate}% [Visits: ${alt.visits}, Wins: ${alt.wins}]`
    );
  });
  console.groupEnd();
  console.groupEnd();
}

export async function getWasmAIMove(
  board: BoardState,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
  emptyCells: number
): Promise<AIMoveResult | null> {
  const rows = board.boardSize.rows;
  const cols = board.boardSize.cols;
  const flatBoard = new Uint8Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board.cells[r][c];
      const idx = r * cols + c;
      if (cell === 'PLAYER') flatBoard[idx] = 1;
      else if (cell === 'AI') flatBoard[idx] = 2;
      else flatBoard[idx] = 0;
    }
  }

  // Detect mobile device (informational only now)
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  let timeLimit = 1000;
  let numericDifficulty = 3;
  let phase = 0; // 0: Opening, 1: Mid, 2: End

  if (difficulty === 'NEXUS-5') {
    timeLimit = isMobile ? 1000 : 2000;
    numericDifficulty = 5;
    // Nexus-5 uses flat time for simplicity
    phase = 1;
  }

  if (difficulty === 'NEXUS-7') {
    numericDifficulty = 7;

    // Dynamic Time Management (The Bell Curve of Thought)
    if (emptyCells > 100) {
      // Opening Phase: Fast, Intuitive (1000ms)
      // "Thermal Headroom" accumulation
      phase = 0;
      timeLimit = 1000;
      console.log(`[EntropyWasm] Phase: OPENING (${emptyCells} left) - Target: 1000ms`);
    } else if (emptyCells >= 40) {
      // Mid-Game: Peak Complexity (6000ms)
      // "Overdrive" - spending the thermal buffer
      phase = 1;
      timeLimit = 6000;
      console.log(`[EntropyWasm] Phase: MID-GAME (${emptyCells} left) - Target: 6000ms (Overdrive)`);
    } else {
      // End-Game: Cleanup (1500ms)
      // Cooling down
      phase = 2;
      timeLimit = 1500;
      console.log(`[EntropyWasm] Phase: END-GAME (${emptyCells} left) - Target: 1500ms`);
    }
  }

  if (isMobile) {
    console.log(`[EntropyWasm] Mobile detected. Running NEXUS-7 dynamic profile.`);
  }

  try {
    const workerInstance = getWorker();

    // Wrap worker communication in a Promise
    const resultObj = await new Promise<any>((resolve, reject) => {
      // If there's an active request, reject it
      if (activeRequest) {
        activeRequest.reject("Cancelled by new request");
      }

      activeRequest = { resolve, reject };

      workerInstance.postMessage({
        type: 'CALCULATE_MOVE',
        payload: {
          boardArray: flatBoard,
          isAiTurn: true,
          timeLimit,
          difficultyLevel: numericDifficulty,
          phase // Pass phase for adaptive logic
        }
      });
    });

    // Validate result
    if (!resultObj || !resultObj.best_move) {
      throw new Error("Invalid result from WASM worker");
    }

    const result = resultObj as WasmAnalysisResult;
    const best = result.best_move!;

    // Print logs
    printAnalysisLog(result, difficulty);

    return {
      move: {
        from: { r: -1, c: -1 },
        to: { r: best.r, c: best.c }
      },
      logs: [
        `NEXUS Analysis: ${result.total_simulations.toLocaleString()} sims in ${result.elapsed_ms.toFixed(0)}ms`,
        `Win Probability: ${(best.win_rate * 100).toFixed(1)}%`
      ]
    };

  } catch (e) {
    console.error("WASM Worker Error:", e);
    // Restart worker if it crashed
    terminateWasmWorker();
    return null;
  }
}
