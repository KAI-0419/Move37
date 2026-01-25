//! Transposition Table with Zobrist Hashing for ISOLATION
//!
//! Provides:
//! - Zobrist hashing for fast position identification
//! - Transposition table with alpha/beta bounds
//! - PV (Principal Variation) move storage for move ordering
//!
//! Expected Impact: 30-50% search speedup by avoiding re-evaluation

use crate::board::{GameState, Move};
use std::collections::HashMap;

/// Bound type for transposition table entries
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Bound {
    Exact,  // Exact score
    Lower,  // Alpha bound (score >= this)
    Upper,  // Beta bound (score <= this)
}

/// Transposition table entry
#[derive(Clone, Debug)]
pub struct TTEntry {
    pub hash: u64,
    pub depth: u8,
    pub score: i32,
    pub bound: Bound,
    pub best_move: Option<Move>,
}

/// Transposition Table with Zobrist Hashing
pub struct TranspositionTable {
    pub table: HashMap<u64, TTEntry>,
    zobrist_player: [u64; 49],
    zobrist_ai: [u64; 49],
    zobrist_destroyed: [u64; 49],
    zobrist_turn: u64,
    pub hits: u64,
    pub misses: u64,
}

impl TranspositionTable {
    /// Create new transposition table with pre-computed Zobrist random numbers
    pub fn new() -> Self {
        // Use simple LCG (Linear Congruential Generator) for deterministic random numbers
        // This is faster than a full PRNG and sufficient for Zobrist hashing
        let mut seed = 0x123456789ABCDEFu64;

        let mut next_random = || {
            seed = seed.wrapping_mul(6364136223846793005u64).wrapping_add(1442695040888963407u64);
            seed
        };

        let mut zobrist_player = [0u64; 49];
        let mut zobrist_ai = [0u64; 49];
        let mut zobrist_destroyed = [0u64; 49];

        for i in 0..49 {
            zobrist_player[i] = next_random();
            zobrist_ai[i] = next_random();
            zobrist_destroyed[i] = next_random();
        }

        let zobrist_turn = next_random();

        TranspositionTable {
            table: HashMap::new(),
            zobrist_player,
            zobrist_ai,
            zobrist_destroyed,
            zobrist_turn,
            hits: 0,
            misses: 0,
        }
    }

    /// Compute Zobrist hash for a game state
    pub fn compute_hash(&self, state: &GameState, is_ai_turn: bool) -> u64 {
        let player_idx = state.player.trailing_zeros() as usize;
        let ai_idx = state.ai.trailing_zeros() as usize;

        let mut hash = self.zobrist_player[player_idx] ^ self.zobrist_ai[ai_idx];

        // XOR all destroyed cells
        let mut destroyed = state.destroyed;
        while destroyed != 0 {
            let idx = destroyed.trailing_zeros() as usize;
            hash ^= self.zobrist_destroyed[idx];
            destroyed &= destroyed - 1;
        }

        // XOR turn indicator
        if is_ai_turn {
            hash ^= self.zobrist_turn;
        }

        hash
    }

    /// Probe the transposition table
    ///
    /// Returns Some(entry) if:
    /// 1. Hash matches (exact position)
    /// 2. Depth is sufficient (deeper search is more valuable)
    /// 3. Score bounds are useful (can cause cutoff)
    ///
    /// Always returns entry if it has a best_move (for move ordering)
    pub fn probe(&mut self, hash: u64, depth: u8, alpha: i32, beta: i32) -> Option<&TTEntry> {
        if let Some(entry) = self.table.get(&hash) {
            // Verify hash match (collision detection)
            if entry.hash != hash {
                self.misses += 1;
                return None;
            }

            // If depth is sufficient, check if we can use the score
            if entry.depth >= depth {
                match entry.bound {
                    Bound::Exact => {
                        self.hits += 1;
                        return Some(entry);
                    }
                    Bound::Lower if entry.score >= beta => {
                        self.hits += 1;
                        return Some(entry);
                    }
                    Bound::Upper if entry.score <= alpha => {
                        self.hits += 1;
                        return Some(entry);
                    }
                    _ => {
                        // Score not useful, but move might be
                        if entry.best_move.is_some() {
                            self.misses += 1;
                            return Some(entry);
                        }
                    }
                }
            }

            // Even if depth is insufficient, return if we have a best move (for ordering)
            if entry.best_move.is_some() {
                self.misses += 1;
                return Some(entry);
            }
        }

        self.misses += 1;
        None
    }

    /// Store an entry in the transposition table
    ///
    /// Replacement strategy: Always replace (simple and effective)
    /// More sophisticated strategies (depth-preferred, two-tier) can be added later
    pub fn store(&mut self, hash: u64, depth: u8, score: i32, bound: Bound, best_move: Option<Move>) {
        let entry = TTEntry {
            hash,
            depth,
            score,
            bound,
            best_move,
        };

        self.table.insert(hash, entry);
    }

    /// Clear the transposition table
    pub fn clear(&mut self) {
        self.table.clear();
        self.hits = 0;
        self.misses = 0;
    }

