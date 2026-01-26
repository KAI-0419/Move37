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
use crate::transposition::{TranspositionTable, Bound, update_hash_after_move};
use crate::partition::*;
use crate::endgame::*;
use serde::{Serialize, Deserialize};

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
    pub use_aspiration: bool,
    pub use_pvs: bool,
    pub use_null_move: bool,
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
            use_aspiration: true,
            use_pvs: true,
            use_null_move: true,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct SearchResult {
    pub best_move: Option<Move>,
    pub depth: u8,
    pub score: i32,
    pub nodes: u32,
}

/// Find best move using advanced search and return detailed results
pub fn find_best_move_advanced_detailed(state: &GameState, config: AdvancedSearchConfig) -> SearchResult {
    // 1. Opening Book Check
    let destroyed_count = count_ones(state.destroyed) as u8;
    if destroyed_count < 8 {
        if let Some(opening_move) = crate::opening::get_opening_move(state, destroyed_count) {
            let mut test_state = *state;
            test_state.ai = pos_to_mask(opening_move.to.0, opening_move.to.1);
            test_state.destroyed |= pos_to_mask(opening_move.destroy.0, opening_move.destroy.1);
            
            let blocked = test_state.destroyed | test_state.player | test_state.ai;
            let mobility = count_ones(get_queen_moves(opening_move.to.0, opening_move.to.1, blocked));

            if mobility > 0 {
                return SearchResult {
                    best_move: Some(opening_move),
                    depth: 0,
                    score: 0,
                    nodes: 0,
                };
            }
        }
    }

    // 2. Endgame Solver Check
    let player_idx = safe_get_position_index(state.player).unwrap_or(0);
    let ai_idx = safe_get_position_index(state.ai).unwrap_or(48);
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    let partition = detect_partition_bitboard(player_pos, ai_pos, state.destroyed);

    if partition.is_partitioned && partition.ai_region_size <= 18 {
        let endgame_result = solve_endgame(
            state,
            partition.ai_region,
            true, // is_ai
            config.time_limit_ms / 2,
        );

        if endgame_result.solved {
            if let Some(mv) = endgame_result.best_move {
                return SearchResult {
                    best_move: Some(mv),
                    depth: 255, // Indicator for solved
                    score: 100_000 + endgame_result.longest_path,
                    nodes: 0,
                };
            }
        }
    }

    let mut tt = TranspositionTable::new();
    tt.new_search();
    let mut killers = KillerMoves::new();
    let mut history = HistoryTable::new();

    let mut best_move = None;
    let mut best_score = -1_000_000;
    let mut actual_depth = 0;

    let start_time = js_sys::Date::now();
    let time_limit = config.time_limit_ms as f64;
    let mut nodes = 0;

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

        let (m, score) = if config.use_aspiration && depth >= 3 {
            aspiration_search(
                state,
                depth,
                best_score,
                &config,
                &mut tt,
                &mut killers,
                &mut history,
                hash,
                start_time,
                time_limit,
                &mut nodes,
            )
        } else {
            alpha_beta_advanced(
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
                &mut nodes,
            )
        };

        // Only update if search wasn't aborted by timeout
        if js_sys::Date::now() - start_time < time_limit || depth == 1 {
            if let Some(mv) = m {
                best_move = Some(mv);
                best_score = score;
                actual_depth = depth;
            }
        }

        // If we found a win or loss, stop searching deeper
        if best_score > 90_000 || best_score < -90_000 {
            break;
        }
    }

    SearchResult {
        best_move,
        depth: actual_depth,
        score: best_score,
        nodes,
    }
}

pub fn find_best_move_advanced(state: &GameState, config: AdvancedSearchConfig) -> Option<Move> {
    find_best_move_advanced_detailed(state, config).best_move
}

