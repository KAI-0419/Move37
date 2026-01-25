//! Advanced Evaluation Functions for ISOLATION AI
//!
//! This module provides sophisticated board evaluation for NEXUS-5 and NEXUS-7.
//! Complete rewrite with 8 strategic components matching TypeScript implementation.
//!
//! Key features:
//! - Territory quality analysis (Voronoi)
//! - Multi-move mobility lookahead
//! - Critical bottleneck detection
//! - Partition awareness
//! - Positional awareness (center/corners)
//!
//! Based on TypeScript advancedEvaluation.ts

use crate::board::GameState;
use crate::bitboard::*;
use crate::voronoi::*;
use crate::partition::*;
use std::cell::RefCell;
use std::collections::HashMap;

/// Cache for critical cells computation
/// Uses position hash as key to avoid recomputation
thread_local! {
    static CRITICAL_CELLS_CACHE: RefCell<HashMap<u64, Vec<u8>>> = RefCell::new(HashMap::new());
}

const CACHE_MAX_SIZE: usize = 1000;

/// Evaluation weights for different difficulty levels
#[derive(Clone, Copy, Debug)]
pub struct EvalWeights {
    pub territory: f32,
    pub mobility: f32,
    pub mobility_potential: f32,
    pub center_control: f32,
    pub corner_avoidance: f32,
    pub partition_advantage: f32,
    pub critical_cells: f32,
    pub openness: f32,
}

impl EvalWeights {
    /// NEXUS-7 weights (highest difficulty)
    pub fn nexus_7() -> Self {
        EvalWeights {
            territory: 5.0,
            mobility: 8.0,
            mobility_potential: 5.0,
            center_control: 2.0,
            corner_avoidance: 3.0,
            partition_advantage: 500.0,
            critical_cells: 4.0,
            openness: 1.0,
        }
    }

    /// NEXUS-5 weights (medium difficulty)
    pub fn nexus_5() -> Self {
        EvalWeights {
            territory: 4.0,
            mobility: 7.0,
            mobility_potential: 3.0,
            center_control: 2.0,
            corner_avoidance: 2.5,
            partition_advantage: 300.0,
            critical_cells: 3.0,
            openness: 0.8,
        }
    }

    /// NEXUS-3 weights (basic difficulty)
    pub fn nexus_3() -> Self {
        EvalWeights {
            territory: 3.0,
            mobility: 5.0,
            mobility_potential: 2.0,
            center_control: 1.5,
            corner_avoidance: 2.0,
            partition_advantage: 100.0,
            critical_cells: 2.0,
            openness: 0.5,
        }
    }
}

/// Individual evaluation components for debugging/analysis
#[derive(Clone, Copy, Debug)]
pub struct EvalComponents {
    pub territory: f32,
    pub mobility: f32,
    pub mobility_potential: f32,
    pub center_control: f32,
    pub corner_avoidance: f32,
    pub partition_advantage: f32,
    pub critical_cells: f32,
    pub openness: f32,
}

/// Precomputed center distance table (Manhattan distance from center (3,3))
const CENTER_DISTANCE: [i32; 49] = [
    6, 5, 4, 3, 4, 5, 6,
    5, 4, 3, 2, 3, 4, 5,
    4, 3, 2, 1, 2, 3, 4,
    3, 2, 1, 0, 1, 2, 3,
    4, 3, 2, 1, 2, 3, 4,
    5, 4, 3, 2, 3, 4, 5,
    6, 5, 4, 3, 4, 5, 6,
];

/// Precomputed corner proximity table (distance to nearest corner)
const CORNER_PROXIMITY: [i32; 49] = [
    0, 1, 2, 3, 4, 5, 6,
    1, 1, 2, 3, 4, 5, 5,
    2, 2, 2, 3, 4, 4, 4,
    3, 3, 3, 3, 3, 3, 3,
    4, 4, 4, 3, 2, 2, 2,
    5, 5, 4, 3, 2, 1, 1,
    6, 5, 4, 3, 2, 1, 0,
];

