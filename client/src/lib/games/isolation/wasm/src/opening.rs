//! Opening Book for ISOLATION AI
//!
//! Pre-computed optimal opening moves for the first 5-8 turns.
//! In Isolation, the opening phase is crucial for establishing:
//! - Center control
//! - Mobility potential
//! - Favorable partition positioning
//!
//! Based on TypeScript openingBook.ts

use crate::board::{GameState, Move};
use crate::bitboard::*;

/// Opening principles scoring weights
const CENTER_WEIGHT: i32 = 10;
const MOBILITY_WEIGHT: i32 = 5;
const CORNER_PENALTY: i32 = 15;
const EDGE_PENALTY: i32 = 5;

/// Center cells (most valuable in opening) - 3x3 center
const CENTER_CELLS: [(u8, u8); 9] = [
    (2, 2), (2, 3), (2, 4),
    (3, 2), (3, 3), (3, 4),
    (4, 2), (4, 3), (4, 4),
];

/// Get opening book move for AI
///
/// Returns None if not in opening book range (turn > 16)
pub fn get_opening_move(
    state: &GameState,
    turn_count: u8,
) -> Option<Move> {
    // Only use opening book for first 16 turns (8 AI moves)
    if turn_count > 16 {
        return None;
    }

    let moves = state.get_valid_moves(true); // AI moves
    if moves.is_empty() {
        return None;
    }

    // Score each move based on opening principles
    let mut best_move: Option<Move> = None;
    let mut best_score = i32::MIN;

    for mv in moves {
        let score = evaluate_opening_move(state, &mv, turn_count);
        if score > best_score {
            best_score = score;
            best_move = Some(mv);
        }
    }

    if let Some(mut mv) = best_move {
        // Find best destroy position for this move
        let destroy = find_best_opening_destroy(state, mv.to, turn_count);
        mv.destroy = destroy;
        mv.score = best_score;
        return Some(mv);
    }

    None
}

/// Evaluate a move based on opening principles
fn evaluate_opening_move(
    state: &GameState,
    mv: &Move,
    turn_count: u8,
) -> i32 {
    let mut score = 0;
    let to_pos = mv.to;

    // 1. Center control - crucial in opening
    let dist_to_center = ((to_pos.0 as i32 - 3).abs() + (to_pos.1 as i32 - 3).abs());
    score -= dist_to_center * CENTER_WEIGHT;

    // Bonus for being in center area
    if CENTER_CELLS.contains(&to_pos) {
        score += 20;
    }

    // 2. Avoid corners - death trap in Isolation
    let is_corner = (to_pos.0 == 0 || to_pos.0 == 6) && (to_pos.1 == 0 || to_pos.1 == 6);
    if is_corner {
        score -= CORNER_PENALTY * 3;
    }

    // 3. Avoid edges
    let is_edge = to_pos.0 == 0 || to_pos.0 == 6 || to_pos.1 == 0 || to_pos.1 == 6;
    if is_edge && !is_corner {
        score -= EDGE_PENALTY;
    }

    // 4. Mobility after move - how many cells can we reach from here?
    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;

    let mut blocked = state.destroyed;
    blocked |= 1u64 << player_idx;
    blocked |= 1u64 << ai_idx;

    let moves_from_new = get_queen_moves(to_pos.0, to_pos.1, blocked);
    score += (count_ones(moves_from_new) as i32) * MOBILITY_WEIGHT;

    // 5. Maintain strategic distance from opponent in early game
    let player_pos = index_to_pos(player_idx);
    let dist_to_opponent = (to_pos.0 as i32 - player_pos.0 as i32).abs() +
                          (to_pos.1 as i32 - player_pos.1 as i32).abs();

    if turn_count <= 6 {
        // Early opening - maintain some distance
        if dist_to_opponent < 2 {
            score -= 10; // Too close
        } else if dist_to_opponent >= 3 && dist_to_opponent <= 5 {
            score += 5; // Good strategic distance
        }
    } else {
        // Mid-opening - start being more aggressive
        if dist_to_opponent <= 4 {
            score += 3;
        }
    }

    // 6. Prefer diagonal moves (more flexible positions)
    let from_pos = mv.from;
    let is_diagonal = from_pos.0 != to_pos.0 && from_pos.1 != to_pos.1;
    if is_diagonal {
        score += 3;
    }

    // 7. Control of diagonal lines (powerful in queen movement games)
    let on_main_diagonal = to_pos.0 == to_pos.1;
    let on_anti_diagonal = to_pos.0 + to_pos.1 == 6;
    if on_main_diagonal || on_anti_diagonal {
        score += 5;
    }

    score
}

