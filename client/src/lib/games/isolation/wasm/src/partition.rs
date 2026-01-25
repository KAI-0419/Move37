//! Partition Detection for ISOLATION
//!
//! Detects when the board is partitioned (players cannot reach each other)
//! and calculates the size of each player's region.
//!
//! This is CRITICAL for strategic evaluation (weight 500).
//!
//! Based on TypeScript implementation in bitboard.ts:detectPartitionBitboard()

use crate::board::GameState;
use crate::bitboard::*;

#[derive(Clone, Copy, Debug)]
pub struct PartitionResult {
    pub is_partitioned: bool,
    pub player_region_size: i32,
    pub ai_region_size: i32,
    pub player_region: u64,
    pub ai_region: u64,
}

/// Detect if the board is partitioned using queen-based flood fill
///
/// A partition occurs when:
/// - Player cannot reach AI position via any sequence of queen moves
/// - AI cannot reach player position via any sequence of queen moves
///
/// Returns partition status and region sizes for both players
pub fn detect_partition_bitboard(
    player_pos: (u8, u8),
    ai_pos: (u8, u8),
    destroyed: u64,
) -> PartitionResult {
    let player_idx = pos_to_index(player_pos.0, player_pos.1);
    let ai_idx = pos_to_index(ai_pos.0, ai_pos.1);

    let player_mask = 1u64 << player_idx;
    let ai_mask = 1u64 << ai_idx;

    // Flood fill from player position, treating AI position as BLOCKED
    // This gives us all cells the player can reach
    let blocked_for_player = destroyed | ai_mask;
    let player_reachable = queen_flood_fill(player_pos, blocked_for_player);

    // Check if AI position is in player's reachable set
    let is_partitioned = (player_reachable & ai_mask) == 0;

    if !is_partitioned {
        // Players can reach each other - no partition
        return PartitionResult {
            is_partitioned: false,
            player_region_size: 0,
            ai_region_size: 0,
            player_region: 0,
            ai_region: 0,
        };
    }

    // Board IS partitioned - calculate region sizes
    // Player's region = all cells reachable from player (includes player position)
    let player_region = player_reachable | player_mask;

    // AI's region = all cells reachable from AI (includes AI position)
    let blocked_for_ai = destroyed | player_mask;
    let ai_reachable = queen_flood_fill(ai_pos, blocked_for_ai);
    let ai_region = ai_reachable | ai_mask;

    PartitionResult {
        is_partitioned: true,
        player_region_size: count_ones(player_region) as i32,
        ai_region_size: count_ones(ai_region) as i32,
        player_region,
        ai_region,
    }
}

/// Queen-based flood fill using bitboards
///
/// Returns all cells reachable by any sequence of queen moves from start_pos.
/// The blocked bitboard indicates cells that cannot be moved through.
pub fn queen_flood_fill(start_pos: (u8, u8), blocked: u64) -> u64 {
    let start_idx = pos_to_index(start_pos.0, start_pos.1);
    let start_mask = 1u64 << start_idx;

    let mut reachable = start_mask;
    let mut frontier = start_mask;

    let max_iterations = 50; // Safety limit
    let mut iterations = 0;

    while frontier != 0 && iterations < max_iterations {
        iterations += 1;
        let mut new_frontier = 0u64;

        // For each cell in frontier, get all queen moves
        let mut temp = frontier;
        while temp != 0 {
            let lowest_bit = temp & temp.wrapping_neg();
            let idx = lowest_bit.trailing_zeros() as u8;
            let (r, c) = index_to_pos(idx);

            // Get moves from this position
            // Block visited cells to avoid infinite expansion
            let moves = get_queen_moves(r, c, blocked | reachable);
            new_frontier |= moves & !reachable;

            temp &= temp - 1;
        }

        reachable |= new_frontier;
        frontier = new_frontier;
    }

    reachable
}

/// Check if destroying a specific cell would cause partition
///
/// Useful for strategic decisions about when to isolate opponent
pub fn would_cause_partition(
    player_pos: (u8, u8),
    ai_pos: (u8, u8),
    destroyed: u64,
    destroy_pos: (u8, u8),
) -> bool {
    let destroy_idx = pos_to_index(destroy_pos.0, destroy_pos.1);
    let destroy_mask = 1u64 << destroy_idx;
    let new_destroyed = destroyed | destroy_mask;

    let result = detect_partition_bitboard(player_pos, ai_pos, new_destroyed);
    result.is_partitioned
}