/// Advanced evaluation function for NEXUS-5 and NEXUS-7
pub fn evaluate_advanced(state: &GameState, weights: &EvalWeights) -> (i32, EvalComponents) {
    let blocked = state.destroyed | state.player | state.ai;

    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    // 1. Territory analysis using Voronoi
    let voronoi = calculate_voronoi_optimized(player_pos, ai_pos, state.destroyed);
    let territory_score = (voronoi.ai_count - voronoi.player_count) as f32
        + (voronoi.contested_count as f32 * 0.4); // Contested cells favor AI (moves second)

    // 2. Immediate mobility
    let ai_moves = get_queen_moves(ai_pos.0, ai_pos.1, blocked);
    let player_moves = get_queen_moves(player_pos.0, player_pos.1, blocked);
    let ai_mobility_count = count_ones(ai_moves);
    let mobility_score = (ai_mobility_count - count_ones(player_moves)) as f32;

    // DESPERATION MODE: If AI is trapped, ignore territory and focus on survival
    let (w_territory, w_mobility, w_partition) = if ai_mobility_count <= 2 {
        (0.0, 50.0, 0.0) // Extreme focus on mobility
    } else {
        (weights.territory, weights.mobility, weights.partition_advantage)
    };

    // 3. Mobility potential (2-move lookahead)
    let mobility_potential_score = calculate_mobility_potential(state, blocked);

    // 4. Center control
    let ai_center_dist = CENTER_DISTANCE[ai_idx as usize];
    let player_center_dist = CENTER_DISTANCE[player_idx as usize];
    let center_score = (player_center_dist - ai_center_dist) as f32;

    // 5. Corner avoidance
    let ai_corner_dist = CORNER_PROXIMITY[ai_idx as usize];
    let player_corner_dist = CORNER_PROXIMITY[player_idx as usize];
    let corner_score = (ai_corner_dist - player_corner_dist) as f32;

    // 6. Partition analysis
    let partition = detect_partition_bitboard(player_pos, ai_pos, state.destroyed);
    let partition_score = if partition.is_partitioned {
        // Already partitioned - huge advantage/disadvantage based on region sizes
        ((partition.ai_region_size - partition.player_region_size) * 3) as f32
    } else {
        // Check for near-partition situations
        let critical_cells = find_critical_cells(state, blocked);
        if critical_cells.len() <= 3 && critical_cells.len() > 0 {
            // Close to partition - evaluate potential
            evaluate_partition_threat(state, blocked, &critical_cells)
        } else {
            0.0
        }
    };

    // 7. Critical cells control
    let critical_score = evaluate_critical_cell_control(state, blocked, &voronoi);

    // 8. Openness (access to open areas)
    let openness_score = evaluate_openness(state, blocked);

    // Combine all components
    let components = EvalComponents {
        territory: territory_score,
        mobility: mobility_score,
        mobility_potential: mobility_potential_score,
        center_control: center_score,
        corner_avoidance: corner_score,
        partition_advantage: partition_score,
        critical_cells: critical_score,
        openness: openness_score,
    };

    let score = (
        territory_score * w_territory +
        mobility_score * w_mobility +
        mobility_potential_score * weights.mobility_potential +
        center_score * weights.center_control +
        corner_score * weights.corner_avoidance +
        partition_score * w_partition +
        critical_score * weights.critical_cells +
        openness_score * weights.openness
    ) as i32;

    (score, components)
}

/// Calculate mobility potential (cells reachable in 2 moves)
fn calculate_mobility_potential(state: &GameState, blocked: u64) -> f32 {
    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    // Get cells reachable in 1 move
    let player_moves_1 = get_queen_moves(player_pos.0, player_pos.1, blocked);
    let ai_moves_1 = get_queen_moves(ai_pos.0, ai_pos.1, blocked);

    // Get cells reachable in 2 moves (from each 1-move destination)
    let mut player_moves_2 = 0u64;
    let mut ai_moves_2 = 0u64;

    // For player
    let mut temp = player_moves_1;
    while temp != 0 {
        let lowest_bit = temp & temp.wrapping_neg();
        let idx = lowest_bit.trailing_zeros() as u8;
        let pos = index_to_pos(idx);

        let moves_2 = get_queen_moves(pos.0, pos.1, blocked | (1u64 << player_idx));
        player_moves_2 |= moves_2;

        temp &= temp - 1;
    }
    player_moves_2 &= !player_moves_1; // Exclude cells already reachable in 1 move

    // For AI
    let mut temp = ai_moves_1;
    while temp != 0 {
        let lowest_bit = temp & temp.wrapping_neg();
        let idx = lowest_bit.trailing_zeros() as u8;
        let pos = index_to_pos(idx);

        let moves_2 = get_queen_moves(pos.0, pos.1, blocked | (1u64 << ai_idx));
        ai_moves_2 |= moves_2;

        temp &= temp - 1;
    }
    ai_moves_2 &= !ai_moves_1;

    let player_potential = count_ones(player_moves_1) as f32 + count_ones(player_moves_2) as f32 * 0.5;
    let ai_potential = count_ones(ai_moves_1) as f32 + count_ones(ai_moves_2) as f32 * 0.5;

    ai_potential - player_potential
}

/// Compute cache key for critical cells
/// Uses position hash based on player, AI, and destroyed cells
fn compute_critical_cells_cache_key(state: &GameState) -> u64 {
    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;

    // Simple hash: combine player, AI, and destroyed positions
    let mut hash = (player_idx as u64) | ((ai_idx as u64) << 8);

    // XOR in destroyed cells (simplified)
    let mut destroyed = state.destroyed;
    while destroyed != 0 {
        let idx = destroyed.trailing_zeros();
        hash ^= (idx as u64) << (idx % 32);
        destroyed &= destroyed - 1;
    }

    hash
}

