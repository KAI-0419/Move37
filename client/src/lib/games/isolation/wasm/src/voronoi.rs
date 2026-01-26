//! Voronoi Territory Analysis for ISOLATION
//!
//! Calculates which cells each player can reach first using bitboard-based BFS.
//! This is a critical component of strategic evaluation (weight 5.0).
//!
//! Based on TypeScript implementation in bitboard.ts:calculateBitboardVoronoiOptimized()

use crate::board::GameState;
use crate::bitboard::*;

#[derive(Clone, Copy, Debug)]
pub struct VoronoiResult {
    pub player_territory: u64,
    pub ai_territory: u64,
    pub contested: u64,
    pub player_count: i32,
    pub ai_count: i32,
    pub contested_count: i32,
}

/// Calculate Voronoi territories using optimized bitboard-based BFS
///
/// This is ~50-70% faster than distance-based approaches because:
/// - No distance array allocation (eliminates 98 number allocations)
/// - Direct bit manipulation (no array indexing)
/// - Territory determined by frontier reach order, not distance comparison
///
/// Returns territory bitboards and counts for both players
pub fn calculate_voronoi_optimized(
    player_pos: (u8, u8),
    ai_pos: (u8, u8),
    destroyed: u64,
) -> VoronoiResult {
    // Create blocked bitboard (destroyed + both positions)
    let player_idx = pos_to_index(player_pos.0, player_pos.1);
    let ai_idx = pos_to_index(ai_pos.0, ai_pos.1);

    let player_mask = 1u64 << player_idx;
    let ai_mask = 1u64 << ai_idx;
    let blocked = destroyed | player_mask | ai_mask;

    // Initialize frontiers
    let mut player_frontier = player_mask;
    let mut ai_frontier = ai_mask;
    let mut player_visited = player_mask;
    let mut ai_visited = ai_mask;

    // Territory bitboards - accumulated as frontiers expand
    let mut player_territory = 0u64;
    let mut ai_territory = 0u64;
    let mut contested = 0u64;

    let max_depth = 20; // Safety limit
    let mut depth = 0;

    // Dual-frontier expansion WITHOUT distance arrays
    while (player_frontier != 0 || ai_frontier != 0) && depth < max_depth {
        depth += 1;

        // 1. Expand both frontiers simultaneously
        let new_player_frontier = if player_frontier != 0 {
            expand_frontier_optimized(player_frontier, blocked, player_visited)
        } else {
            0
        };

        let new_ai_frontier = if ai_frontier != 0 {
            expand_frontier_optimized(ai_frontier, blocked, ai_visited)
        } else {
            0
        };

        // 2. Determine ownership based on simultaneous arrival
        
        // Player claims: Reached by player, NOT visited by AI before, NOT reached by AI now
        let player_only = new_player_frontier & !ai_visited & !new_ai_frontier;
        
        // AI claims: Reached by AI, NOT visited by player before, NOT reached by player now
        let ai_only = new_ai_frontier & !player_visited & !new_player_frontier;

        // Contested: Reached by BOTH in this same step
        let contested_new = new_player_frontier & new_ai_frontier;

        // 3. Update territory accumulators
        player_territory |= player_only;
        ai_territory |= ai_only;
        contested |= contested_new;

        // 4. Update visited sets
        player_visited |= new_player_frontier;
        ai_visited |= new_ai_frontier;

        // 5. Advance frontiers
        player_frontier = new_player_frontier;
        ai_frontier = new_ai_frontier;
    }

    VoronoiResult {
        player_territory,
        ai_territory,
        contested,
        player_count: count_ones(player_territory) as i32,
        ai_count: count_ones(ai_territory) as i32,
        contested_count: count_ones(contested) as i32,
    }
}

/// Expand frontier by one queen-move step (bit-parallel optimization)
///
/// Returns only new cells (not already visited).
fn expand_frontier_optimized(
    frontier: u64,
    blocked: u64,
    visited: u64,
) -> u64 {
    expand_queen_bit_parallel(frontier, blocked) & !visited
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_voronoi_basic() {
        // Simple case: player at (0,0), AI at (6,6), no destroyed cells
        let player_pos = (0, 0);
        let ai_pos = (6, 6);
        let destroyed = 0u64;

        let result = calculate_voronoi_optimized(player_pos, ai_pos, destroyed);

        // Player should control top-left area, AI should control bottom-right
        assert!(result.player_count > 0);
        assert!(result.ai_count > 0);

        // Total reachable should be less than full board (49) minus 2 positions
        let total = result.player_count + result.ai_count + result.contested_count;
        assert!(total <= 47); // 49 - 2 occupied cells
    }

    #[test]
    fn test_voronoi_contested() {
        // Players equidistant from center: player at (3,0), AI at (3,6)
        let player_pos = (3, 0);
        let ai_pos = (3, 6);
        let destroyed = 0u64;

        let result = calculate_voronoi_optimized(player_pos, ai_pos, destroyed);

        // Should have significant contested territory in the middle
        assert!(result.contested_count > 0);
    }

    #[test]
    fn test_voronoi_blocked() {
        // Test with some destroyed cells blocking paths
        let player_pos = (0, 0);
        let ai_pos = (6, 6);

        // Create a diagonal wall
        let mut destroyed = 0u64;
        for i in 0..7 {
            destroyed |= 1u64 << pos_to_index(i, i);
        }
        // Remove player and AI positions from wall
        destroyed &= !(1u64 << pos_to_index(0, 0));
        destroyed &= !(1u64 << pos_to_index(6, 6));

        let result = calculate_voronoi_optimized(player_pos, ai_pos, destroyed);

        // With diagonal wall, territories should be more separated
        assert!(result.player_count > 0);
        assert!(result.ai_count > 0);
    }
}
