use wasm_bindgen::prelude::*;
use rand::prelude::*;
use serde::{Serialize, Deserialize};

// --- Constants ---
const BOARD_ROWS: usize = 11;
const BOARD_COLS: usize = 11;
const NUM_CELLS: usize = BOARD_ROWS * BOARD_COLS;
// Virtual nodes for connection checking
const VIRTUAL_TOP: usize = NUM_CELLS;
const VIRTUAL_BOTTOM: usize = NUM_CELLS + 1;
const VIRTUAL_LEFT: usize = NUM_CELLS;
const VIRTUAL_RIGHT: usize = NUM_CELLS + 1;

// --- Types ---
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Player {
    None = 0,
    Human = 1, // Moves Left <-> Right
    AI = 2,    // Moves Top <-> Bottom
}

impl Player {
    fn opponent(&self) -> Player {
        match self {
            Player::Human => Player::AI,
            Player::AI => Player::Human,
            Player::None => Player::None,
        }
    }
}

// --- Analysis Types ---
#[derive(Serialize)]
pub struct MoveInfo {
    r: usize,
    c: usize,
    visits: u32,
    wins: u32,
    win_rate: f64,
}

#[derive(Serialize)]
pub struct AnalysisResult {
    best_move: Option<MoveInfo>,
    alternatives: Vec<MoveInfo>,
    total_simulations: u32,
    elapsed_ms: f64,
    nps: f64,
}

// --- Union-Find (Disjoint Set) ---
#[derive(Clone)]
struct UnionFind {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl UnionFind {
    fn new(size: usize) -> Self {
        let mut parent = Vec::with_capacity(size);
        for i in 0..size {
            parent.push(i);
        }
        UnionFind {
            parent,
            rank: vec![0; size],
        }
    }

    fn find(&mut self, i: usize) -> usize {
        if self.parent[i] != i {
            self.parent[i] = self.find(self.parent[i]);
        }
        self.parent[i]
    }

    fn union(&mut self, i: usize, j: usize) {
        let root_i = self.find(i);
        let root_j = self.find(j);

        if root_i != root_j {
            if self.rank[root_i] < self.rank[root_j] {
                self.parent[root_i] = root_j;
            } else if self.rank[root_i] > self.rank[root_j] {
                self.parent[root_j] = root_i;
            } else {
                self.parent[root_j] = root_i;
                self.rank[root_i] += 1;
            }
        }
    }

    fn connected(&mut self, i: usize, j: usize) -> bool {
        self.find(i) == self.find(j)
    }
}

// --- Game State ---
#[derive(Clone)]
struct GameState {
    board: Vec<Player>,
    empty_cells: Vec<usize>,
    uf_human: UnionFind,
    uf_ai: UnionFind,
    last_move: Option<usize>,
    turn_count: usize,
}

impl GameState {
    fn new() -> Self {
        let board = vec![Player::None; NUM_CELLS];
        let empty_cells: Vec<usize> = (0..NUM_CELLS).collect();
        let uf_human = UnionFind::new(NUM_CELLS + 2);
        let uf_ai = UnionFind::new(NUM_CELLS + 2);

        let mut state = GameState {
            board,
            empty_cells,
            uf_human,
            uf_ai,
            last_move: None,
            turn_count: 0,
        };
        state.init_virtual_connections();
        state
    }

    fn init_virtual_connections(&mut self) {
        for r in 0..BOARD_ROWS {
            for c in 0..BOARD_COLS {
                let idx = r * BOARD_COLS + c;
                
                // Human: Left (c=0) <-> Right (c=MAX)
                if c == 0 { self.uf_human.union(idx, VIRTUAL_LEFT); }
                if c == BOARD_COLS - 1 { self.uf_human.union(idx, VIRTUAL_RIGHT); }

                // AI: Top (r=0) <-> Bottom (r=MAX)
                if r == 0 { self.uf_ai.union(idx, VIRTUAL_TOP); }
                if r == BOARD_ROWS - 1 { self.uf_ai.union(idx, VIRTUAL_BOTTOM); }
            }
        }
    }

    // FIX: Odd-r Offset Coordinate System
    // Matches client/src/lib/games/entropy/types.ts EXACTLY
    fn get_neighbors(idx: usize) -> Vec<usize> {
        let r = idx / BOARD_COLS;
        let c = idx % BOARD_COLS;
        let mut neighbors = Vec::with_capacity(6);

        let is_even_row = r % 2 == 0;
        
        // Offsets based on Row Parity (Odd-r layout)
        let offsets: &[(isize, isize)] = if is_even_row {
            &[
                (-1, -1), (-1, 0), // Top-Left, Top-Right
                (0, -1),  (0, 1),  // Left, Right
                (1, -1),  (1, 0)   // Bottom-Left, Bottom-Right
            ]
        } else {
            &[
                (-1, 0), (-1, 1), // Top-Left, Top-Right
                (0, -1), (0, 1),  // Left, Right
                (1, 0),  (1, 1)   // Bottom-Left, Bottom-Right
            ]
        };

        for (dr, dc) in offsets.iter() {
            let nr = r as isize + dr;
            let nc = c as isize + dc;
            if nr >= 0 && nr < BOARD_ROWS as isize && nc >= 0 && nc < BOARD_COLS as isize {
                neighbors.push((nr as usize) * BOARD_COLS + (nc as usize));
            }
        }
        neighbors
    }

