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
  const now = new Date();
  const game = await gameStorage.createGame({
    board: INITIAL_BOARD_FEN,
    turn: 'player',
    history: [],
    winner: null,
    aiLog: "gameRoom.log.systemInitialized",
    turnCount: 0,
    difficulty,
    playerTimeRemaining: 180, // 180 seconds (3 minutes) initial time
    aiTimeRemaining: 180, // 180 seconds (3 minutes) initial time
    timePerMove: 5, // 5 seconds added per move
    lastMoveTimestamp: now.toISOString(),
  });
  
  return game;
}

export async function getGame(id: number): Promise<Game | null> {
  const game = await gameStorage.getGame(id);
  return game || null;
}

/**
 * Calculate remaining time based on elapsed time since last move
 * This is used BEFORE making a move to check if player has time left
 */
function calculateRemainingTimeBeforeMove(
  currentTimeRemaining: number | null | undefined,
  lastMoveTimestamp: Date | null | undefined
): number {
  const baseTime = currentTimeRemaining ?? 30;
  
  if (!lastMoveTimestamp) {
    return baseTime;
  }
  
  const now = new Date();
  const elapsedSeconds = Math.floor((now.getTime() - lastMoveTimestamp.getTime()) / 1000);
  return Math.max(0, baseTime - elapsedSeconds);
}

