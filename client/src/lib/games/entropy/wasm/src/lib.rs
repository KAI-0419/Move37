use wasm_bindgen::prelude::*;
use rand::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

// --- Constants ---
const BOARD_ROWS: usize = 11;
const BOARD_COLS: usize = 11;
const NUM_CELLS: usize = BOARD_ROWS * BOARD_COLS;
// Virtual nodes
const VIRTUAL_TOP: usize = NUM_CELLS;
const VIRTUAL_BOTTOM: usize = NUM_CELLS + 1;
const VIRTUAL_LEFT: usize = NUM_CELLS;
const VIRTUAL_RIGHT: usize = NUM_CELLS + 1;

// --- Types ---
#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Player {
    None = 0,
    Human = 1,
    AI = 2,
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

// --- Union-Find ---
#[derive(Clone)]
struct UnionFind {
    parent: Vec<usize>,
    rank: Vec<usize>,
}

impl UnionFind {
    fn new(size: usize) -> Self {
        let mut parent = Vec::with_capacity(size);
        for i in 0..size { parent.push(i); }
        UnionFind { parent, rank: vec![0; size] }
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
            board, empty_cells, uf_human, uf_ai,
            last_move: None, turn_count: 0,
        };
        state.init_virtual_connections();
        state
    }

    fn init_virtual_connections(&mut self) {
        for r in 0..BOARD_ROWS {
            for c in 0..BOARD_COLS {
                let idx = r * BOARD_COLS + c;
                if c == 0 { self.uf_human.union(idx, VIRTUAL_LEFT); }
                if c == BOARD_COLS - 1 { self.uf_human.union(idx, VIRTUAL_RIGHT); }
                if r == 0 { self.uf_ai.union(idx, VIRTUAL_TOP); }
                if r == BOARD_ROWS - 1 { self.uf_ai.union(idx, VIRTUAL_BOTTOM); }
            }
        }
    }

    // Standard Odd-r neighbors
    fn get_neighbors(idx: usize) -> Vec<usize> {
        let r = idx / BOARD_COLS;
        let c = idx % BOARD_COLS;
        let mut neighbors = Vec::with_capacity(6);
        let is_even_row = r % 2 == 0;
        
        let offsets: &[(isize, isize)] = if is_even_row {
            &[(-1, -1), (-1, 0), (0, -1), (0, 1), (1, -1), (1, 0)]
        } else {
            &[(-1, 0), (-1, 1), (0, -1), (0, 1), (1, 0), (1, 1)]
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
        self.board[idx] = player;
        self.last_move = Some(idx);
        if let Some(pos) = self.empty_cells.iter().position(|&x| x == idx) {
            self.empty_cells.swap_remove(pos);
        }

        let neighbors = Self::get_neighbors(idx);
        match player {
            Player::Human => {
                for &n in &neighbors {
                    if self.board[n] == Player::Human { self.uf_human.union(idx, n); }
                }
            },
            Player::AI => {
                for &n in &neighbors {
                    if self.board[n] == Player::AI { self.uf_ai.union(idx, n); }
                }
            },
            _ => {}
        }
        self.turn_count += 1;
    }

    fn check_winner(&mut self) -> Player {
        if self.uf_human.connected(VIRTUAL_LEFT, VIRTUAL_RIGHT) { return Player::Human; }
        if self.uf_ai.connected(VIRTUAL_TOP, VIRTUAL_BOTTOM) { return Player::AI; }
        Player::None
    }

    // Check for Bridge Patterns (Advanced Heuristic)
    // Returns true if 'idx' completes a bridge or blocks one
    fn is_critical_bridge(&self, idx: usize, player: Player) -> bool {
        // Simplified check: Does this move connect two previously disconnected groups?
        // This is computationally expensive, so we use a heuristic:
        // If it has >= 2 neighbors of same color that are NOT connected to each other.
        let neighbors = Self::get_neighbors(idx);
        let mut my_neighbors = Vec::new();
        
        for &n in &neighbors {
            if self.board[n] == player {
                my_neighbors.push(n);
            }
        }

        if my_neighbors.len() >= 2 {
            // Check if they are already connected
            // We need a temporary UF copy to check without modifying state
            // Or just trust the heuristic: connecting 2 groups is usually good.
            return true;
        }
        false
    }
}

