//! Endgame Solver for ISOLATION - Optimized WASM Version
//!
//! When the board is partitioned, the game becomes a "longest path" problem.
//! This module calculates the optimal moves to maximize the number of moves
//! before running out of space.
//!
//! Uses bitboard-based DFS with iterative approach for efficiency.
//!
//! Based on TypeScript endgameSolver.ts

use crate::board::{GameState, Move};
use crate::bitboard::*;
use crate::partition::*;

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
/// Uses iterative DFS to find the longest path from current position
pub fn solve_endgame(
    state: &GameState,
    reachable_region: u64,
    is_ai: bool,
    time_limit_ms: u32,
) -> EndgameResult {
    let start_time = js_sys::Date::now();
    let time_limit = time_limit_ms as f64;

    let position = if is_ai { state.ai } else { state.player };
    let other_pos = if is_ai { state.player } else { state.ai };

    let pos_idx = position.trailing_zeros() as u8;
    let current_pos = index_to_pos(pos_idx);

    // Get valid moves
    let moves = state.get_valid_moves(is_ai);
    let mut best_move: Option<Move> = None;
    let mut best_path = -1;
    let mut solved = true;

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
        let visited = position | to_mask;
        let remaining_time = (time_limit - (js_sys::Date::now() - start_time)) as u32;

        let result = longest_path_from_position(
            mv.to,
            reachable_region,
            state.destroyed,
            visited,
            remaining_time,
        );

        let path_length = 1 + result.length;

        if result.timed_out {
            solved = false;
        }

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

/// Path calculation result
struct PathResult {
    length: i32,
    timed_out: bool,
}

/// Calculate longest path from a position using iterative DFS
fn longest_path_from_position(
    start_pos: (u8, u8),
    reachable: u64,
    blocked: u64,
    initial_visited: u64,
    time_limit_ms: u32,
) -> PathResult {
    let start_time = js_sys::Date::now();
    let time_limit = time_limit_ms as f64;

    // Stack frame for iterative DFS
    struct StackFrame {
        pos: (u8, u8),
        visited: u64,
        next_move_idx: usize,
        moves: Vec<(u8, u8)>,
        path_length: i32,
    }

    let start_idx = pos_to_index(start_pos.0, start_pos.1);
    let valid_cells = reachable;
    let move_blocked = blocked | !valid_cells;

    // Get initial moves
    let initial_moves = get_moves_from_position(start_pos, move_blocked | initial_visited, valid_cells);

    if initial_moves.is_empty() {
        return PathResult {
            length: 0,
            timed_out: false,
        };
    }

    let mut stack: Vec<StackFrame> = vec![StackFrame {
        pos: start_pos,
        visited: initial_visited,
        next_move_idx: 0,
        moves: initial_moves,
        path_length: 0,
    }];

    let mut max_length = 0;
    let mut timed_out = false;

    while let Some(frame) = stack.last_mut() {
        // Check timeout
        if js_sys::Date::now() - start_time > time_limit {
            timed_out = true;
            break;
        }

        if frame.next_move_idx >= frame.moves.len() {
            // Backtrack
            max_length = max_length.max(frame.path_length);
            stack.pop();
            continue;
        }

        let next_pos = frame.moves[frame.next_move_idx];
        frame.next_move_idx += 1;

        let next_idx = pos_to_index(next_pos.0, next_pos.1);
        let next_mask = 1u64 << next_idx;

        // Skip if already visited
        if (frame.visited & next_mask) != 0 {
            continue;
        }

        // Make move
        let new_visited = frame.visited | next_mask;
        let new_path_length = frame.path_length + 1;

        // Get next moves
        let next_moves = get_moves_from_position(next_pos, move_blocked | new_visited, valid_cells);

        if next_moves.is_empty() {
            // Dead end - update max
            max_length = max_length.max(new_path_length);
        } else {
            // Push new frame
            stack.push(StackFrame {
                pos: next_pos,
                visited: new_visited,
                next_move_idx: 0,
                moves: next_moves,
                path_length: new_path_length,
            });
        }
    }

    PathResult {
        length: max_length,
        timed_out,
    }
}

/// Get moves from a position as a Vec
fn get_moves_from_position(
    pos: (u8, u8),
    blocked: u64,
    valid_cells: u64,
) -> Vec<(u8, u8)> {
    let moves_bb = get_queen_moves(pos.0, pos.1, blocked);
    let valid_moves = moves_bb & valid_cells;

    let mut moves = Vec::new();
    let mut temp = valid_moves;

    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        moves.push(index_to_pos(idx));
        temp &= temp - 1;
    }

    moves
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
    // For regions up to 18 cells, we can usually solve exactly
    // WASM is fast enough for this
    cell_count <= 18
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_longest_path_simple() {
        // Simple 3-cell path
        let start_pos = (0, 0);
        let mut reachable = 0u64;
        reachable |= 1u64 << pos_to_index(0, 0);
        reachable |= 1u64 << pos_to_index(0, 1);
        reachable |= 1u64 << pos_to_index(0, 2);

        let blocked = 0u64;
        let visited = 1u64 << pos_to_index(0, 0);

        let result = longest_path_from_position(start_pos, reachable, blocked, visited, 1000);

        // Should be able to reach 2 more cells
        assert_eq!(result.length, 2);
        assert!(!result.timed_out);
    }

    #[test]
    fn test_should_solve_exactly() {
        assert!(should_solve_exactly(10));
        assert!(should_solve_exactly(18));
        assert!(!should_solve_exactly(20));
        assert!(!should_solve_exactly(30));
    }

    #[test]
    fn test_estimate_longest_path() {
        assert_eq!(estimate_longest_path(10), 7);
        assert_eq!(estimate_longest_path(20), 15);
    }
}

