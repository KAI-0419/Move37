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
//! - Game Theoretic concepts: Parity, Trap detection, Effective Mobility
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
    pub parity: f32,
    pub trap: f32,
    pub effective_mobility: f32,
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
            parity: 20.0,
            trap: 100.0,
            effective_mobility: 3.0,
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
            parity: 5.0,
            trap: 20.0,
            effective_mobility: 1.0,
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
            parity: 0.0,
            trap: 0.0,
            effective_mobility: 0.0,
        }
    }
}

/// Dynamic weights based on game phase
pub fn get_phase_weights(destroyed_count: u32) -> EvalWeights {
    // Start with NEXUS-7 base
    let mut w = EvalWeights::nexus_7();

    if destroyed_count < 10 {
        // Opening: Center control + Mobility
        w.territory = 3.0;
        w.mobility = 6.0;
        w.center_control = 5.0;
        w.partition_advantage = 200.0;
        w.trap = 50.0;
    } else if destroyed_count < 30 {
        // Midgame: Territory + Critical cells + Trap
        w.territory = 8.0;
        w.mobility = 5.0;
        w.center_control = 1.0;
        w.partition_advantage = 600.0;
        w.critical_cells = 8.0;
        w.trap = 150.0;
    } else {
        // Endgame: Partition + Parity + Mobility
        w.territory = 2.0;
        w.mobility = 10.0;
        w.partition_advantage = 1000.0;
        w.parity = 50.0;
        w.effective_mobility = 10.0;
    }
    w
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
    pub parity: f32,
    pub trap: f32,
    pub effective_mobility: f32,
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
    let destroyed_count = count_ones(state.destroyed);
    let blocked = state.destroyed | state.player | state.ai;

    let player_idx = match safe_get_position_index(state.player) {
        Some(idx) => idx,
        None => return (0, EvalComponents {
            territory: 0.0, mobility: 0.0, mobility_potential: 0.0,
            center_control: 0.0, corner_avoidance: 0.0, partition_advantage: 0.0,
            critical_cells: 0.0, openness: 0.0, parity: 0.0, trap: 0.0, effective_mobility: 0.0,
        }),
    };
    let ai_idx = match safe_get_position_index(state.ai) {
        Some(idx) => idx,
        None => return (0, EvalComponents {
            territory: 0.0, mobility: 0.0, mobility_potential: 0.0,
            center_control: 0.0, corner_avoidance: 0.0, partition_advantage: 0.0,
            critical_cells: 0.0, openness: 0.0, parity: 0.0, trap: 0.0, effective_mobility: 0.0,
        }),
    };
    let player_pos = index_to_pos(player_idx);
    let ai_pos = index_to_pos(ai_idx);

    // 1. Partition analysis (Do this FIRST as it might skip other components)
    let partition = detect_partition_bitboard(player_pos, ai_pos, state.destroyed);
    
    // 2. Territory analysis using Voronoi
    // If partitioned, territory is simply the region sizes
    let (voronoi_ai, voronoi_player, voronoi_contested) = if partition.is_partitioned {
        (partition.ai_region_size as f32, partition.player_region_size as f32, 0.0)
    } else {
        let voronoi = calculate_voronoi_optimized(player_pos, ai_pos, state.destroyed);
        (voronoi.ai_count as f32, voronoi.player_count as f32, voronoi.contested_count as f32)
    };
    
    let territory_score = (voronoi_ai - voronoi_player) + (voronoi_contested * 0.4);

    // 3. Immediate mobility
    let ai_moves = get_queen_moves(ai_pos.0, ai_pos.1, blocked);
    let player_moves = get_queen_moves(player_pos.0, player_pos.1, blocked);
    let ai_mobility_count = count_ones(ai_moves);
    let player_mobility_count = count_ones(player_moves);
    let mobility_score = (ai_mobility_count as i32 - player_mobility_count as i32) as f32;

    // DESPERATION MODE: If AI is trapped, ignore territory and focus on survival
    let (w_territory, w_mobility, w_partition) = if ai_mobility_count <= 2 {
        (0.5, 50.0, 0.0) // Extreme focus on mobility, but don't totally ignore territory
    } else {
        (weights.territory, weights.mobility, weights.partition_advantage)
    };

    // 4. Mobility potential (2-move lookahead)
    // Only calculate if desperate or in mid-game (to save time)
    let mobility_potential_score = if ai_mobility_count <= 4 || (destroyed_count > 15 && destroyed_count < 35) {
        calculate_mobility_potential(state, blocked)
    } else {
        0.0
    };

    // 5. Center control / Corner avoidance (Combined and cheap)
    let ai_center_dist = CENTER_DISTANCE[ai_idx as usize];
    let player_center_dist = CENTER_DISTANCE[player_idx as usize];
    let center_score = (player_center_dist - ai_center_dist) as f32;

    let ai_corner_dist = CORNER_PROXIMITY[ai_idx as usize];
    let player_corner_dist = CORNER_PROXIMITY[player_idx as usize];
    let corner_score = (ai_corner_dist - player_corner_dist) as f32;

    // 6. Partition score
    let partition_score = if partition.is_partitioned {
        // Already partitioned - huge advantage/disadvantage based on region sizes
        ((partition.ai_region_size - partition.player_region_size) * 5) as f32
    } else if destroyed_count > 12 {
        // Only check for near-partition situations if board is somewhat filled
        let critical_cells = find_critical_cells(state, blocked);
        if !critical_cells.is_empty() && critical_cells.len() <= 3 {
            evaluate_partition_threat(state, blocked, &critical_cells)
        } else {
            0.0
        }
    } else {
        0.0
    };

    // 7. Critical cells control (Only if few critical cells exist)
    let critical_score = if destroyed_count > 15 {
        // Simplified check: use partition logic if available
        0.0 // Currently too expensive for leaf nodes
    } else {
        0.0
    };

    // 8. Openness
    let openness_score = if destroyed_count < 20 {
        evaluate_openness(state, blocked)
    } else {
        0.0
    };

    // 9. Parity (Crucial in endgame)
    let parity_score = if partition.is_partitioned {
        // In partitioned board, parity of remaining squares determines winner
        // (Simplified: odd remaining squares favor current player)
        let ai_parity = (partition.ai_region_size % 2) as f32;
        let player_parity = (partition.player_region_size % 2) as f32;
        ai_parity - player_parity
    } else {
        0.0
    };

    // 10. Trap Detection (Cheap check)
    let trap_score = if ai_mobility_count == 1 {
        -1.0 
    } else if player_mobility_count == 1 {
        1.0
    } else {
        0.0
    };

    // 11. Effective Mobility (Only in endgame)
    let effective_mobility_score = if destroyed_count > 30 {
        let ai_effective = effective_mobility(state.ai, blocked);
        let player_effective = effective_mobility(state.player, blocked);
        (ai_effective - player_effective) as f32
    } else {
        0.0
    };


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
        parity: parity_score,
        trap: trap_score,
        effective_mobility: effective_mobility_score,
    };

    let score = (
        territory_score * w_territory +
        mobility_score * w_mobility +
        mobility_potential_score * weights.mobility_potential +
        center_score * weights.center_control +
        corner_score * weights.corner_avoidance +
        partition_score * w_partition +
        critical_score * weights.critical_cells +
        openness_score * weights.openness +
        parity_score * weights.parity +
        trap_score * weights.trap +
        effective_mobility_score * weights.effective_mobility
    ) as i32;

    (score, components)
}