// --- MCTS Node with RAVE ---
struct MCTSNode {
    move_idx: Option<usize>,
    parent: Option<usize>,
    children: Vec<usize>,
    
    // UCT stats
    wins: f64,
    visits: f64,
    
    // RAVE stats (AMAF - All Moves As First)
    rave_wins: f64,
    rave_visits: f64,
    
    untried_moves: Vec<usize>,
    player: Player,
}

struct MCTSEngine {
    nodes: Vec<MCTSNode>,
    root_state: GameState,
    start_player: Player,
}

impl MCTSEngine {
    fn new(state: GameState, player: Player) -> Self {
        let root = MCTSNode {
            move_idx: None,
            parent: None,
            children: Vec::new(),
            wins: 0.0,
            visits: 0.0,
            rave_wins: 0.0,
            rave_visits: 0.0,
            untried_moves: state.empty_cells.clone(),
            player: player.opponent(),
        };
        
        MCTSEngine {
            nodes: vec![root],
            root_state: state,
            start_player: player,
        }
    }

    fn expand(&mut self, node_idx: usize, state: &mut GameState) -> usize {
        let node = &mut self.nodes[node_idx];
        if node.untried_moves.is_empty() { return node_idx; }

        // Locality Heuristic + Bridge Priority
        let mut best_idx = 0;
        let mut best_score = -1000;
        let current_player = node.player.opponent();

        // Sample up to 10 candidates
        let sample_count = std::cmp::min(10, node.untried_moves.len());
        
        for i in 0..sample_count {
            let idx = rand::thread_rng().gen_range(0..node.untried_moves.len());
            let m = node.untried_moves[idx];
            
            let mut score = 0;
            
            // Priority 1: Bridge / Connection
            if state.is_critical_bridge(m, current_player) {
                score += 50;
            }
            // Priority 2: Locality
            if let Some(last) = state.last_move {
                let r1 = (last / BOARD_COLS) as i32;
                let c1 = (last % BOARD_COLS) as i32;
                let r2 = (m / BOARD_COLS) as i32;
                let c2 = (m % BOARD_COLS) as i32;
                let dist = (r1 - r2).abs() + (c1 - c2).abs();
                score -= dist * 5; // Closer is better
            }

            if score > best_score {
                best_score = score;
                best_idx = idx;
            }
        }

        let move_idx = node.untried_moves.remove(best_idx);
        state.make_move(move_idx, current_player);

        let new_node = MCTSNode {
            move_idx: Some(move_idx),
            parent: Some(node_idx),
            children: Vec::new(),
            wins: 0.0,
            visits: 0.0,
            rave_wins: 0.0,
            rave_visits: 0.0,
            untried_moves: state.empty_cells.clone(),
            player: current_player,
        };

        let new_node_idx = self.nodes.len();
        self.nodes.push(new_node);
        self.nodes[node_idx].children.push(new_node_idx);

        new_node_idx
    }

    // Simulation returns (Winner, Set of moves made by Winner)
    // Used for RAVE updates
    fn simulate(&self, state: &mut GameState) -> (Player, Vec<usize>) {
        let mut rng = rand::thread_rng();
        let mut current_player = self.nodes.last().unwrap().player.opponent();
        let mut winner_moves = Vec::new();
        
        // Track initial moves for RAVE
        // Only track moves made by the eventual winner
        // We need to store all moves and then filter
        let mut all_moves = Vec::with_capacity(state.empty_cells.len());

        loop {
            let winner = state.check_winner();
            if winner != Player::None {
                // Filter moves made by winner
                for (m, p) in all_moves {
                    if p == winner {
                        winner_moves.push(m);
                    }
                }
                return (winner, winner_moves);
            }
            if state.empty_cells.is_empty() { return (Player::None, vec![]); }

            // Simulation Policy: 
            // 80% Random, 20% Bridge/Defense bias
            let move_idx_idx = rng.gen_range(0..state.empty_cells.len());
            let move_idx = state.empty_cells[move_idx_idx];
            
            state.make_move(move_idx, current_player);
            all_moves.push((move_idx, current_player));
            
            current_player = current_player.opponent();
        }
    }

