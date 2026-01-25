mod board;
mod bitboard;
mod eval;
mod search;
mod search_advanced;
mod endgame;
mod opening;
mod voronoi;
mod partition;
mod transposition;

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use board::GameState;
use search::SearchConfig;
use eval::EvalWeights;

// Enable console error panic hook for better debugging in browser
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct IsolationEngine {
    state: GameState,
}

#[wasm_bindgen]
impl IsolationEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            state: GameState::new(),
        }
    }

    pub fn from_state(player_r: u8, player_c: u8, ai_r: u8, ai_c: u8, destroyed: &[u8]) -> Self {
        Self {
            state: GameState::from_raw(player_r, player_c, ai_r, ai_c, destroyed),
        }
    }

    pub fn get_best_move(&self, depth: u8, time_limit_ms: u32) -> JsValue {
        let config = SearchConfig {
            max_depth: depth,
            time_limit_ms,
        };

        let best_move = search::find_best_move(&self.state, config);
        serde_wasm_bindgen::to_value(&best_move).unwrap()
    }

    /// Advanced AI with difficulty-specific evaluation weights
    /// Uses transposition table, killer moves, and history heuristic
    pub fn get_best_move_advanced(&self, difficulty: &str, time_limit_ms: u32) -> JsValue {
        let config = search_advanced::AdvancedSearchConfig::for_difficulty(difficulty, time_limit_ms);
        let best_move = search_advanced::find_best_move_advanced(&self.state, config);
        serde_wasm_bindgen::to_value(&best_move).unwrap()
    }

    /// Evaluate current position with advanced evaluation
    pub fn evaluate_position(&self, difficulty: &str) -> i32 {
        let weights = match difficulty {
            "NEXUS-7" => EvalWeights::nexus_7(),
            "NEXUS-5" => EvalWeights::nexus_5(),
            "NEXUS-3" => EvalWeights::nexus_3(),
            _ => EvalWeights::nexus_5(),
        };

        let (score, _components) = eval::evaluate_advanced(&self.state, &weights);
        score
    }
}