/// Find best destroy position for opening
fn find_best_opening_destroy(
    state: &GameState,
    new_pos: (u8, u8),
    _turn_count: u8,
) -> (u8, u8) {
    let player_idx = state.player.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);

    // Calculate all empty cells (potential destroy targets)
    let new_pos_mask = pos_to_mask(new_pos.0, new_pos.1);
    let occupied = state.destroyed | state.player | state.ai | new_pos_mask;
    let full_board = (1u64 << CELL_COUNT) - 1;
    let empty = full_board & !occupied;

    // Default to first available empty cell
    let mut best_destroy = if empty != 0 {
        index_to_pos(empty.trailing_zeros() as u8)
    } else {
        (0, 0) // Should be unreachable in opening phase
    };
    
    let mut best_score = i32::MIN;

    let mut temp = empty;
    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        let pos = index_to_pos(idx);

        let mut score = 0;

        // 1. Adjacent to opponent is high priority
        let dist_to_player = (pos.0 as i32 - player_pos.0 as i32).abs() +
                            (pos.1 as i32 - player_pos.1 as i32).abs();
        if dist_to_player == 1 {
            score += 50;
        } else if dist_to_player == 2 {
            score += 25;
        }

        // 2. Between opponent and center
        let player_to_center = (player_pos.0 as i32 - 3).abs() + (player_pos.1 as i32 - 3).abs();
        let pos_to_center = (pos.0 as i32 - 3).abs() + (pos.1 as i32 - 3).abs();

        if pos_to_center < player_to_center && dist_to_player <= 3 {
            score += 30; // Cutting off opponent from center
        }

        // 3. Restrict opponent's mobility
        let player_moves = get_queen_moves(player_pos.0, player_pos.1, occupied);
        if (player_moves & (1u64 << idx)) != 0 {
            score += 35; // Destroys one of opponent's valid moves
        }

        // 4. Don't destroy our own valuable cells
        let ai_moves = get_queen_moves(new_pos.0, new_pos.1, occupied);
        if (ai_moves & (1u64 << idx)) != 0 {
            score -= 20;
        }

        // 5. Don't destroy center cells in early game
        if CENTER_CELLS.contains(&pos) {
            let ai_to_pos = (pos.0 as i32 - new_pos.0 as i32).abs() +
                           (pos.1 as i32 - new_pos.1 as i32).abs();
            if ai_to_pos <= 2 {
                score -= 15;
            }
        }

        // 6. Prefer destroying edge/corner cells (less valuable)
        let is_edge = pos.0 == 0 || pos.0 == 6 || pos.1 == 0 || pos.1 == 6;
        let is_corner = (pos.0 == 0 || pos.0 == 6) && (pos.1 == 0 || pos.1 == 6);
        if is_corner {
            score += 5;
        } else if is_edge {
            score += 2;
        }

        if score > best_score {
            best_score = score;
            best_destroy = pos;
        }

        temp &= temp - 1;
    }

    best_destroy
}

/// Check if we're still in opening phase
pub fn is_opening_phase(turn_count: u8, destroyed_count: u8) -> bool {
    turn_count <= 12 && destroyed_count <= 8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_opening_move_generation() {
        let state = GameState {
            player: 1u64 << 0,  // (0,0)
            ai: 1u64 << 48,     // (6,6)
            destroyed: 0,
        };

        let mv = get_opening_move(&state, 2);
        assert!(mv.is_some());

        if let Some(m) = mv {
            // Opening move should prefer center
            let dist_to_center = (m.to.0 as i32 - 3).abs() + (m.to.1 as i32 - 3).abs();
            assert!(dist_to_center <= 3, "Opening move should be relatively close to center");
        }
    }

    #[test]
    fn test_opening_phase_detection() {
        assert!(is_opening_phase(8, 4));
        assert!(is_opening_phase(12, 8));
        assert!(!is_opening_phase(14, 10));
        assert!(!is_opening_phase(20, 15));
    }

    #[test]
    fn test_center_preference() {
        let state = GameState {
            player: 1u64 << 0,
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let center_move = Move {
            from: (6, 6),
            to: (3, 3), // Center
            destroy: (0, 0),
            score: 0,
        };

        let corner_move = Move {
            from: (6, 6),
            to: (6, 5), // Near corner
            destroy: (0, 0),
            score: 0,
        };

        let center_score = evaluate_opening_move(&state, &center_move, 4);
        let corner_score = evaluate_opening_move(&state, &corner_move, 4);

        assert!(center_score > corner_score, "Center moves should score higher than corner moves");
    }
}