    fn make_move(&mut self, idx: usize, player: Player) {
        // Assume valid move check is done by caller for performance
        self.board[idx] = player;
        self.last_move = Some(idx);
        
        // Optimized remove
        if let Some(pos) = self.empty_cells.iter().position(|&x| x == idx) {
            self.empty_cells.swap_remove(pos);
        }

        let neighbors = Self::get_neighbors(idx);
        match player {
            Player::Human => {
                let c = idx % BOARD_COLS;
                // Note: Virtual connections are pre-seeded, but we only care about
                // connectivity THROUGH stones. 
                // However, our init_virtual_connections unioned the CELL to VIRTUAL.
                // So if we place a stone, we just need to union with neighbor stones
                // and if the cell is on edge, it's already implicitly connected to Virtual 
                // via the UF initialization.
                // Wait, UF tracks sets. If (0,0) is unioned to LEFT, then any stone placed at (0,0)
                // is "in the set containing LEFT". 
                // So we just need to union with Neighbors who are ALSO Human.
                
                for &n in &neighbors {
                    if self.board[n] == Player::Human {
                        self.uf_human.union(idx, n);
                    }
                }
            },
            Player::AI => {
                for &n in &neighbors {
                    if self.board[n] == Player::AI {
                        self.uf_ai.union(idx, n);
                    }
                }
            },
            _ => {}
        }
        self.turn_count += 1;
    }

    fn check_winner(&mut self) -> Player {
        if self.uf_human.connected(VIRTUAL_LEFT, VIRTUAL_RIGHT) {
            return Player::Human;
        }
        if self.uf_ai.connected(VIRTUAL_TOP, VIRTUAL_BOTTOM) {
            return Player::AI;
        }
        Player::None
    }
}

// --- MCTS Engine ---
struct MCTSNode {
    move_idx: Option<usize>,
    parent: Option<usize>,
    children: Vec<usize>,
    wins: f64,
    visits: f64,
    untried_moves: Vec<usize>,
    player: Player, // Player who made the move to reach this state
}

struct MCTSEngine {
    nodes: Vec<MCTSNode>,
    root_state: GameState,
    start_player: Player, // The player requesting the move (AI)
}

impl MCTSEngine {
    fn new(state: GameState, player: Player) -> Self {
        let root = MCTSNode {
            move_idx: None,
            parent: None,
            children: Vec::new(),
            wins: 0.0,
            visits: 0.0,
            untried_moves: state.empty_cells.clone(),
            player: player.opponent(), // Root represents state BEFORE we move
        };
        
        MCTSEngine {
            nodes: vec![root],
            root_state: state,
            start_player: player,
        }
    }

    fn expand(&mut self, node_idx: usize, state: &mut GameState) -> usize {
        let node = &mut self.nodes[node_idx];
        if node.untried_moves.is_empty() {
            return node_idx;
        }

        // Heuristic Expansion: Prefer moves near last move (Locality)
        // This is much better than pure random for Hex
        let mut move_idx_idx = 0;
        let mut best_dist = i32::MAX;
        
        if let Some(last) = state.last_move {
            let lr = (last / BOARD_COLS) as i32;
            let lc = (last % BOARD_COLS) as i32;
            
            // Sample 5 random moves and pick closest to action
            let sample_count = std::cmp::min(5, node.untried_moves.len());
            for _ in 0..sample_count {
                let idx = rand::thread_rng().gen_range(0..node.untried_moves.len());
                let m = node.untried_moves[idx];
                let mr = (m / BOARD_COLS) as i32;
                let mc = (m % BOARD_COLS) as i32;
                let dist = (lr - mr).abs() + (lc - mc).abs();
                if dist < best_dist {
                    best_dist = dist;
                    move_idx_idx = idx;
                }
            }
        } else {
             move_idx_idx = rand::thread_rng().gen_range(0..node.untried_moves.len());
        }

        let move_idx = node.untried_moves.remove(move_idx_idx);
        let player = node.player.opponent();
        state.make_move(move_idx, player);

        let new_node = MCTSNode {
            move_idx: Some(move_idx),
            parent: Some(node_idx),
            children: Vec::new(),
            wins: 0.0,
            visits: 0.0,
            untried_moves: state.empty_cells.clone(),
            player,
        };

        let new_node_idx = self.nodes.len();
        self.nodes.push(new_node);
        self.nodes[node_idx].children.push(new_node_idx);

        new_node_idx
    }