/// Calculate parity advantage
fn evaluate_parity(_state: &GameState, voronoi: &VoronoiResult) -> f32 {
    // Parity concept: In a partitioned game, the player with the larger odd/even compatible region wins.
    // Simplified: Larger region usually implies parity advantage if played correctly.
    if voronoi.ai_count > voronoi.player_count {
        1.0
    } else if voronoi.player_count > voronoi.ai_count {
        -1.0
    } else {
        0.0
    }
}

/// Check if position is a trap (forced loss)
fn is_trap_position(state: &GameState, target_is_player: bool) -> bool {
    let pos_mask = if target_is_player { state.player } else { state.ai };
    let pos_idx = match safe_get_position_index(pos_mask) {
        Some(idx) => idx,
        None => return true, // If position is invalid/empty, consider it trapped/lost
    };
    let (r, c) = index_to_pos(pos_idx);
    let blocked = state.destroyed | state.player | state.ai;

    let moves = get_queen_moves(r, c, blocked);
    
    // If no moves, it's a trap (loss)
    if moves == 0 {
        return true;
    }

    // Check if all immediate moves lead to positions with 0 or 1 move (dead ends)
    // This assumes opponent will play perfectly to block the single exit
    let mut all_trapped = true;
    let mut temp = moves;
    
    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        let (nr, nc) = index_to_pos(idx);
        
        // Hypothetical next state: we moved to (nr, nc)
        // Opponent stays where they are (or moves).
        // Check our mobility from new pos.
        // NOTE: This is a shallow check.
        // We assume 'blocked' includes our OLD position (it becomes destroyed/occupied).
        // Actually in Isolation, old position is empty? No, old position becomes empty but we occupy new one.
        // But in the game logic, we move from A to B. A becomes empty? 
        // Wait, standard Isolation: Piece moves. Old square stays empty?
        // "Players move their Queen... to any square... The square just vacated... is NOT destroyed."
        // "BUT in THIS implementation (check board.rs?): 
        // Usually Isolation involves destroying a square.
        // "Move queen, THEN destroy a square".
        // The square we came from is effectively empty unless we destroy it.
        
        // However, 'blocked' argument passed here is current state.
        // If we move, 'pos_mask' is no longer occupied.
        // New 'blocked' = (blocked ^ pos_mask) | new_mask.
        
        let new_mask = 1u64 << idx;
        let future_blocked = (blocked ^ pos_mask) | new_mask;
        
        let future_moves = get_queen_moves(nr, nc, future_blocked);
        if count_ones(future_moves) > 1 {
            all_trapped = false; // Found an escape route with >1 options
            break;
        }
        
        temp &= temp - 1;
    }
    
    all_trapped
}