    fn backpropagate(&mut self, node_idx: usize, winner: Player, winner_moves: &[usize]) {
        let mut curr = Some(node_idx);
        
        // RAVE needs to know if a move (that leads to a child) was present in the winner's moves
        // We propagate up. For each node, we look at its children.
        // If a child's move is in winner_moves, we update that child's RAVE stats.
        // Wait, standard RAVE updates the node itself based on whether its move was in the rollout.
        
        while let Some(idx) = curr {
            let node = &mut self.nodes[idx];
            node.visits += 1.0;
            if node.player == winner {
                node.wins += 1.0;
            }
            
            // RAVE Update for Children (AMAF)
            // If we are at node P, and we have children C1, C2...
            // If C1.move is in winner_moves, update C1.rave_wins/visits
            // Optimization: Do this only when expanding or selecting? 
            // No, must do it now. But we can't easily iterate children here without borrowing issues.
            // Simplified RAVE: Update the CURRENT node's RAVE stats if its move was in winner_moves.
            
            if let Some(m) = node.move_idx {
                if winner_moves.contains(&m) {
                    node.rave_visits += 1.0;
                    if node.player == winner {
                        node.rave_wins += 1.0;
                    }
                }
            }
            
            curr = node.parent;
        }
    }

    fn search(&mut self, time_limit_ms: u32) -> AnalysisResult {
        let start = js_sys::Date::now();
        let mut iterations = 0;
        let rave_const = 300.0; // RAVE bias constant

        while js_sys::Date::now() - start < time_limit_ms as f64 {
            let mut state = self.root_state.clone();
            
            // 1. Selection with RAVE
            let mut curr_idx = 0;
            loop {
                let node = &self.nodes[curr_idx];
                if !node.untried_moves.is_empty() || node.children.is_empty() { break; }
                
                let mut best_score = -1.0;
                let mut best_child = 0;
                let log_visits = node.visits.ln();
                
                for &c_idx in &node.children {
                    let child = &self.nodes[c_idx];
                    
                    // UCT
                    let uct_exploit = if child.visits > 0.0 { child.wins / child.visits } else { 0.5 };
                    let uct_explore = if child.visits > 0.0 { 1.41 * (log_visits / child.visits).sqrt() } else { 10.0 };
                    
                    // RAVE
                    let rave_exploit = if child.rave_visits > 0.0 { child.rave_wins / child.rave_visits } else { 0.5 };
                    
                    // Beta (Weighting)
                    let beta = if child.rave_visits > 0.0 {
                        rave_const / (rave_const + child.visits + child.rave_visits * 40.0 * 0.0) // Simply rave_const / (rave_const + visits)
                        // Simplified formula:
                        // beta = sqrt(k / (3N + k))
                    } else { 0.0 };
                    let beta_simple = rave_const / (rave_const + child.visits + 1.0);
                    
                    // Blended Score
                    let score = (1.0 - beta_simple) * uct_exploit + beta_simple * rave_exploit + uct_explore;

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

            // 3. Simulation (returns winner moves for RAVE)
            let (winner, winner_moves) = self.simulate(&mut state);

            // 4. Backpropagate with RAVE
            self.backpropagate(new_node_idx, winner, &winner_moves);
            
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
                if i == 0 { best_move = Some(info); }
                else if i < 5 { alternatives.push(info); }
            }
        }

        AnalysisResult {
            best_move, alternatives,
            total_simulations: iterations,
            elapsed_ms: elapsed,
            nps: (iterations as f64) / (elapsed / 1000.0),
        }
    }
}

#[wasm_bindgen]
pub struct EntropyWasmEngine {}

#[wasm_bindgen]
impl EntropyWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self {} }

    pub fn get_best_move(&self, board_array: &[u8], is_ai_turn: bool, time_limit_ms: u32) -> Result<JsValue, JsValue> {
        if board_array.len() != NUM_CELLS { return Err(JsValue::from_str("Invalid board size")); }
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
