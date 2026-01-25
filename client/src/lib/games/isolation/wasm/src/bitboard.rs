//! Bitboard Operations
//! 
//! Board representation:
//! 7x7 Grid = 49 cells.
//! Fits into u64 (64 bits).
//! Bit 0 = (0,0), Bit 6 = (0,6), Bit 7 = (1,0)...

pub const BOARD_SIZE: u8 = 7;
pub const CELL_COUNT: u8 = 49;

// Precomputed tables (to be filled or hardcoded)
// For now, we calculate them on the fly or use macros if possible.
// In a full implementation, we'd use `lazy_static` or `const` generated arrays.

pub fn pos_to_mask(r: u8, c: u8) -> u64 {
    if r >= BOARD_SIZE || c >= BOARD_SIZE {
        return 0;
    }
    1u64 << (r * BOARD_SIZE + c)
}

pub fn index_to_pos(idx: u8) -> (u8, u8) {
    (idx / BOARD_SIZE, idx % BOARD_SIZE)
}

pub fn pos_to_index(r: u8, c: u8) -> u8 {
    r * BOARD_SIZE + c
}

pub fn count_ones(bitboard: u64) -> u32 {
    bitboard.count_ones()
}

/// Get queen moves from a position, given occupancy constraints
/// This is the "Magic Bitboard" equivalent for runtime
pub fn get_queen_moves(r: u8, c: u8, blocked: u64) -> u64 {
    let mut attacks = 0u64;
    let directions = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1)
    ];

    for (dr, dc) in directions.iter() {
        let mut nr = r as i8 + dr;
        let mut nc = c as i8 + dc;

        while nr >= 0 && nr < BOARD_SIZE as i8 && nc >= 0 && nc < BOARD_SIZE as i8 {
            let mask = 1u64 << (nr * BOARD_SIZE as i8 + nc);
            if (blocked & mask) != 0 {
                break; // Blocked
            }
            attacks |= mask;
            nr += dr;
            nc += dc;
        }
    }
    attacks
}

/// Simple floodfill to determine reachable area size
pub fn flood_fill(start: u64, blocked: u64) -> u64 {
    let mut flood = start;
    let mut frontier = start;
    
    // Iteratively expand until no new cells are found
    // A Queen move can reach anywhere in line of sight, but here we treat connectivity
    // "Reachable" means connected via queen moves.
    // Standard flood fill uses adjacent connectivity. 
    // BUT Isolation is Queen move.
    // However, for "Partition" detection, adjacent connectivity is sufficient?
    // Actually no, Queen can jump gaps? No, Queen slides.
    // If we want "Connected Component", standard 8-way adjacency is correct.
    
    // Standard 8-way dilation
    while frontier != 0 {
        let mut new_frontier = 0;
        
        // This is slow O(N) iteration. In optimized bitboard we do shifts.
        // For 7x7, shifts are: +/-1, +/-7, +/-6, +/-8
        // Need to handle wrapping (overflow from col 6 to col 0 is bad for +/-1)
        
        // Horizontal dilation
        let _not_col_a = 0xFEFEFEFEFEFEFEFEu64; // Mask to avoid wrapping left
        let _not_col_h = 0x7F7F7F7F7F7F7F7Fu64; // Mask to avoid wrapping right (for 8x8 space)
        
        // But we are 7x7 mapped to u64. Custom shifts needed.
        // Or just iterate set bits since count is low (<49).
        
        let mut temp = frontier;
        while temp != 0 {
            let _lsb = temp & (!temp + 1); // Extract lowest set bit (1 << ctz(temp)) is safer
            let idx = temp.trailing_zeros() as u8;
            let (r, c) = index_to_pos(idx);
            
            // Get all visible queen moves from here?
            // No, "connected component" usually implies adjacency.
            // In Isolation, two cells are connected if you can move between them.
            // Since pieces slide, yes, adjacency is sufficient for reachability *if* space is open.
            // So we use Queen moves.
            
            let moves = get_queen_moves(r, c, blocked);
            let meaningful_moves = moves & !flood;
            
            new_frontier |= meaningful_moves;
            flood |= meaningful_moves;
            
            temp &= temp - 1; // Clear LSB
        }
        
        frontier = new_frontier;
    }
    
    flood
}