/// Calculate effective mobility (safe moves)
fn effective_mobility(pos_mask: u64, blocked: u64) -> i32 {
    let pos_idx = match safe_get_position_index(pos_mask) {
        Some(idx) => idx,
        None => return 0,
    };
    let (r, c) = index_to_pos(pos_idx);
    let moves = get_queen_moves(r, c, blocked);
    
    let mut effective = 0;
    let mut temp = moves;
    
    while temp != 0 {
        let idx = temp.trailing_zeros() as u8;
        let (nr, nc) = index_to_pos(idx);
        
        // Future blocked: old pos empty, new pos occupied
        let new_mask = 1u64 << idx;
        let future_blocked = (blocked ^ pos_mask) | new_mask;
        
        let future_moves = get_queen_moves(nr, nc, future_blocked);
        if count_ones(future_moves) >= 2 {
            effective += 1; // This move leads to a flexible position
        }
        
        temp &= temp - 1;
    }
    
    effective
}

/// Calculate mobility potential (cells reachable in 2 moves)
fn calculate_mobility_potential(state: &GameState, blocked: u64) -> f32 {
    let player_idx = match safe_get_position_index(state.player) {
        Some(idx) => idx,
        None => return 0.0,
    };
    let ai_idx = match safe_get_position_index(state.ai) {
        Some(idx) => idx,
        None => return 0.0,
    };
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
    let player_idx = safe_get_position_index(state.player).unwrap_or(64); // Use 64 as safe default for hash
    let ai_idx = safe_get_position_index(state.ai).unwrap_or(64);

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
    let player_idx = match safe_get_position_index(state.player) {
        Some(idx) => idx,
        None => return Vec::new(),
    };
    let ai_idx = match safe_get_position_index(state.ai) {
        Some(idx) => idx,
        None => return Vec::new(),
    };
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

    let player_idx = match safe_get_position_index(state.player) {
        Some(idx) => idx,
        None => return 0.0,
    };
    let ai_idx = match safe_get_position_index(state.ai) {
        Some(idx) => idx,
        None => return 0.0,
    };
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
    let player_idx = match safe_get_position_index(state.player) {
        Some(idx) => idx,
        None => return 0.0,
    };
    let ai_idx = match safe_get_position_index(state.ai) {
        Some(idx) => idx,
        None => return 0.0,
    };
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
    let destroyed_cnt = count_ones(state.destroyed);
    let weights = get_phase_weights(destroyed_cnt);
    let (score, _) = evaluate_advanced(state, &weights);
    score
}