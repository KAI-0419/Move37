use wasm_bindgen::prelude::*;
use rand::prelude::*;
use serde::{Serialize, Deserialize};

// --- Constants ---
const BOARD_ROWS: usize = 11;
const BOARD_COLS: usize = 11;
const NUM_CELLS: usize = BOARD_ROWS * BOARD_COLS;
// Virtual nodes for Union-Find
const VIRTUAL_TOP: usize = NUM_CELLS;
const VIRTUAL_BOTTOM: usize = NUM_CELLS + 1;
const VIRTUAL_LEFT: usize = NUM_CELLS;
const VIRTUAL_RIGHT: usize = NUM_CELLS + 1;

// --- Config Struct ---
struct EngineConfig {
    max_simulations: u32,
    playout_heuristic_chance: f64,
    selection_temperature: f64, // 0.0 = Deterministic, >0.0 = Softmax
}

impl EngineConfig {
    fn for_difficulty(level: u32) -> Self {
        match level {
            3 => EngineConfig {
                max_simulations: 30_000,
                playout_heuristic_chance: 0.05,
                selection_temperature: 0.5, // Significant randomness in final choice
            },
            5 => EngineConfig {
                max_simulations: 80_000,
                playout_heuristic_chance: 0.15,
                selection_temperature: 0.1, // Slight noise, mostly best move
            },
            7 | _ => EngineConfig {
                max_simulations: 1_000_000, // Effectively unlimited by time
                playout_heuristic_chance: 0.30, // Strong defensive heuristics
                selection_temperature: 0.0, // Strict best move
            },
        }
    }
}

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
        let mut root = i;
        while root != self.parent[root] {
            root = self.parent[root];
        }
        let mut curr = i;
        while curr != root {
            let next = self.parent[curr];
            self.parent[curr] = root;
            curr = next;
        }
        root
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
    empty_cells_map: Vec<usize>, 
    uf_human: UnionFind,
    uf_ai: UnionFind,
    last_move: Option<usize>,
    turn_count: usize,
}

