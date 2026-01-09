// Client-side game engine (no server needed)
import { parseFen, generateFen, isValidMove, makeMove, checkWinner, getAIMove, INITIAL_BOARD_FEN } from "@shared/gameLogic";
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

export async function createGame(): Promise<Game> {
  const game = await gameStorage.createGame({
    board: INITIAL_BOARD_FEN,
    turn: 'player',
    history: [],
    winner: null,
    aiLog: "System Initialized. Awaiting input...",
    turnCount: 0,
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
): Promise<Game> {
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

  // Apply Player Move
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
    return updated;
  }

  // AI Turn
  const aiMove = getAIMove(board);
  let aiLog = "Processing...";
  
  if (aiMove) {
    board = makeMove(board, aiMove.from, aiMove.to);
    const moveStr = `AI: ${aiMove.from.r},${aiMove.from.c} -> ${aiMove.to.r},${aiMove.to.c}`;
    history.push(moveStr);
    winner = checkWinner(board, newTurnCount);
    
    // Generate AI reasoning (simple version, no OpenAI)
    aiLog = generateSimpleAIReasoning(generateFen(board), moveStr);
  } else {
    winner = 'player';
    aiLog = "Calculation error. No valid moves.";
  }

  const updated = await gameStorage.updateGame(gameId, {
    board: generateFen(board),
    turn: 'player', // Back to player
    winner,
    history,
    turnCount: newTurnCount,
    aiLog
  });

  return updated;
}
