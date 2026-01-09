// Client-side game engine (no server needed)
import { parseFen, generateFen, isValidMove, makeMove, checkWinner, getAIMove, INITIAL_BOARD_FEN, type Piece } from "@shared/gameLogic";
import type { Game } from "@shared/schema";
import { gameStorage } from "./storage";

// Simple AI reasoning generator (no OpenAI needed for offline mode)
function generateSimpleAIReasoning(boardFen: string, move: string): string {
  const reasons = [
    "Calculating optimal path. Probability of success: 87.3%.",
    "Sacrifice protocol engaged. Short-term loss, long-term gain.",
    "Positional advantage detected. Advancing strategic position.",
    "Threat assessment complete. Counter-attack initiated.",
    "Material exchange calculated. Net positive outcome.",
    "King advancement prioritized. Victory path identified.",
    "Defensive structure analyzed. Weakness exploited.",
    "Tactical sequence initiated. Human response predicted.",
  ];
  
  // Use board state to pick a reason (deterministic but varied)
  const hash = boardFen.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return reasons[hash % reasons.length];
}

export async function createGame(difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7"): Promise<Game> {
  const game = await gameStorage.createGame({
    board: INITIAL_BOARD_FEN,
    turn: 'player',
    history: [],
    winner: null,
    aiLog: "System Initialized. Awaiting input...",
    turnCount: 0,
    difficulty,
  });
  
  return game;
}

export async function getGame(id: number): Promise<Game | null> {
  const game = await gameStorage.getGame(id);
  return game || null;
}

export async function makeGameMove(
  gameId: number,
  from: { r: number; c: number },
  to: { r: number; c: number }
): Promise<{ game: Game; aiLogs: string[]; playerMove?: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece } }> {
  const game = await gameStorage.getGame(gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.winner) {
    throw new Error("Game over");
  }
  
  if (game.turn !== 'player') {
    throw new Error("Not your turn");
  }

  let board = parseFen(game.board);

  // Debug: Log board state and move attempt
  console.log("Attempting move:", { from, to, gameId });
  console.log("Board state:", board);
  console.log("Piece at from:", board[from.r]?.[from.c]);
  console.log("Piece at to:", board[to.r]?.[to.c]);

  // Validate Player Move
  if (!isValidMove(board, from, to, true)) {
    // Debug: Log why move is invalid
    const piece = board[from.r]?.[from.c];
    const target = board[to.r]?.[to.c];
    console.error("Invalid move details:", {
      from,
      to,
      piece,
      target,
      pieceIsLowercase: piece ? piece === piece.toLowerCase() : null,
      isPlayer: piece ? piece === piece.toLowerCase() && piece !== piece.toUpperCase() : null
    });
    throw new Error("Illegal move");
  }

  // Store player move info for AI analysis (before applying move)
  const playerPiece = board[from.r][from.c];
  const capturedPiece = board[to.r][to.c]; // Check if player captured an AI piece
  const playerMove = { from, to, piece: playerPiece, captured: capturedPiece };
  
  // Apply Player Move - IMMEDIATELY update the board
  board = makeMove(board, from, to);
  const newTurnCount = (game.turnCount || 0) + 1;
  let winner = checkWinner(board, newTurnCount);
  
  let history = [...(game.history || [])];
  history.push(`Player: ${from.r},${from.c} -> ${to.r},${to.c}`);

  if (winner) {
    const updated = await gameStorage.updateGame(gameId, {
      board: generateFen(board),
      winner,
      history,
      turnCount: newTurnCount,
      aiLog: winner === 'player' 
        ? "Logic Failure. Human Victory." 
        : winner === 'draw' 
        ? "Resource Depletion. Draw." 
        : "Victory Achieved."
    });
    return { game: updated, aiLogs: [] };
  }

  // Immediately update game state with player's move (turn becomes 'ai')
  const playerMoveUpdated = await gameStorage.updateGame(gameId, {
    board: generateFen(board),
    turn: 'ai', // AI's turn now
    history,
    turnCount: newTurnCount,
    aiLog: "Analyzing..."
  });

  // Return immediately with player's move applied
  // AI calculation will be handled separately
  return { game: playerMoveUpdated, aiLogs: [], playerMove };
}

/**
 * Calculate and apply AI move (called separately after player move)
 */
export async function calculateAIMove(
  gameId: number,
  playerMove: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece }
): Promise<{ game: Game; aiLogs: string[] }> {
  const game = await gameStorage.getGame(gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.winner || game.turn !== 'ai') {
    return { game, aiLogs: [] };
  }

  const board = parseFen(game.board);
  const newTurnCount = game.turnCount || 0;

  // AI Turn - simulate deep analysis with delay
  // Calculate analysis time based on board complexity (800ms - 1500ms)
  const boardComplexity = board.flat().filter(p => p !== null).length;
  const analysisTime = 800 + Math.min(700, boardComplexity * 50) + Math.random() * 200;
  
  // Simulate AI thinking process
  await new Promise(resolve => setTimeout(resolve, analysisTime));
  
  // AI Turn - pass player's last move for psychological analysis
  // Use game difficulty (default to NEXUS-7 for backward compatibility)
  const gameDifficulty = (game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || "NEXUS-7";
  const aiResult = getAIMove(board, playerMove, gameDifficulty);
  let aiLog = "Processing...";
  let aiLogs: string[] = [];
  
  if (aiResult.move) {
    const aiMoveBoard = makeMove(board, aiResult.move.from, aiResult.move.to);
    const moveStr = `AI: ${aiResult.move.from.r},${aiResult.move.from.c} -> ${aiResult.move.to.r},${aiResult.move.to.c}`;
    const aiHistory = [...game.history, moveStr];
    const aiWinner = checkWinner(aiMoveBoard, newTurnCount);
    
    // Store the single psychological insight message
    aiLogs = aiResult.logs;
    aiLog = aiResult.logs[0] || "Move executed.";
    
    const updated = await gameStorage.updateGame(gameId, {
      board: generateFen(aiMoveBoard),
      turn: 'player', // Back to player
      winner: aiWinner,
      history: aiHistory,
      turnCount: newTurnCount,
      aiLog
    });
    
    return { game: updated, aiLogs };
  } else {
    const updated = await gameStorage.updateGame(gameId, {
      turn: 'player',
      winner: 'player',
      aiLog: "Calculation error. No valid moves."
    });
    return { game: updated, aiLogs: ["계산 오류: 유효한 수가 없습니다."] };
  }
}
