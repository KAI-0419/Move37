//! Advanced Search with Transposition Table, Killer Moves, and History Heuristic
//!
//! This module provides sophisticated alpha-beta search with:
//! - Transposition table for position caching (30-50% speedup)
//! - Killer move heuristic for better move ordering
//! - History heuristic for move prioritization
//! - PV (Principal Variation) move ordering

use crate::board::{GameState, Move};
use crate::eval::{evaluate_advanced, EvalWeights};
use crate::bitboard::*;
use crate::transposition::{TranspositionTable, Bound};

/// Killer moves heuristic
///
/// Stores moves that caused beta cutoffs at each depth.
/// These moves are likely to be good in similar positions.
struct KillerMoves {
    // [depth][slot] - store 2 killer moves per depth
    primary: [[Option<Move>; 2]; 32],
}

impl KillerMoves {
    fn new() -> Self {
        KillerMoves {
            primary: [[None; 2]; 32],
        }
    }

    fn record(&mut self, depth: usize, mv: Move) {
        if depth >= 32 {
            return;
        }

        // Don't record if already in primary slot 0
        if let Some(existing) = self.primary[depth][0] {
            if moves_equal(&existing, &mv) {
                return;
            }
        }

        // Shift: slot 0 -> slot 1, new move -> slot 0
        self.primary[depth][1] = self.primary[depth][0];
        self.primary[depth][0] = Some(mv);
    }

    fn is_killer(&self, depth: usize, mv: &Move) -> bool {
        if depth >= 32 {
            return false;
        }

        self.primary[depth].iter().any(|killer| {
            if let Some(k) = killer {
                moves_equal(k, mv)
            } else {
                false
            }
        })
    }

    fn clear(&mut self) {
        self.primary = [[None; 2]; 32];
    }
}

/// History heuristic table
///
/// Tracks successful moves across the entire search tree.
/// Moves that cause cutoffs get higher scores.
struct HistoryTable {
    // [from_idx][to_idx] -> score
    scores: [[i32; 49]; 49],
}

impl HistoryTable {
    fn new() -> Self {
        HistoryTable {
            scores: [[0; 49]; 49],
        }
    }

    fn record(&mut self, from_idx: usize, to_idx: usize, depth: u8) {
        if from_idx >= 49 || to_idx >= 49 {
            return;
        }

        // Moves that cause cutoffs at deeper depths are more valuable
        let bonus = (depth as i32) * (depth as i32);
        self.scores[from_idx][to_idx] += bonus;
    }

    fn get_score(&self, from_idx: usize, to_idx: usize) -> i32 {
        if from_idx >= 49 || to_idx >= 49 {
            return 0;
        }
        self.scores[from_idx][to_idx]
    }

    fn clear(&mut self) {
        self.scores = [[0; 49]; 49];
    }
}

/// Advanced search configuration
pub struct AdvancedSearchConfig {
    pub max_depth: u8,
    pub time_limit_ms: u32,
    pub weights: EvalWeights,
    pub use_tt: bool,
    pub use_killer_moves: bool,
    pub use_history: bool,
}

impl AdvancedSearchConfig {
    pub fn for_difficulty(difficulty: &str, time_limit_ms: u32) -> Self {
        let (max_depth, weights) = match difficulty {
            "NEXUS-7" => (10, EvalWeights::nexus_7()),
            "NEXUS-5" => (7, EvalWeights::nexus_5()),
            "NEXUS-3" => (5, EvalWeights::nexus_3()),
            _ => (7, EvalWeights::nexus_5()),
        };

        AdvancedSearchConfig {
            max_depth,
            time_limit_ms,
            weights,
            use_tt: true,
            use_killer_moves: true,
            use_history: true,
        }
    }
}

