//! Endgame Solver for ISOLATION - Optimized WASM Version
//!
//! When the board is partitioned, the game becomes a "longest path" problem.
//! This module calculates the optimal moves to maximize the number of moves
//! before running out of space.
//!
//! Uses bitboard-based DFS with MEMOIZATION (DP) for perfect play.
//!
//! Based on TypeScript endgameSolver.ts

use crate::board::{GameState, Move};
use crate::bitboard::*;
use crate::partition::*;
use std::collections::HashMap;

/// Endgame solver result
pub struct EndgameResult {
    pub best_move: Option<Move>,
    pub longest_path: i32,
    pub solved: bool,
    pub confidence: EndgameConfidence,
}

#[derive(Debug, PartialEq)]
pub enum EndgameConfidence {
    Exact,      // Computed exact solution
    Heuristic,  // Time limit hit, using estimate
}

/// Solve the endgame for an isolated position
///
/// Uses DP with memoization to find the longest path
pub fn solve_endgame(
    state: &GameState,
    reachable_region: u64,
    is_ai: bool,
    time_limit_ms: u32,
) -> EndgameResult {
    let start_time = js_sys::Date::now();
    let time_limit = time_limit_ms as f64;

    let position = if is_ai { state.ai } else { state.player };
    
    // Get valid moves
    let moves = state.get_valid_moves(is_ai);
    let mut best_move: Option<Move> = None;
    let mut best_path = -1;
    let mut solved = true;

    // Shared memoization cache for this solve session
    // Key: (position_index, visited_mask) -> max_remaining_path_length
    let mut memo = HashMap::new();

    for mv in moves {
        // Check timeout
        if js_sys::Date::now() - start_time > time_limit * 0.8 {
            solved = false;
            break;
        }

        let to_idx = pos_to_index(mv.to.0, mv.to.1);
        let to_mask = 1u64 << to_idx;

        // Only consider moves within our region
        if (reachable_region & to_mask) == 0 {
            continue;
        }

        // Calculate longest path from this move
        // Initial visited includes start pos and current move
        let visited = position | to_mask;
        
        // We pass the start time to checking timeout deep in recursion if needed, 
        // but for now we rely on the threshold check and outer loop timeout.
        let path_length = 1 + solve_longest_path_dp(
            to_idx,
            visited,
            reachable_region,
            &mut memo
        );

        if path_length > best_path {
            best_path = path_length;

            // Find best destroy position
            let destroy_pos = find_best_endgame_destroy(state, mv.to, reachable_region, is_ai);

            let mut final_move = mv.clone();
            final_move.destroy = destroy_pos;
            final_move.score = path_length;
            best_move = Some(final_move);
        }
    }

    EndgameResult {
        best_move,
        longest_path: best_path,
        solved,
        confidence: if solved {
            EndgameConfidence::Exact
        } else {
            EndgameConfidence::Heuristic
        },
    }
}

/// Recursive DP solver for Longest Path problem
///
/// Returns the maximum number of moves possible from `pos_idx` given `visited` mask.
fn solve_longest_path_dp(
    pos_idx: u8,
    visited: u64,
    region: u64,
    memo: &mut HashMap<(u8, u64), i32>,
) -> i32 {
    let key = (pos_idx, visited);
    if let Some(&cached) = memo.get(&key) {
        return cached;
    }

    let (r, c) = index_to_pos(pos_idx);
    
    // blocked = everything NOT in region OR already visited
    // This ensures we stay in region and don't revisit
    let blocked = (!region) | visited;
    
    let moves_bb = get_queen_moves(r, c, blocked);
    
    // Optimization: if no moves, return 0
    if moves_bb == 0 {
        return 0;
    }

    let mut best = 0;
    let mut temp = moves_bb;
    
    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        let next_mask = 1u64 << idx;
        
        let result = 1 + solve_longest_path_dp(
            idx,
            visited | next_mask,
            region,
            memo
        );
        
        if result > best {
            best = result;
        }
        
        temp &= temp - 1;
    }

    memo.insert(key, best);
    best
}

/// Find the best destroy position in endgame
///
/// Prioritizes destroying cells outside our reachable region
fn find_best_endgame_destroy(
    state: &GameState,
    new_pos: (u8, u8),
    reachable_region: u64,
    is_ai: bool,
) -> (u8, u8) {
    let other_pos_bb = if is_ai { state.player } else { state.ai };
    let other_idx = other_pos_bb.trailing_zeros() as u8;
    let other_pos = index_to_pos(other_idx);

    let new_pos_mask = pos_to_mask(new_pos.0, new_pos.1);
    let occupied = state.destroyed | state.player | state.ai | new_pos_mask;
    let full_board = (1u64 << CELL_COUNT) - 1;
    let empty = full_board & !occupied;

    let mut best_destroy = (0, 0);
    let mut best_score = i32::MIN;

    let mut temp = empty;
    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        let pos = index_to_pos(idx);
        let pos_mask = 1u64 << idx;

        let mut score = 0;

        // Strongly prefer destroying cells outside our region
        if (reachable_region & pos_mask) == 0 {
            score += 200;
        }

        // Prefer cells far from our new position
        let dist = (pos.0 as i32 - new_pos.0 as i32).abs() +
                   (pos.1 as i32 - new_pos.1 as i32).abs();
        score += dist * 5;

        // Prefer cells closer to opponent
        let opp_dist = (pos.0 as i32 - other_pos.0 as i32).abs() +
                      (pos.1 as i32 - other_pos.1 as i32).abs();
        score += (10 - opp_dist) * 3;

        if score > best_score {
            best_score = score;
            best_destroy = pos;
        }

        temp &= temp - 1;
    }

    best_destroy
}

/// Quick estimate of longest path using cell count
pub fn estimate_longest_path(cell_count: i32) -> i32 {
    // Heuristic: cells * efficiency factor
    // Compact regions allow more efficient paths
    (cell_count as f32 * 0.75) as i32
}

/// Determine if position is worth solving exactly
pub fn should_solve_exactly(cell_count: i32) -> bool {
    // For regions up to 25 cells, we can usually solve exactly using DP
    // This allows perfect play in late midgame/endgame
    cell_count <= 25
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_longest_path_simple() {
        // Simple 3-cell path
        let mut memo = HashMap::new();
        let start_pos_idx = pos_to_index(0, 0);
        let mut reachable = 0u64;
        reachable |= 1u64 << pos_to_index(0, 0);
        reachable |= 1u64 << pos_to_index(0, 1);
        reachable |= 1u64 << pos_to_index(0, 2);

        let visited = 1u64 << pos_to_index(0, 0);

        let result = solve_longest_path_dp(start_pos_idx, visited, reachable, &mut memo);

        // Should be able to reach 2 more cells
        assert_eq!(result, 2);
    }

    #[test]
    fn test_should_solve_exactly() {
        assert!(should_solve_exactly(10));
        assert!(should_solve_exactly(25));
        assert!(!should_solve_exactly(26));
    }
}