export async function makeGameMove(
  gameId: number,
  from: { r: number; c: number },
  to: { r: number; c: number }
): Promise<{ game: Game; aiLogs: string[]; playerMove?: { from: { r: number, c: number }, to: { r: number, c: number }, piece: Piece, captured?: Piece } }> {
  const game = await gameStorage.getGame(gameId);
  if (!game) {
    throw new Error("gameRoom.errors.gameNotFound");
  }

  if (game.winner) {
    throw new Error("gameRoom.errors.gameOver");
  }
  
  if (game.turn !== 'player') {
    throw new Error("gameRoom.errors.notYourTurn");
  }

  // Calculate player's remaining time BEFORE move
  const playerTimeRemaining = calculateRemainingTimeBeforeMove(
    game.playerTimeRemaining,
    game.lastMoveTimestamp
  );

  // Check if player has run out of time
  if (playerTimeRemaining <= 0) {
    const updated = await gameStorage.updateGame(gameId, {
      winner: 'ai',
      aiLog: "gameRoom.log.timeExpiredHuman"
    });
    return { game: updated, aiLogs: [] };
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
    throw new Error("gameRoom.errors.illegalMove");
  }

  // Store player move info for AI analysis (before applying move)
  const playerPiece = board[from.r][from.c];
  const capturedPiece = board[to.r][to.c]; // Check if player captured an AI piece
  const playerMove = { from, to, piece: playerPiece, captured: capturedPiece };
  
  // Apply Player Move - IMMEDIATELY update the board
  board = makeMove(board, from, to);
  const newTurnCount = (game.turnCount || 0) + 1;
  const now = new Date();
  
  // Update player time (add time bonus for making a move)
  const updatedPlayerTime = playerTimeRemaining + (game.timePerMove ?? 5);
  
  let winner = checkWinner(board, newTurnCount, updatedPlayerTime, game.aiTimeRemaining);
  
  let history = [...(game.history || [])];
  history.push(`Player: ${from.r},${from.c} -> ${to.r},${to.c}`);

  if (winner) {
    const updated = await gameStorage.updateGame(gameId, {
      board: generateFen(board),
      winner,
      history,
      turnCount: newTurnCount,
      playerTimeRemaining: updatedPlayerTime,
      lastMoveTimestamp: now,
      aiLog: winner === 'player' 
        ? "gameRoom.log.logicFailure" 
        : winner === 'draw' 
        ? "gameRoom.log.resourceDepletion" 
        : winner === 'ai' && playerTimeRemaining <= 0
        ? "gameRoom.log.timeExpiredHuman"
        : "gameRoom.log.victoryAchieved"
    });
    return { game: updated, aiLogs: [] };
  }

  // Immediately update game state with player's move (turn becomes 'ai')
  // Update lastMoveTimestamp to current time so AI's time starts counting from now
  // Player's time is frozen because isPlayerTurn will be false in calculateRemainingTime
  const playerMoveUpdated = await gameStorage.updateGame(gameId, {
    board: generateFen(board),
    turn: 'ai', // AI's turn now
    history,
    turnCount: newTurnCount,
    playerTimeRemaining: updatedPlayerTime,
    lastMoveTimestamp: now, // Update timestamp so AI's time starts counting from now
    aiLog: "gameRoom.log.analyzing"
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
    throw new Error("gameRoom.errors.gameNotFound");
  }

  if (game.winner || game.turn !== 'ai') {
    return { game, aiLogs: [] };
  }

  // Calculate AI's remaining time BEFORE move
  const aiTimeRemaining = calculateRemainingTimeBeforeMove(
    game.aiTimeRemaining,
    game.lastMoveTimestamp
  );

  // Check if AI has run out of time
  if (aiTimeRemaining <= 0) {
    const updated = await gameStorage.updateGame(gameId, {
      winner: 'player',
      aiLog: "gameRoom.log.timeExpiredAI"
    });
    return { game: updated, aiLogs: [] };
  }

  const board = parseFen(game.board);
  const newTurnCount = game.turnCount || 0;

  // AI Turn - measure actual calculation time and ensure smooth UX
  // Calculate minimum analysis time based on board complexity for UX (800ms - 1500ms)
  // This maintains the same "thinking time" as before to preserve game tension
  const boardComplexity = board.flat().filter(p => p !== null).length;
  const minAnalysisTime = 800 + Math.min(700, boardComplexity * 50) + Math.random() * 200;
  
  // Record actual calculation start time
  const calculationStartTime = Date.now();
  
  // Use game difficulty (default to NEXUS-7 for backward compatibility)
  const gameDifficulty = (game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || "NEXUS-7";
  
  // OPTIMIZATION: With depth 6, calculation should complete in <1 second
  // Measure actual time spent on calculation
  let aiResult: { move: { from: { r: number, c: number }, to: { r: number, c: number } } | null; logs: string[] };
  
  try {
    aiResult = getAIMove(board, playerMove, gameDifficulty, newTurnCount);
  } catch (error) {
    console.error("AI calculation error:", error);
    aiResult = { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
  }
  
  // Calculate actual time spent on calculation
  const actualCalculationTime = Date.now() - calculationStartTime;
  const calculationTimeSeconds = Math.floor(actualCalculationTime / 1000);
  
  // Ensure minimum analysis time for UX (maintains game tension)
  // This ensures AI always takes 800-1500ms to "think", preserving the psychological impact
  // Even though actual calculation is now fast (<100ms), we wait to maintain the same feel
  const remainingMinTime = Math.max(0, minAnalysisTime - actualCalculationTime);
  if (remainingMinTime > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingMinTime));
  }
  
  // Recalculate AI time after actual calculation
  // Only count actual calculation time for fairness (not the UX delay)
  // The UX delay (800-1500ms) is for psychological impact, not actual thinking time
  const aiTimeAfterThinking = Math.max(0, aiTimeRemaining - calculationTimeSeconds);
  
  // Final check if AI ran out of time after thinking
  if (aiTimeAfterThinking <= 0) {
    const updated = await gameStorage.updateGame(gameId, {
      winner: 'player',
      aiLog: "gameRoom.log.timeExpiredDuringCalculation"
    });
    return { game: updated, aiLogs: [] };
  }
  let aiLog = "gameRoom.log.processing";
  let aiLogs: string[] = [];
  
  if (aiResult.move) {
    const aiMoveBoard = makeMove(board, aiResult.move.from, aiResult.move.to);
    const moveStr = `AI: ${aiResult.move.from.r},${aiResult.move.from.c} -> ${aiResult.move.to.r},${aiResult.move.to.c}`;
    const aiHistory = [...game.history, moveStr];
    const now = new Date();
    
    // Update AI time (add time bonus for making a move)
    // Use aiTimeAfterThinking which accounts for actual calculation time
    const updatedAiTime = aiTimeAfterThinking + (game.timePerMove ?? 5);
    
    const aiWinner = checkWinner(aiMoveBoard, newTurnCount, game.playerTimeRemaining, updatedAiTime);
    
    // Store the single psychological insight message
    aiLogs = aiResult.logs;
    aiLog = aiResult.logs[0] || "gameRoom.log.moveExecuted";
    
    const updated = await gameStorage.updateGame(gameId, {
      board: generateFen(aiMoveBoard),
      turn: 'player', // Back to player
      winner: aiWinner,
      history: aiHistory,
      turnCount: newTurnCount,
      aiTimeRemaining: updatedAiTime,
      lastMoveTimestamp: now,
      aiLog
    });
    
    return { game: updated, aiLogs };
  } else {
    const updated = await gameStorage.updateGame(gameId, {
      turn: 'player',
      winner: 'player',
      aiLog: "gameRoom.log.calculationError"
    });
    return { game: updated, aiLogs: ["gameRoom.log.calculationErrorKo"] };
  }
}