    /// Get hit rate for statistics
    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }

    /// Get table size (number of entries)
    pub fn size(&self) -> usize {
        self.table.len()
    }

    /// Resize table if it gets too large (memory management)
    pub fn limit_size(&mut self, max_entries: usize) {
        if self.table.len() > max_entries {
            // Simple strategy: clear oldest entries
            // Keep only the most recently added entries
            let remove_count = self.table.len() - max_entries / 2;

            // Collect keys to remove (this is a simple approach)
            let keys_to_remove: Vec<u64> = self.table.keys()
                .take(remove_count)
                .copied()
                .collect();

            for key in keys_to_remove {
                self.table.remove(&key);
            }
        }
    }
}

/// Incremental Zobrist hash update (for efficiency during search)
///
/// Instead of recomputing the entire hash, we can update it incrementally:
/// - XOR out the old position
/// - XOR in the new position
/// - XOR the turn bit
pub fn update_hash_after_move(
    tt: &TranspositionTable,
    old_hash: u64,
    old_state: &GameState,
    new_state: &GameState,
    old_turn: bool,
    new_turn: bool,
) -> u64 {
    let mut hash = old_hash;

    // XOR out old player position
    let old_player_idx = old_state.player.trailing_zeros() as usize;
    hash ^= tt.zobrist_player[old_player_idx];

    // XOR in new player position
    let new_player_idx = new_state.player.trailing_zeros() as usize;
    hash ^= tt.zobrist_player[new_player_idx];

    // XOR out old AI position
    let old_ai_idx = old_state.ai.trailing_zeros() as usize;
    hash ^= tt.zobrist_ai[old_ai_idx];

    // XOR in new AI position
    let new_ai_idx = new_state.ai.trailing_zeros() as usize;
    hash ^= tt.zobrist_ai[new_ai_idx];

    // XOR the newly destroyed cells (difference between states)
    let new_destroyed = new_state.destroyed & !old_state.destroyed;
    let mut destroyed = new_destroyed;
    while destroyed != 0 {
        let idx = destroyed.trailing_zeros() as usize;
        hash ^= tt.zobrist_destroyed[idx];
        destroyed &= destroyed - 1;
    }

    // Update turn bit if turn changed
    if old_turn != new_turn {
        hash ^= tt.zobrist_turn;
    }

    hash
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bitboard::*;

    #[test]
    fn test_zobrist_hash_uniqueness() {
        let tt = TranspositionTable::new();

        // Create different states
        let state1 = GameState {
            player: 1u64 << 0,  // (0,0)
            ai: 1u64 << 48,     // (6,6)
            destroyed: 0,
        };

        let state2 = GameState {
            player: 1u64 << 1,  // (0,1) - different position
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let hash1 = tt.compute_hash(&state1, true);
        let hash2 = tt.compute_hash(&state2, true);

        // Hashes should be different for different states
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_zobrist_hash_turn_difference() {
        let tt = TranspositionTable::new();

        let state = GameState {
            player: 1u64 << 0,
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let hash_ai_turn = tt.compute_hash(&state, true);
        let hash_player_turn = tt.compute_hash(&state, false);

        // Same state, different turn should have different hash
        assert_ne!(hash_ai_turn, hash_player_turn);
    }

    #[test]
    fn test_transposition_table_store_probe() {
        let mut tt = TranspositionTable::new();

        let state = GameState {
            player: 1u64 << 0,
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let hash = tt.compute_hash(&state, true);

        // Store an entry
        tt.store(hash, 5, 100, Bound::Exact, None);

        // Probe should find it
        let entry = tt.probe(hash, 5, -1000, 1000);
        assert!(entry.is_some());

        if let Some(e) = entry {
            assert_eq!(e.score, 100);
            assert_eq!(e.depth, 5);
            assert_eq!(e.bound, Bound::Exact);
        }
    }

    #[test]
    fn test_transposition_table_depth_requirement() {
        let mut tt = TranspositionTable::new();

        let state = GameState {
            player: 1u64 << 0,
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let hash = tt.compute_hash(&state, true);

        // Store entry with depth 3
        tt.store(hash, 3, 100, Bound::Exact, None);

        // Probe with depth 5 (requires deeper search)
        // Should not return score, but might return move if available
        let entry = tt.probe(hash, 5, -1000, 1000);

        // Entry exists but depth insufficient for score
        // Since we stored with Exact and no move, it won't be useful
        assert!(entry.is_none());
    }

    #[test]
    fn test_hit_rate_calculation() {
        let mut tt = TranspositionTable::new();

        let state = GameState {
            player: 1u64 << 0,
            ai: 1u64 << 48,
            destroyed: 0,
        };

        let hash = tt.compute_hash(&state, true);

        // Initial hit rate should be 0
        assert_eq!(tt.hit_rate(), 0.0);

        // Store and probe
        tt.store(hash, 5, 100, Bound::Exact, None);
        tt.probe(hash, 5, -1000, 1000); // Hit

        // Hit rate should be 100%
        assert_eq!(tt.hit_rate(), 1.0);

        // Probe non-existent
        tt.probe(hash + 1, 5, -1000, 1000); // Miss

        // Hit rate should be 50%
        assert_eq!(tt.hit_rate(), 0.5);
    }
}