/// Find best move using advanced search
pub fn find_best_move_advanced(state: &GameState, config: AdvancedSearchConfig) -> Option<Move> {
    let mut tt = TranspositionTable::new();
    let mut killers = KillerMoves::new();
    let mut history = HistoryTable::new();

    let mut best_move = None;
    let mut _best_score = -1_000_000;

    let start_time = js_sys::Date::now();
    let time_limit = config.time_limit_ms as f64;

    // Iterative Deepening
    for depth in 1..=config.max_depth {
        if js_sys::Date::now() - start_time > time_limit {
            break;
        }

        let hash = if config.use_tt {
            tt.compute_hash(state, true)
        } else {
            0
        };

        let (m, score) = alpha_beta_advanced(
            state,
            depth,
            -1_000_000,
            1_000_000,
            true,
            &config,
            &mut tt,
            &mut killers,
            &mut history,
            hash,
            start_time,
            time_limit,
        );

        if let Some(mv) = m {
            best_move = Some(mv);
            _best_score = score;
        }

        if js_sys::Date::now() - start_time > time_limit {
            break;
        }
    }

    // Log statistics
    if config.use_tt && (tt.hits + tt.misses) > 0 {
        let hit_rate = tt.hit_rate() * 100.0;
        web_sys::console::log_1(&format!(
            "TT: {} entries, {:.1}% hit rate ({} hits / {} total)",
            tt.size(),
            hit_rate,
            tt.hits,
            tt.hits + tt.misses
        ).into());
    }

    best_move
}

/// Advanced alpha-beta search with all optimizations
#[allow(clippy::too_many_arguments)]
fn alpha_beta_advanced(
    state: &GameState,
    depth: u8,
    mut alpha: i32,
    beta: i32,
    maximizing: bool,
    config: &AdvancedSearchConfig,
    tt: &mut TranspositionTable,
    killers: &mut KillerMoves,
    history: &mut HistoryTable,
    hash: u64,
    start_time: f64,
    time_limit: f64,
) -> (Option<Move>, i32) {
    // Check timeout
    if js_sys::Date::now() - start_time > time_limit {
        return (None, if maximizing { -1_000_000 } else { 1_000_000 });
    }

    // Probe transposition table
    if config.use_tt {
        if let Some(entry) = tt.probe(hash, depth, alpha, beta) {
            // If we have an exact score at sufficient depth, use it
            if entry.depth >= depth && entry.bound == Bound::Exact {
                return (entry.best_move.clone(), entry.score);
            }
            // Check for alpha/beta cutoffs
            if entry.depth >= depth {
                match entry.bound {
                    Bound::Lower if entry.score >= beta => {
                        return (entry.best_move.clone(), entry.score);
                    }
                    Bound::Upper if entry.score <= alpha => {
                        return (entry.best_move.clone(), entry.score);
                    }
                    _ => {}
                }
            }
        }
    }

    // Leaf node - evaluate
    if depth == 0 {
        let (score, _) = evaluate_advanced(state, &config.weights);
        let final_score = if maximizing { score } else { -score };
        return (None, final_score);
    }

    // Generate moves
    let moves = state.get_valid_moves(maximizing);

    if moves.is_empty() {
        // Game over - this side loses
        return (None, -100_000 + (20 - depth as i32));
    }

    let mut best_move = None;
    let mut max_score = -1_000_000;
    let original_alpha = alpha;

    // Order moves for better alpha-beta pruning
    let ordered_moves = order_moves(
        moves,
        state,
        tt,
        killers,
        history,
        hash,
        depth,
        maximizing,
        config,
    );

    for mut mv in ordered_moves {
        let destroy_candidates = get_destroy_candidates_advanced(state, &mv, maximizing, 6);

        for destroy_pos in destroy_candidates {
            if js_sys::Date::now() - start_time > time_limit {
                return (best_move, max_score);
            }

            mv.destroy = destroy_pos;

            // Make move
            let mut new_state = *state;
            if maximizing {
                new_state.ai = pos_to_mask(mv.to.0, mv.to.1);
            } else {
                new_state.player = pos_to_mask(mv.to.0, mv.to.1);
            }
            new_state.destroyed |= pos_to_mask(destroy_pos.0, destroy_pos.1);

            // Compute new hash (incremental update would be faster, but correct hash first)
            let new_hash = if config.use_tt {
                tt.compute_hash(&new_state, !maximizing)
            } else {
                0
            };

            // Recursive search
            let (_, val) = alpha_beta_advanced(
                &new_state,
                depth - 1,
                -beta,
                -alpha,
                !maximizing,
                config,
                tt,
                killers,
                history,
                new_hash,
                start_time,
                time_limit,
            );
            let score = -val;

            if score > max_score {
                max_score = score;
                best_move = Some(mv.clone());
            }

            if score > alpha {
                alpha = score;
                if alpha >= beta {
                    // Beta cutoff - record killer move and history
                    if config.use_killer_moves {
                        killers.record(depth as usize, mv.clone());
                    }
                    if config.use_history {
                        let from_idx = pos_to_index(mv.from.0, mv.from.1) as usize;
                        let to_idx = pos_to_index(mv.to.0, mv.to.1) as usize;
                        history.record(from_idx, to_idx, depth);
                    }
                    break;
                }
            }
        }

        if alpha >= beta {
            break;
        }
    }

    // Store in transposition table
    if config.use_tt {
        let bound = if max_score <= original_alpha {
            Bound::Upper
        } else if max_score >= beta {
            Bound::Lower
        } else {
            Bound::Exact
        };

        tt.store(hash, depth, max_score, bound, best_move.clone());
    }

    (best_move, max_score)
}