impl GameState {
    fn new() -> Self {
        let board = vec![Player::None; NUM_CELLS];
        let empty_cells: Vec<usize> = (0..NUM_CELLS).collect();
        let empty_cells_map: Vec<usize> = (0..NUM_CELLS).collect();
        
        let uf_human = UnionFind::new(NUM_CELLS + 2);
        let uf_ai = UnionFind::new(NUM_CELLS + 2);

        let mut state = GameState {
            board, 
            empty_cells, 
            empty_cells_map,
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
                if c == 0 { self.uf_human.union(idx, VIRTUAL_LEFT); }
                if c == BOARD_COLS - 1 { self.uf_human.union(idx, VIRTUAL_RIGHT); }
                if r == 0 { self.uf_ai.union(idx, VIRTUAL_TOP); }
                if r == BOARD_ROWS - 1 { self.uf_ai.union(idx, VIRTUAL_BOTTOM); }
            }
        }
    }

    #[inline(always)]
    fn get_neighbors(idx: usize) -> smallvec::SmallVec<[usize; 6]> {
        let r = idx / BOARD_COLS;
        let c = idx % BOARD_COLS;
        let mut neighbors = smallvec::SmallVec::new();
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
        
        let vec_idx = self.empty_cells_map[idx];
        let last_elem_idx = self.empty_cells.len() - 1;
        let last_elem = self.empty_cells[last_elem_idx];

        self.empty_cells.swap_remove(vec_idx);
        
        if vec_idx != last_elem_idx {
            self.empty_cells_map[last_elem] = vec_idx;
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

    fn evaluate_bridge_potential(&self, idx: usize, player: Player) -> i32 {
        let neighbors = Self::get_neighbors(idx);
        let opponent = player.opponent();
        
        let mut my_neighbors = 0;
        let mut opp_neighbors = 0;
        
        for &n in &neighbors {
            match self.board[n] {
                p if p == player => my_neighbors += 1,
                p if p == opponent => opp_neighbors += 1,
                _ => {}
            }
        }

        let mut score = 0;
        if my_neighbors >= 2 { score += 40; }
        if opp_neighbors >= 2 { score += 60; }
        score
    }
}

// --- MCTS Node ---
struct MCTSNode {
    move_idx: Option<usize>,
    parent: Option<usize>,
    children: Vec<usize>,
    
    wins: f64,
    visits: f64,
    
    rave_wins: f64,
    rave_visits: f64,
    
    untried_moves: Vec<usize>,
    player: Player,
}

struct MCTSEngine {
    nodes: Vec<MCTSNode>,
    root_state: GameState,
    config: EngineConfig,
}

impl MCTSEngine {
    fn new(state: GameState, player: Player, config: EngineConfig) -> Self {
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
            config,
        }
    }

    fn expand(&mut self, node_idx: usize, state: &mut GameState) -> usize {
        let node = &mut self.nodes[node_idx];
        if node.untried_moves.is_empty() { return node_idx; }

        let current_player = node.player.opponent();

        // Sample and pick best from untried
        let sample_count = std::cmp::min(15, node.untried_moves.len());
        let mut best_idx_in_untried = 0;
        let mut best_score = -10000;
        
        let mut rng = rand::thread_rng();

        for _ in 0..sample_count {
            let idx = rng.gen_range(0..node.untried_moves.len());
            let m = node.untried_moves[idx];
            
            let mut score = 0;
            
            // Centrality
            let r = (m / BOARD_COLS) as i32;
            let c = (m % BOARD_COLS) as i32;
            let center_r = BOARD_ROWS as i32 / 2;
            let center_c = BOARD_COLS as i32 / 2;
            let dist_from_center = (r - center_r).abs() + (c - center_c).abs();
            score -= dist_from_center * 2;

            score += state.evaluate_bridge_potential(m, current_player);
            
            if let Some(last) = state.last_move {
                let lr = (last / BOARD_COLS) as i32;
                let lc = (last % BOARD_COLS) as i32;
                let dist = (r - lr).abs() + (c - lc).abs();
                if dist <= 3 { score += 20; }
            }

            if score > best_score {
                best_score = score;
                best_idx_in_untried = idx;
            }
        }

        let move_idx = node.untried_moves.swap_remove(best_idx_in_untried);
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

    fn simulate(&self, state: &mut GameState) -> (Player, Vec<usize>) {
        let mut rng = rand::thread_rng();
        let mut current_player = self.nodes.last().unwrap().player.opponent();
        let mut moves_made = Vec::with_capacity(state.empty_cells.len());

        loop {
            let winner = state.check_winner();
            if winner != Player::None {
                let winner_moves: Vec<usize> = moves_made.iter()
                    .filter(|&&(_, p)| p == winner)
                    .map(|&(m, _)| m)
                    .collect();
                return (winner, winner_moves);
            }
            if state.empty_cells.is_empty() { return (Player::None, vec![]); }

            // Dynamic Playout Policy based on Difficulty
            let use_heuristic = rng.gen_bool(self.config.playout_heuristic_chance);
            
            let move_idx;
            
            if use_heuristic && state.empty_cells.len() < 80 {
                // Heuristic pick: Try to pick a move that blocks opponent or connects self
                // Simple implementation: Check random 5 moves, pick best
                let mut best_m = state.empty_cells[0];
                let mut best_s = -100;
                
                let check_count = std::cmp::min(5, state.empty_cells.len());
                for _ in 0..check_count {
                    let idx = rng.gen_range(0..state.empty_cells.len());
                    let m = state.empty_cells[idx];
                    let score = state.evaluate_bridge_potential(m, current_player);
                    if score > best_s {
                        best_s = score;
                        best_m = m;
                    }
                }
                move_idx = best_m;
            } else {
                 let vec_idx = rng.gen_range(0..state.empty_cells.len());
                 move_idx = state.empty_cells[vec_idx];
            }

            state.make_move(move_idx, current_player);
            moves_made.push((move_idx, current_player));
            current_player = current_player.opponent();
        }
    }

    fn backpropagate(&mut self, node_idx: usize, winner: Player, winner_moves: &[usize]) {
        let mut curr = Some(node_idx);
        while let Some(idx) = curr {
            let node = &mut self.nodes[idx];
            node.visits += 1.0;
            if node.player == winner { node.wins += 1.0; }
            if let Some(m) = node.move_idx {
                if winner_moves.contains(&m) {
                    node.rave_visits += 1.0;
                    if node.player == winner { node.rave_wins += 1.0; }
                }
            }
            curr = node.parent;
        }
    }

    fn search(&mut self, time_limit_ms: u32) -> AnalysisResult {
        let start = js_sys::Date::now();
        let mut iterations = 0;
        let rave_const = 300.0;

        while iterations < self.config.max_simulations {
            let elapsed = js_sys::Date::now() - start;
            if elapsed >= time_limit_ms as f64 { break; }

            let mut state = self.root_state.clone();
            
            // 1. Selection
            let mut curr_idx = 0;
            loop {
                let node = &self.nodes[curr_idx];
                if !node.untried_moves.is_empty() || node.children.is_empty() { break; }
                
                let mut best_score = -f64::INFINITY;
                let mut best_child = 0;
                let log_visits = node.visits.ln();
                
                for &c_idx in &node.children {
                    let child = &self.nodes[c_idx];
                    
                    let uct_exploit = if child.visits > 0.0 { child.wins / child.visits } else { 0.5 };
                    let uct_explore = if child.visits > 0.0 { 1.0 * (log_visits / child.visits).sqrt() } else { 1.0 };
                    
                    let rave_exploit = if child.rave_visits > 0.0 { child.rave_wins / child.rave_visits } else { 0.5 };
                    let beta = if child.rave_visits > 0.0 {
                        rave_const / (rave_const + child.visits + child.rave_visits * 0.1) 
                    } else { 0.0 };
                    
                    let score = (1.0 - beta) * uct_exploit + beta * rave_exploit + uct_explore;

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
            let (winner, winner_moves) = self.simulate(&mut state);
            // 4. Backpropagation
            self.backpropagate(new_node_idx, winner, &winner_moves);
            iterations += 1;
        }

        let elapsed = js_sys::Date::now() - start;
        let root = &self.nodes[0];
        let mut children_indices: Vec<usize> = root.children.clone();
        
        // Final Move Selection Policy
        // Sort by visits initially
        children_indices.sort_by(|&a, &b| {
            let visits_a = self.nodes[a].visits;
            let visits_b = self.nodes[b].visits;
            visits_b.partial_cmp(&visits_a).unwrap()
        });

        let best_move_info;
        
        if self.config.selection_temperature > 0.0 {
            // Softmax selection among top candidates
            let mut rng = rand::thread_rng();
            let mut candidates = Vec::new();
            let limit = std::cmp::min(5, children_indices.len());
            let mut sum_weight = 0.0;
            
            for i in 0..limit {
                let idx = children_indices[i];
                let node = &self.nodes[idx];
                // Weight = visits ^ (1/T)
                let weight = node.visits.powf(1.0 / self.config.selection_temperature);
                candidates.push((idx, weight));
                sum_weight += weight;
            }
            
            let mut r = rng.gen::<f64>() * sum_weight;
            let mut selected_idx = children_indices[0]; // Default to best
            
            for (idx, weight) in candidates {
                r -= weight;
                if r <= 0.0 {
                    selected_idx = idx;
                    break;
                }
            }
            
            // Re-sort children list just to put selected one first for UI consistency if we wanted,
            // but here we just return the selected one as 'best_move'.
            let node = &self.nodes[selected_idx];
            if let Some(m) = node.move_idx {
                best_move_info = Some(MoveInfo {
                    r: m / BOARD_COLS,
                    c: m % BOARD_COLS,
                    visits: node.visits as u32,
                    wins: node.wins as u32,
                    win_rate: if node.visits > 0.0 { node.wins / node.visits } else { 0.0 },
                });
            } else {
                best_move_info = None;
            }

        } else {
            // Deterministic (Best Visit)
            if let Some(&idx) = children_indices.first() {
                let node = &self.nodes[idx];
                if let Some(m) = node.move_idx {
                    best_move_info = Some(MoveInfo {
                        r: m / BOARD_COLS,
                        c: m % BOARD_COLS,
                        visits: node.visits as u32,
                        wins: node.wins as u32,
                        win_rate: if node.visits > 0.0 { node.wins / node.visits } else { 0.0 },
                    });
                } else { best_move_info = None; }
            } else { best_move_info = None; }
        }

        let mut alternatives = Vec::new();
        // Just show top 5 by visits for analysis
        for (i, &idx) in children_indices.iter().enumerate() {
            if i >= 5 { break; }
            let node = &self.nodes[idx];
            if let Some(m) = node.move_idx {
                 alternatives.push(MoveInfo {
                    r: m / BOARD_COLS,
                    c: m % BOARD_COLS,
                    visits: node.visits as u32,
                    wins: node.wins as u32,
                    win_rate: if node.visits > 0.0 { node.wins / node.visits } else { 0.0 },
                });
            }
        }

        AnalysisResult {
            best_move: best_move_info,
            alternatives,
            total_simulations: iterations,
            elapsed_ms: elapsed,
            nps: if elapsed > 0.0 { (iterations as f64) / (elapsed / 1000.0) } else { 0.0 },
        }
    }
}

#[wasm_bindgen]
pub struct EntropyWasmEngine {}

#[wasm_bindgen]
impl EntropyWasmEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self {} }

    pub fn get_best_move(&self, board_array: &[u8], is_ai_turn: bool, time_limit_ms: u32, difficulty_level: u32) -> Result<JsValue, JsValue> {
        if board_array.len() != NUM_CELLS { return Err(JsValue::from_str("Invalid board size")); }
        
        let mut state = GameState::new();
        for (i, &val) in board_array.iter().enumerate() {
            if val == 1 { state.make_move(i, Player::Human); } 
            else if val == 2 { state.make_move(i, Player::AI); }
        }
        
        let player = if is_ai_turn { Player::AI } else { Player::Human };
        let config = EngineConfig::for_difficulty(difficulty_level);
        
        let mut engine = MCTSEngine::new(state, player, config);
        let result = engine.search(time_limit_ms);
        
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }
}