/// Evaluate partition potential - how close is the board to being partitioned
///
/// Checks critical cells and returns a score (0.0 to 1.0) where higher = more likely to partition soon
pub fn evaluate_partition_potential(
    player_pos: (u8, u8),
    ai_pos: (u8, u8),
    destroyed: u64,
) -> f32 {
    let full_board = (1u64 << CELL_COUNT) - 1;
    let player_idx = pos_to_index(player_pos.0, player_pos.1);
    let ai_idx = pos_to_index(ai_pos.0, ai_pos.1);
    let player_mask = 1u64 << player_idx;
    let ai_mask = 1u64 << ai_idx;

    let occupied = destroyed | player_mask | ai_mask;
    let empty = full_board & !occupied;

    if empty == 0 {
        return 1.0; // No empty cells, likely already partitioned
    }

    // Count cells that would cause partition if destroyed
    let mut partition_cells = 0;
    let mut total_checked = 0;

    let mut temp = empty;
    while temp != 0 {
        let lowest_bit = temp & temp.wrapping_neg();
        let idx = lowest_bit.trailing_zeros() as u8;
        let (r, c) = index_to_pos(idx);

        total_checked += 1;

        // Check if destroying this cell would partition
        if would_cause_partition(player_pos, ai_pos, destroyed, (r, c)) {
            partition_cells += 1;
        }

        temp &= temp - 1;
    }

    if total_checked == 0 {
        return 1.0;
    }

    partition_cells as f32 / total_checked as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_partition_empty_board() {
        // Empty board - no partition
        let player_pos = (0, 0);
        let ai_pos = (6, 6);
        let destroyed = 0u64;

        let result = detect_partition_bitboard(player_pos, ai_pos, destroyed);
        assert!(!result.is_partitioned);
    }

    #[test]
    fn test_partition_diagonal_wall() {
        // Create a diagonal wall separating players
        let player_pos = (0, 0);
        let ai_pos = (6, 6);

        let mut destroyed = 0u64;
        for i in 1..6 {
            destroyed |= 1u64 << pos_to_index(i, i);
        }

        let result = detect_partition_bitboard(player_pos, ai_pos, destroyed);
        assert!(result.is_partitioned);
        assert!(result.player_region_size > 0);
        assert!(result.ai_region_size > 0);
    }

    #[test]
    fn test_queen_flood_fill() {
        // Test flood fill from center with no obstacles
        let start_pos = (3, 3);
        let blocked = 0u64;

        let reachable = queen_flood_fill(start_pos, blocked);

        // Should reach all 49 cells (including start)
        assert_eq!(count_ones(reachable), 49);
    }

    #[test]
    fn test_queen_flood_fill_blocked() {
        // Test flood fill with diagonal wall
        let start_pos = (0, 0);

        let mut blocked = 0u64;
        for i in 0..7 {
            blocked |= 1u64 << pos_to_index(i, i);
        }

        let reachable = queen_flood_fill(start_pos, blocked);

        // Should reach less than full board due to wall
        assert!(count_ones(reachable) < 49);
        assert!(count_ones(reachable) > 0);
    }

    #[test]
    fn test_would_cause_partition() {
        // Test if destroying a specific cell causes partition
        let player_pos = (0, 0);
        let ai_pos = (6, 6);

        let mut destroyed = 0u64;
        for i in 1..5 {
            destroyed |= 1u64 << pos_to_index(i, i);
        }

        // Destroying (5,5) should complete the diagonal wall and partition
        let would_partition = would_cause_partition(
            player_pos,
            ai_pos,
            destroyed,
            (5, 5),
        );
        assert!(would_partition);

        // Destroying (0,1) should NOT cause partition
        let would_not_partition = would_cause_partition(
            player_pos,
            ai_pos,
            destroyed,
            (0, 1),
        );
        assert!(!would_not_partition);
    }
}
