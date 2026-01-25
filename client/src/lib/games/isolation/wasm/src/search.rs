use crate::board::{GameState, Move};
use crate::eval::{evaluate, evaluate_advanced, EvalWeights};
use crate::bitboard::*;
use crate::voronoi::*;
use crate::partition::*;

pub struct SearchConfig {
    pub max_depth: u8,
    pub time_limit_ms: u32,
}

pub fn find_best_move(state: &GameState, config: SearchConfig) -> Option<Move> {
    let mut best_move = None;
    let mut _best_score = -1_000_000;
    
    let start_time = js_sys::Date::now();
    let time_limit = config.time_limit_ms as f64;
    
    // Iterative Deepening
    for depth in 1..=config.max_depth {
        // Quick check before starting next depth
        if js_sys::Date::now() - start_time > time_limit {
            break;
        }

        let (m, score) = alpha_beta(state, depth, -1_000_000, 1_000_000, true, start_time, time_limit);
        
        // Use result only if we finished (or return partial best?)
        // If we timeout inside alpha_beta, the result might be incomplete (-100_000).
        // Standard ID: Always keep result from previous completed depth.
        // If this depth finished validly (score > -infinity), update.
        // But if time ran out, 'm' might be None or partial.
        
        // For simplicity: If m is Some, take it.
        // We need alpha_beta to return a "Timeout" flag or signal.
        if let Some(mv) = m {
             best_move = Some(mv);
             _best_score = score;
        }
        
        // Re-check time to break loop
        if js_sys::Date::now() - start_time > time_limit {
            break;
        }
    }
    
    best_move
}

fn alpha_beta(
    state: &GameState, 
    depth: u8, 
    mut alpha: i32, 
    beta: i32, 
    maximizing: bool,
    start_time: f64,
    time_limit: f64
) -> (Option<Move>, i32) {
    // Periodically check time (every 1024 nodes? Or just every node for now since JS date is fast enough?)
    // JS Date.now() is a syscall in WASM? Might be slow.
    // Let's check every branch.
    
    // Optimization: Only check if depth > 2?
    if js_sys::Date::now() - start_time > time_limit {
        return (None, if maximizing { -1_000_000 } else { 1_000_000 }); // Return bad score to abort
    }

    if depth == 0 {
        let score = evaluate(state);
        return (None, if maximizing { score } else { -score });
    }

    let moves = state.get_valid_moves(maximizing);
    
    if moves.is_empty() {
        return (None, -100_000 + (20 - depth as i32));
    }

    let mut best_move = None;
    let mut max_score = -1_000_000;

    for mut mv in moves {
        let target_positions = get_destroy_candidates(state, &mv, maximizing);
        
        for destroy_pos in target_positions {
            // Check time inside inner loop (critical for high branching factor)
            if js_sys::Date::now() - start_time > time_limit {
                return (best_move, max_score); // Return best we have so far
            }

            mv.destroy = destroy_pos;
            
            let mut new_state = *state;
            if maximizing {
                new_state.ai = pos_to_mask(mv.to.0, mv.to.1);
            } else {
                new_state.player = pos_to_mask(mv.to.0, mv.to.1);
            }
            new_state.destroyed |= pos_to_mask(destroy_pos.0, destroy_pos.1);
            
            let (_, val) = alpha_beta(&new_state, depth - 1, -beta, -alpha, !maximizing, start_time, time_limit);
            let score = -val;

            if score > max_score {
                max_score = score;
                best_move = Some(mv.clone());
            }
            
            if score > alpha {
                alpha = score;
                if alpha >= beta {
                    break; 
                }
            }
        }
        
        if alpha >= beta {
            break;
        }
    }

    (best_move, max_score)
}