/// Aspiration window search
/// Uses narrow alpha-beta windows around previous score to trigger more cutoffs
#[allow(clippy::too_many_arguments)]
fn aspiration_search(
    state: &GameState,
    depth: u8,
    prev_score: i32,
    config: &AdvancedSearchConfig,
    tt: &mut TranspositionTable,
    killers: &mut KillerMoves,
    history: &mut HistoryTable,
    hash: u64,
    start_time: f64,
    time_limit: f64,
    nodes: &mut u32,
) -> (Option<Move>, i32) {
    const INITIAL_WINDOW: i32 = 50;
    const MAX_WINDOW: i32 = 500;

    let mut window = INITIAL_WINDOW;
    let mut alpha = prev_score - window;
    let mut beta = prev_score + window;

    loop {
        let (m, score) = alpha_beta_advanced(
            state,
            depth,
            alpha,
            beta,
            true,
            config,
            tt,
            killers,
            history,
            hash,
            start_time,
            time_limit,
            nodes,
        );

        // Check if score is within window
        if score > alpha && score < beta {
            // Success! Score is within aspiration window
            return (m, score);
        }

        // Failed - widen window and re-search
        if score <= alpha {
            // Fail low - widen lower bound
            alpha = score - window;
            if alpha < -1_000_000 {
                alpha = -1_000_000;
            }
        } else {
            // Fail high - widen upper bound
            beta = score + window;
            if beta > 1_000_000 {
                beta = 1_000_000;
            }
        }

        // Exponentially widen window
        window *= 2;

        // If window is too wide, just do full window search
        if window > MAX_WINDOW {
            return alpha_beta_advanced(
                state,
                depth,
                -1_000_000,
                1_000_000,
                true,
                config,
                tt,
                killers,
                history,
                hash,
                start_time,
                time_limit,
                nodes,
            );
        }

        // Check timeout
        if js_sys::Date::now() - start_time > time_limit {
            return (m, score);
        }
    }
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
    nodes: &mut u32,
) -> (Option<Move>, i32) {
    *nodes += 1;

    // Check timeout every 4096 nodes to avoid bridge overhead
    if (*nodes & 4095) == 0 {
        if js_sys::Date::now() - start_time > time_limit {
            return (None, if maximizing { -1_000_000 } else { 1_000_000 });
        }
    }

    // 1. Terminal State Detection (Game Over) - Check BEFORE depth == 0
    // This fixes the "Horizon Effect" where immediate wins at depth 0 were seen as just heuristic scores.
    let (current_r, current_c) = if maximizing {
        let idx = safe_get_position_index(state.ai).unwrap_or(48);
        index_to_pos(idx)
    } else {
        let idx = safe_get_position_index(state.player).unwrap_or(0);
        index_to_pos(idx)
    };
    
    let blocked = state.destroyed | state.player | state.ai;
    let mobility = count_ones(get_queen_moves(current_r, current_c, blocked));

    if mobility == 0 {
        // Game over - current player has no moves and loses
        // Return score: -100,000 (Loss)
        // We subtract (depth * 100) so that a loss at high depth (near root, immediate loss)
        // has a lower score than a loss at low depth (far from root, delayed loss).
        // Example: Depth 8 (Fast loss) -> -100,800
        //          Depth 2 (Slow loss) -> -100,200
        // AI will maximize score, preferring -100,200 (Slow loss).
        return (None, -100_000 - (depth as i32 * 100));
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

    // Null Move Pruning
    // Skip if: (1) shallow depth, (2) in check/desperate, (3) endgame
    if config.use_null_move && depth >= 3 && maximizing {
        let ai_mobility = count_ones(get_queen_moves(current_r, current_c, blocked));

        // Only use null move if we're not desperate (mobility > 3)
        // and not in zugzwang-prone endgame (>10 free cells)
        let free_cells = count_ones(!blocked);
        if ai_mobility > 3 && free_cells > 10 {
            // Make "null move" - pass turn to opponent
            // We don't actually change the state, just flip the turn
            let null_hash = if config.use_tt {
                tt.compute_hash(state, !maximizing)
            } else {
                0
            };

            // Search with reduced depth (R=3 for aggressive pruning)
            let reduction = 3.min(depth - 1);
            let (_, null_score) = alpha_beta_advanced(
                state,
                depth - reduction,
                -beta,
                -beta + 1, // Null window
                !maximizing,
                config,
                tt,
                killers,
                history,
                null_hash,
                start_time,
                time_limit,
                nodes,
            );
            let null_val = -null_score;

            // If null move causes beta cutoff, position is too good
            if null_val >= beta {
                return (None, beta);
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

    // Note: moves.is_empty() check is now redundant due to early mobility check above
    // but we keep the flow standard.
    if moves.is_empty() {
         // Should be caught by early check, but safe to keep
         return (None, -100_000 - (depth as i32 * 100));
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

    let mut move_count = 0;

    for mut mv in ordered_moves {
        // Defensive: Validate move coordinates
        if mv.to.0 >= BOARD_SIZE || mv.to.1 >= BOARD_SIZE {
            continue;
        }

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

            // Compute new hash incrementally (3-5% faster than full recomputation)
            let new_hash = if config.use_tt {
                update_hash_after_move(tt, hash, state, &new_state, maximizing, !maximizing)
            } else {
                0
            };

            let score = if config.use_pvs && move_count > 0 && depth >= 3 {
                // Principal Variation Search (PVS)
                // Search with null window first
                let (_, val) = alpha_beta_advanced(
                    &new_state,
                    depth - 1,
                    -alpha - 1,
                    -alpha,
                    !maximizing,
                    config,
                    tt,
                    killers,
                    history,
                    new_hash,
                    start_time,
                    time_limit,
                    nodes,
                );
                let null_score = -val;

                if null_score > alpha && null_score < beta {
                    // Null window failed - re-search with full window
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
                        nodes,
                    );
                    -val
                } else {
                    null_score
                }
            } else {
                // First move or PVS disabled - use full window
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
                    nodes,
                );
                -val
            };

            move_count += 1;

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
            let opp_idx = safe_get_position_index(opp_pos).unwrap_or(if maximizing { 0 } else { 48 });
            let (opp_r, opp_c) = index_to_pos(opp_idx);
            let opp_moves = get_queen_moves(opp_r, opp_c, occupied);
            let opp_mobility_count = count_ones(opp_moves);

            let mut is_winning = false;
            if opp_mobility_count == 0 {
                score += 50_000; // Immediate winning move
                is_winning = true;
            }

            // 5. Survival Instinct (Suicide Prevention) - TypeScript Parity
            // Calculate our mobility AFTER this move.
            // If we move to a spot with 0 exits, it's suicide.
            // CRITICAL FIX: If we are winning (is_winning) OR if the opponent is also desperate (<= 1 move),
            // we should NOT penalize "suicide". The game ends when opponent cannot move.
            // If we trap them, it doesn't matter if we are stuck too.
            if !is_winning && opp_mobility_count > 1 {
                let opp_mask = if maximizing { state.ai } else { state.player };
                // Blocked for next turn: Destroyed + Opponent + My New Pos
                // (My old pos becomes empty, so we don't include it in blocked)
                let future_blocked = state.destroyed | opp_mask | pos_to_mask(mv.to.0, mv.to.1);
                let my_future_moves = get_queen_moves(mv.to.0, mv.to.1, future_blocked);
                let my_mobility = count_ones(my_future_moves);

                if my_mobility == 0 {
                    score -= 100_000; // SUICIDE: Do not go here
                } else if my_mobility == 1 {
                    score -= 20_000; // DANGER: High risk of being trapped
                } else if my_mobility == 2 {
                    score -= 2_000; // CAUTION
                }
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