    fn simulate(&self, state: &mut GameState) -> Player {
        let mut rng = rand::thread_rng();
        let mut current_player = self.nodes.last().unwrap().player.opponent();

        loop {
            let winner = state.check_winner();
            if winner != Player::None {
                return winner;
            }
            if state.empty_cells.is_empty() {
                // Should not happen in Hex, but needed for safety
                return Player::None;
            }

            // Enhanced Simulation Policy (Bridge & Locality)
            // 1. Critical: If I can connect to my virtual edge immediately, do it.
            // (Expensive to check every move in simulation, so we skip for speed)
            
            // 2. Locality: Prefer playing near existing stones
            // Simple approach: pure random is faster (higher nps), 
            // but weighted random is smarter. 
            // For now, stick to fast random to keep NPS high, 
            // counting on MCTS tree to handle strategy.
            let move_idx_idx = rng.gen_range(0..state.empty_cells.len());
            let move_idx = state.empty_cells[move_idx_idx];
            
            state.make_move(move_idx, current_player);
            current_player = current_player.opponent();
        }
    }

    fn backpropagate(&mut self, node_idx: usize, winner: Player) {
        let mut curr = Some(node_idx);
        while let Some(idx) = curr {
            let node = &mut self.nodes[idx];
            node.visits += 1.0;
            
            // VITAL FIX: Win Attribution
            // If the winner represents the player who moved to create this node,
            // then this move was a "Winning Move".
            if node.player == winner {
                node.wins += 1.0;
            }
            curr = node.parent;
        }
    }

    fn search(&mut self, time_limit_ms: u32) -> AnalysisResult {
        let start = js_sys::Date::now();
        let mut iterations = 0;

        while js_sys::Date::now() - start < time_limit_ms as f64 {
            let mut state = self.root_state.clone();
            
            // 1. Selection
            let mut curr_idx = 0;
            loop {
                let node = &self.nodes[curr_idx];
                if !node.untried_moves.is_empty() || node.children.is_empty() {
                    break;
                }
                
                // UCT Selection
                let mut best_score = -1.0;
                let mut best_child = 0;
                let log_visits = node.visits.ln();
                
                for &c_idx in &node.children {
                    let child = &self.nodes[c_idx];
                    
                    // Standard UCB1
                    // Note: child.wins is relative to child.player.
                    // But we (parent) want to choose the move that is best for child.player?
                    // NO. We are 'parent.player'. We want to choose a move 
                    // that leads to a state BAD for the opponent?
                    // Or: In standard MCTS, we maximize value from the perspective of the player making the choice.
                    // Here, children represent the state AFTER we move. 
                    // So child.player IS us (the one who moved).
                    // So child.wins = Our Wins. We want to Maximize this.
                    
                    let exploitation = child.wins / child.visits;
                    let exploration = 1.41 * (log_visits / child.visits).sqrt();
                    let score = exploitation + exploration;
                    
                    if score > best_score {
                         best_score = score;
                         best_child = c_idx;
                    }
                }
                
                let child_node = &self.nodes[best_child];
                if let Some(m) = child_node.move_idx {
                    state.make_move(m, child_node.player);
                }
                curr_idx = best_child;
            }

            // 2. Expansion
            let new_node_idx = self.expand(curr_idx, &mut state);

            // 3. Simulation
            let winner = self.simulate(&mut state);

            // 4. Backpropagate
            self.backpropagate(new_node_idx, winner);
            
            iterations += 1;
        }

        let elapsed = js_sys::Date::now() - start;

        // Results
        let root = &self.nodes[0];
        let mut children_indices: Vec<usize> = root.children.clone();
        
        children_indices.sort_by(|&a, &b| {
            let visits_a = self.nodes[a].visits;
            let visits_b = self.nodes[b].visits;
            visits_b.partial_cmp(&visits_a).unwrap()
        });

        let mut alternatives = Vec::new();
        let mut best_move = None;

        for (i, &idx) in children_indices.iter().enumerate() {
            let node = &self.nodes[idx];
            if let Some(m) = node.move_idx {
                let info = MoveInfo {
                    r: m / BOARD_COLS,
                    c: m % BOARD_COLS,
                    visits: node.visits as u32,
                    wins: node.wins as u32,
                    win_rate: if node.visits > 0.0 { node.wins / node.visits } else { 0.0 },
                };

                if i == 0 {
                    best_move = Some(info);
                } else if i < 5 {
                    alternatives.push(info);
                }
            }
        }

        AnalysisResult {
            best_move,
            alternatives,
            total_simulations: iterations,
            elapsed_ms: elapsed,
            nps: (iterations as f64) / (elapsed / 1000.0),
        }
    }
}

// --- WASM Bindings ---
#[wasm_bindgen]
pub struct EntropyWasmEngine {}

#[wasm_bindgen]
impl EntropyWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self {} }

    pub fn get_best_move(
        &self, 
        board_array: &[u8], 
        is_ai_turn: bool,
        time_limit_ms: u32
    ) -> Result<JsValue, JsValue> {
        if board_array.len() != NUM_CELLS {
            return Err(JsValue::from_str("Invalid board size"));
        }

        let mut state = GameState::new();
        for (i, &val) in board_array.iter().enumerate() {
            if val == 1 { state.make_move(i, Player::Human); } 
            else if val == 2 { state.make_move(i, Player::AI); }
        }

        let player = if is_ai_turn { Player::AI } else { Player::Human };
        let mut engine = MCTSEngine::new(state, player);
        let result = engine.search(time_limit_ms);

        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
}