/// Advanced destroy candidate selection with strategic scoring
///
/// Scores ALL destroy positions based on:
/// 1. CHECKMATE DETECTION (10,000 points for blocking last move)
/// 2. PARTITION CREATION (huge value for advantageous splits)
/// 3. Blocking opponent moves
/// 4. Voronoi territory impact
/// 5. Center control
/// 6. Avoid blocking own moves
///
/// Returns top 6-8 candidates (configurable by difficulty)
fn get_destroy_candidates_advanced(
    state: &GameState,
    mv: &Move,
    maximizing: bool,
    candidate_count: usize,
) -> Vec<(u8, u8)> {
    let occupied = state.destroyed | state.player | state.ai | pos_to_mask(mv.to.0, mv.to.1);

    let target_pos = if maximizing { state.player } else { state.ai };
    let target_idx = target_pos.trailing_zeros() as u8;
    let (tr, tc) = index_to_pos(target_idx);

    let our_new_pos = mv.to;

    // Get opponent's current mobility
    let target_mobility = get_queen_moves(tr, tc, occupied);

    // Get all empty positions
    let full_board = (1u64 << CELL_COUNT) - 1;
    let empty = full_board & !occupied;

    // Score ALL empty positions using stack allocation to avoid heap overhead
    let mut candidates = [((0u8, 0u8), 0i32); 49];
    let mut count = 0;

    let mut temp = empty;
    while temp != 0 {
        let lowest_bit = temp & temp.wrapping_neg();
        let idx = lowest_bit.trailing_zeros() as u8;
        let pos = index_to_pos(idx);

        let score = score_destroy_position(state, pos, target_mobility, our_new_pos, (tr, tc), maximizing);
        
        candidates[count] = (pos, score);
        count += 1;

        temp &= temp - 1;
    }

    // Sort only the valid portion using unstable sort (faster, no alloc)
    let valid_slice = &mut candidates[0..count];
    valid_slice.sort_unstable_by(|a, b| b.1.cmp(&a.1));

    // Take top N candidates
    valid_slice.iter()
        .take(candidate_count)
        .map(|(pos, _score)| *pos)
        .collect()
}

/// Score a destroy position based on multiple strategic factors
fn score_destroy_position(
    state: &GameState,
    pos: (u8, u8),
    target_mobility: u64,
    our_new_pos: (u8, u8),
    opponent_pos: (u8, u8),
    maximizing: bool,
) -> i32 {
    let mut score = 0;

    let pos_idx = pos_to_index(pos.0, pos.1);
    let pos_mask = 1u64 << pos_idx;

    // 1. CHECKMATE DETECTION (10,000 points for winning move!)
    let blocks_opponent = (target_mobility & pos_mask) != 0;
    if blocks_opponent {
        let opponent_move_count = count_ones(target_mobility);
        if opponent_move_count == 1 {
            score += 10_000; // WINNING MOVE: Last opponent move
        } else {
            score += 50; // Standard blocking
        }
    }

    // 2. Adjacent to opponent (Pressure)
    let dist_to_opponent = manhattan_distance(pos, opponent_pos);
    if dist_to_opponent == 1 {
        score += 30;
    } else if dist_to_opponent == 2 {
        score += 15;
    }

    // 3. Don't block our own future moves (Critical Survival)
    let dist_to_self = manhattan_distance(pos, our_new_pos);
    if dist_to_self == 1 {
        score -= 50;
    }

    // 4. Center control
    let center_dist = (pos.0 as i32 - 3).abs() + (pos.1 as i32 - 3).abs();
    score += (6 - center_dist) * 2;

    // Note: Expensive Partition and Voronoi checks removed for performance (NPS).
    // These are evaluated at leaf nodes.

    score
}

/// Manhattan distance between two positions
fn manhattan_distance(a: (u8, u8), b: (u8, u8)) -> i32 {
    (a.0 as i32 - b.0 as i32).abs() + (a.1 as i32 - b.1 as i32).abs()
}

/// Legacy simple destroy candidates (fallback)
fn get_destroy_candidates(state: &GameState, mv: &Move, maximizing: bool) -> Vec<(u8, u8)> {
    // Use advanced version with default candidate count
    get_destroy_candidates_advanced(state, mv, maximizing, 6)
}

/// Export for use in search_advanced module
pub fn get_destroy_candidates_advanced_export(
    state: &GameState,
    mv: &Move,
    maximizing: bool,
    candidate_count: usize,
) -> Vec<(u8, u8)> {
    get_destroy_candidates_advanced(state, mv, maximizing, candidate_count)
}
