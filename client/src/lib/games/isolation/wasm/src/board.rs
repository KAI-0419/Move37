
use serde::{Serialize, Deserialize};
use crate::bitboard::*;

#[derive(Clone, Copy, Debug)]
pub struct GameState {
    pub player: u64,
    pub ai: u64,
    pub destroyed: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub struct Move {
    pub from: (u8, u8),
    pub to: (u8, u8),
    pub destroy: (u8, u8),
    pub score: i32,
}

impl GameState {
    pub fn new() -> Self {
        // Default positions (just placeholder)
        // Player: (0, 0), AI: (6, 6)
        Self {
            player: 1u64 << 0,
            ai: 1u64 << 48, // 7*7-1 = 48
            destroyed: 0,
        }
    }

    pub fn from_raw(player_r: u8, player_c: u8, ai_r: u8, ai_c: u8, destroyed: &[u8]) -> Self {
        // Defensive: Clamp coordinates to valid range
        let player_r = player_r.min(BOARD_SIZE - 1);
        let player_c = player_c.min(BOARD_SIZE - 1);
        let ai_r = ai_r.min(BOARD_SIZE - 1);
        let ai_c = ai_c.min(BOARD_SIZE - 1);

        let mut d_mask = 0u64;
        
        // destroyed comes as flat array [r1, c1, r2, c2...]
        for chunk in destroyed.chunks(2) {
            if chunk.len() == 2 {
                d_mask |= pos_to_mask(chunk[0], chunk[1]);
            }
        }

        Self {
            player: pos_to_mask(player_r, player_c),
            ai: pos_to_mask(ai_r, ai_c),
            destroyed: d_mask,
        }
    }

    pub fn get_valid_moves(&self, is_ai: bool) -> Vec<Move> {
        let (my_pos, opp_pos) = if is_ai { (self.ai, self.player) } else { (self.player, self.ai) };
        let blocked = self.destroyed | opp_pos; // Can't move through opponent
        
        let my_idx = my_pos.trailing_zeros() as u8;
        let (r, c) = index_to_pos(my_idx);
        
        let move_mask = get_queen_moves(r, c, blocked);
        let mut moves = Vec::with_capacity(32);

        let mut temp_moves = move_mask;
        while temp_moves != 0 {
            let to_idx = temp_moves.trailing_zeros() as u8;
            let to_pos = index_to_pos(to_idx);
            let _to_mask = 1u64 << to_idx;

            // Destroy logic
            // After moving, we can destroy any empty cell EXCEPT the one we are on
            // The position 'my_pos' becomes empty (since we moved from it)
            // But we are now at 'to_pos'.
            
            // New blocked for destroy = destroyed | opp_pos | to_pos (can't destroy where we are)
            // Can we destroy where we came from? YES.
            
            // Optimization: We don't need to check "reachability" for destroy in standard Isolation?
            // "You can remove ANY single square from the board that is not occupied."
            // Rules vary. Standard Isolation: "Remove ONE square of your choice" (anywhere).
            // BUT this codebase implements "Queen Isolation" where you usually destroy.
            // Let's check `moveValidation.ts`:
            // `getValidDestroyPositions`: "Get all empty cells (excluding the new piece position)"
            // It calls `getEmptyCells`.
            // So you can destroy ANY empty cell on the board, not just adjacent ones.
            
            // To reduce branching factor, we should probably limit destroys or use heuristic.
            // But for correctness first:
            // A move consists of (To, Destroy).
            // Destroy candidates = All empty cells ( ~ (destroyed | opp_pos | to_pos) )
            
            // Generating ALL destroys (40+) for EVERY move (10+) = 400 branches per node.
            // This is huge. The TS code does `quickFilterDestroys`.
            // We MUST implement `quickFilterDestroys` logic here too or it will be too slow.
            // For `get_valid_moves` (used for legal checks), we might need all?
            // Actually, we usually use this for search.
            
            // For now, let's just return the "Move" part (to) and handle destroy selection in search?
            // Or return a structure that implies "Move to X, then destroy Y".
            
            // Let's stick to the TS logic: Return moves with destroy.
            // But to save memory, maybe we yield an iterator?
            
            // Simplification: Just return the Move 'To' parts first.
            // The Search will expand the 'Destroy' parts lazily.
            
            moves.push(Move {
                from: (r, c),
                to: to_pos,
                destroy: (0, 0), // Placeholder
                score: 0,
            });

            temp_moves &= temp_moves - 1;
        }

        moves
    }
}