/// Find cells that would cause partition if destroyed (with caching)
fn find_critical_cells(state: &GameState, blocked: u64) -> Vec<u8> {
    let cache_key = compute_critical_cells_cache_key(state);

    // Try cache first
    let cached = CRITICAL_CELLS_CACHE.with(|cache| {
        cache.borrow().get(&cache_key).cloned()
    });

    if let Some(result) = cached {
        return result;
    }

    // Cache miss - compute
    let result = find_critical_cells_uncached(state, blocked);

    // Store in cache
    CRITICAL_CELLS_CACHE.with(|cache| {
        let mut cache = cache.borrow_mut();

        // Evict if cache is full (simple LRU: clear all)
        if cache.len() >= CACHE_MAX_SIZE {
            cache.clear();
        }

        cache.insert(cache_key, result.clone());
    });

    result
}

/// Find cells that would cause partition if destroyed (uncached implementation)
fn find_critical_cells_uncached(state: &GameState, blocked: u64) -> Vec<u8> {
    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    let mut critical: Vec<u8> = Vec::new();

    // Only check cells in the "path" between players
    let min_r = player_pos.0.min(ai_pos.0);
    let max_r = player_pos.0.max(ai_pos.0);
    let min_c = player_pos.1.min(ai_pos.1);
    let max_c = player_pos.1.max(ai_pos.1);

    // Expand the search area slightly
    let search_min_r = min_r.saturating_sub(1);
    let search_max_r = (max_r + 1).min(6);
    let search_min_c = min_c.saturating_sub(1);
    let search_max_c = (max_c + 1).min(6);

    for r in search_min_r..=search_max_r {
        for c in search_min_c..=search_max_c {
            let idx = pos_to_index(r, c);

            // Skip blocked cells
            if (blocked & (1u64 << idx)) != 0 {
                continue;
            }

            // Check if destroying this would partition
            if would_cause_partition(player_pos, ai_pos, state.destroyed, (r, c)) {
                critical.push(idx);
            }
        }
    }

    critical
}

/// Clear the critical cells cache (call between games)
pub fn clear_critical_cells_cache() {
    CRITICAL_CELLS_CACHE.with(|cache| {
        cache.borrow_mut().clear();
    });
}

/// Evaluate the threat of partition
fn evaluate_partition_threat(state: &GameState, blocked: u64, critical_cells: &[u8]) -> f32 {
    if critical_cells.is_empty() {
        return 0.0;
    }

    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    let mut best_advantage: f32 = -1000.0;

    // Check which side would benefit from partition
    for &idx in critical_cells {
        let pos = index_to_pos(idx);
        let result = detect_partition_bitboard(player_pos, ai_pos, state.destroyed | (1u64 << idx));

        if result.is_partitioned {
            let advantage = (result.ai_region_size - result.player_region_size) as f32;
            best_advantage = best_advantage.max(advantage);
        }
    }

    // If AI can create advantageous partition, that's good
    // If player can, that's bad for AI
    best_advantage * 0.5
}

/// Evaluate control of critical cells
fn evaluate_critical_cell_control(
    state: &GameState,
    blocked: u64,
    voronoi: &VoronoiResult,
) -> f32 {
    let critical = find_critical_cells(state, blocked);

    if critical.is_empty() {
        return 0.0;
    }

    let mut ai_control = 0;
    let mut player_control = 0;

    for &idx in &critical {
        if (voronoi.ai_territory & (1u64 << idx)) != 0 {
            ai_control += 1;
        } else if (voronoi.player_territory & (1u64 << idx)) != 0 {
            player_control += 1;
        }
    }

    ((ai_control - player_control) * 2) as f32
}

/// Evaluate openness (preference for open areas)
fn evaluate_openness(state: &GameState, blocked: u64) -> f32 {
    let player_idx = state.player.trailing_zeros() as u8;
    let ai_idx = state.ai.trailing_zeros() as u8;
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    // Count open cells in each direction from each piece
    let mut player_openness = 0;
    let mut ai_openness = 0;

    let directions = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ];

    // For player
    for (dr, dc) in directions.iter() {
        let mut r = player_pos.0 as i8 + dr;
        let mut c = player_pos.1 as i8 + dc;
        let mut open_count = 0;

        while r >= 0 && r < 7 && c >= 0 && c < 7 {
            let idx = pos_to_index(r as u8, c as u8);
            if (blocked & (1u64 << idx)) == 0 {
                open_count += 1;
            } else {
                break;
            }
            r += dr;
            c += dc;
        }
        player_openness += open_count;
    }

    // For AI
    for (dr, dc) in directions.iter() {
        let mut r = ai_pos.0 as i8 + dr;
        let mut c = ai_pos.1 as i8 + dc;
        let mut open_count = 0;

        while r >= 0 && r < 7 && c >= 0 && c < 7 {
            let idx = pos_to_index(r as u8, c as u8);
            if (blocked & (1u64 << idx)) == 0 {
                open_count += 1;
            } else {
                break;
            }
            r += dr;
            c += dc;
        }
        ai_openness += open_count;
    }

    ((ai_openness - player_openness) as f32) * 0.3
}

/// Legacy simple evaluation (for backward compatibility / fallback)
pub fn evaluate(state: &GameState) -> i32 {
    let blocked = state.destroyed | state.player | state.ai;

    // Use NEXUS-3 weights for simple evaluation
    let weights = EvalWeights::nexus_3();
    let (score, _) = evaluate_advanced(state, &weights);
    score
}
