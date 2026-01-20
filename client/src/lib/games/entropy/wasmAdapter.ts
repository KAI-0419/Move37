import init, { EntropyWasmEngine } from './wasm/pkg/entropy_engine.js';
import type { AIMoveResult } from "@shared/gameEngineInterface";
import type { BoardState } from "./types";

let wasmModule: EntropyWasmEngine | null = null;
let isInitializing = false;

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

async function initWasm() {
  if (wasmModule) return wasmModule;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (wasmModule) return wasmModule;
    }
  }

  try {
    isInitializing = true;
    await init();
    wasmModule = new EntropyWasmEngine();
    console.log("Entropy WASM Engine initialized");
    return wasmModule;
  } catch (error) {
    console.error("Failed to initialize WASM engine:", error);
    return null;
  } finally {
    isInitializing = false;
  }
}

function printAnalysisLog(result: WasmAnalysisResult, difficulty: string) {
  const best = result.best_move;
  if (!best) return;

  const winRatePercent = (best.win_rate * 100).toFixed(1);
  const npsFormatted = Math.round(result.nps).toLocaleString();
  const simsFormatted = result.total_simulations.toLocaleString();

  console.group(`🤖 NEXUS-7 AI Analysis [${difficulty}]`);
  console.log(
    `%c🏆 Best Move: (${best.r}, ${best.c}) | Win Rate: ${winRatePercent}%`,
    "color: #4ade80; font-weight: bold; font-size: 14px;"
  );
  console.log(
    `⏱️ Time: ${result.elapsed_ms.toFixed(0)}ms | 🔄 Sims: ${simsFormatted} | 🚀 Speed: ${npsFormatted} nps`
  );

  console.groupCollapsed("📊 Candidate Details");
  
  // Best move details
  console.log(
    `1. (${best.r}, ${best.c}) - Rate: ${winRatePercent}% [Visits: ${best.visits}, Wins: ${best.wins}]`
  );

  // Alternatives
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
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): Promise<AIMoveResult | null> {
  const engine = await initWasm();
  if (!engine) return null;

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

  let timeLimit = 1000;
  if (difficulty === 'NEXUS-5') timeLimit = 2000;
  if (difficulty === 'NEXUS-7') timeLimit = 4000;

  try {
    // WASM call now returns AnalysisResult object
    const resultObj: any = engine.get_best_move(flatBoard, true, timeLimit);
    
    // Type assertion and validation
    if (!resultObj || !resultObj.best_move) {
        throw new Error("Invalid result from WASM engine");
    }

    const result = resultObj as WasmAnalysisResult;
    const best = result.best_move!;

    // Print detailed developer logs
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
    console.error("WASM Engine Error:", e);
    return null;
  }
}