/// Order moves for optimal alpha-beta pruning
#[allow(clippy::too_many_arguments)]
fn order_moves(
    moves: Vec<Move>,
    state: &GameState,
    tt: &TranspositionTable,
    killers: &KillerMoves,
    history: &HistoryTable,
    hash: u64,
    depth: u8,
    maximizing: bool,
    config: &AdvancedSearchConfig,
) -> Vec<Move> {
    let mut scored_moves: Vec<(Move, i32)> = moves
        .into_iter()
        .map(|mv| {
            let mut score = 0;

            // 1. PV Move from transposition table (highest priority)
            if config.use_tt {
                if let Some(entry) = tt.table.get(&hash) {
                    if let Some(pv_move) = &entry.best_move {
                        if moves_equal(pv_move, &mv) {
                            score += 100_000;
                        }
                    }
                }
            }

            // 2. Killer moves
            if config.use_killer_moves && killers.is_killer(depth as usize, &mv) {
                score += 9_000;
            }

            // 3. History heuristic
            if config.use_history {
                let from_idx = pos_to_index(mv.from.0, mv.from.1) as usize;
                let to_idx = pos_to_index(mv.to.0, mv.to.1) as usize;
                score += history.get_score(from_idx, to_idx);
            }

            // 4. Winning move detection (quick check)
            let occupied = state.destroyed | state.player | state.ai | pos_to_mask(mv.to.0, mv.to.1);
            let opp_pos = if maximizing { state.player } else { state.ai };
            let opp_idx = opp_pos.trailing_zeros() as u8;
            let (opp_r, opp_c) = index_to_pos(opp_idx);
            let opp_moves = get_queen_moves(opp_r, opp_c, occupied);

            if count_ones(opp_moves) == 0 {
                score += 50_000; // Immediate winning move
            }

            (mv, score)
        })
        .collect();

    // Sort descending by score
    scored_moves.sort_by(|a, b| b.1.cmp(&a.1));

    scored_moves.into_iter().map(|(mv, _)| mv).collect()
}

/// Compare two moves for equality (ignoring destroy and score fields)
fn moves_equal(a: &Move, b: &Move) -> bool {
    a.from == b.from && a.to == b.to
}

/// Advanced destroy candidate selection (imported from main search)
fn get_destroy_candidates_advanced(
    state: &GameState,
    mv: &Move,
    maximizing: bool,
    candidate_count: usize,
) -> Vec<(u8, u8)> {
    // Use the sophisticated destroy selection from search.rs
    crate::search::get_destroy_candidates_advanced_export(state, mv, maximizing, candidate_count)
}
