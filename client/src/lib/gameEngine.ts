// Client-side game engine (no server needed)
// Uses game engine factory pattern for multi-game support
import type { Game, GameType } from "@shared/schema";
import { gameStorage } from "./storage";
import { GameEngineFactory } from "./games/GameEngineFactory";
import type { IGameEngine, PlayerMove } from "@shared/gameEngineInterface";

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

/**
 * Create a new game
 * @param gameType - Type of game to create (defaults to MINI_CHESS for backward compatibility)
 * @param difficulty - AI difficulty level
 * @returns Created game
 * 
 * Uses the game engine factory to get the appropriate engine for the game type.
 */
export async function createGame(
  gameType: GameType = "MINI_CHESS",
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7" = "NEXUS-7"
): Promise<Game> {
  const now = new Date();
  
  // Get game engine for this game type
  const engine = GameEngineFactory.getEngine(gameType);
  
  // Get initial board state from the engine
  const initialBoard = engine.getInitialBoard();
  
  const game = await gameStorage.createGame({
    gameType,
    board: initialBoard,
    turn: 'player',
    history: [],
    boardHistory: [initialBoard], // 초기 보드 상태를 히스토리에 추가
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

  // Get game engine for this game type
  const engine = GameEngineFactory.getEngine(game.gameType);

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

  // Parse board to get piece info (for playerMove)
  const board = engine.parseBoard(game.board);
  const playerPiece = board[from.r]?.[from.c];
  const capturedPiece = board[to.r]?.[to.c];

  // Validate Player Move using engine
  const move: { from: { r: number; c: number }, to: { r: number; c: number } } = { from, to };
  const validation = engine.isValidMove(game.board, move, true);
  
  if (!validation.valid) {
    throw new Error(validation.error || "gameRoom.errors.illegalMove");
  }

  // Check for threefold repetition using engine
  const boardHistory = game.boardHistory || [];
  if (engine.wouldCauseRepetition(game.board, move, boardHistory)) {
    throw new Error("gameRoom.errors.threefoldRepetition");
  }

  // Store player move info for AI analysis (before applying move)
  const playerMove = { 
    from, 
    to, 
    piece: playerPiece, 
    captured: capturedPiece 
  };
  
  // Apply Player Move using engine
  const newBoardFen = engine.makeMove(game.board, move);
  const newTurnCount = (game.turnCount || 0) + 1;
  const now = new Date();
  
  // Update player time (add time bonus for making a move)
  const updatedPlayerTime = playerTimeRemaining + (game.timePerMove ?? 5);
  
  // Update board history for repetition detection
  const updatedBoardHistory = [...(game.boardHistory || []), newBoardFen];
  // 최근 20개만 유지 (메모리 최적화)
  const trimmedBoardHistory = updatedBoardHistory.slice(-20);
  
  // Check winner using engine
  let winner = engine.checkWinner(
    newBoardFen, 
    newTurnCount, 
    updatedPlayerTime, 
    game.aiTimeRemaining ?? 180
  );
  
  let history = [...(game.history || [])];
  history.push(`Player: ${from.r},${from.c} -> ${to.r},${to.c}`);

  if (winner) {
    const updated = await gameStorage.updateGame(gameId, {
      board: newBoardFen,
      boardHistory: trimmedBoardHistory,
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
  const playerMoveUpdated = await gameStorage.updateGame(gameId, {
    board: newBoardFen,
    boardHistory: trimmedBoardHistory,
    turn: 'ai', // AI's turn now
    history,
    turnCount: newTurnCount,
    playerTimeRemaining: updatedPlayerTime,
    lastMoveTimestamp: now,
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
  playerMove: PlayerMove
): Promise<{ game: Game; aiLogs: string[] }> {
  const game = await gameStorage.getGame(gameId);
  if (!game) {
    throw new Error("gameRoom.errors.gameNotFound");
  }

  if (game.winner || game.turn !== 'ai') {
    return { game, aiLogs: [] };
  }

  // Get game engine for this game type
  const engine = GameEngineFactory.getEngine(game.gameType);

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

  const newTurnCount = game.turnCount || 0;

  // AI Turn - measure actual calculation time and ensure smooth UX
  const board = engine.parseBoard(game.board);
  const boardComplexity = board.flat().filter(p => p !== null).length;
  const minAnalysisTime = 800 + Math.min(700, boardComplexity * 50) + Math.random() * 200;
  
  // Record actual calculation start time
  const calculationStartTime = Date.now();
  
  // Use game difficulty (default to NEXUS-7 for backward compatibility)
  const gameDifficulty = (game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || "NEXUS-7";
  
  // Calculate AI move using engine
  let aiResult;
  
  try {
    const boardHistory = game.boardHistory || [];
    aiResult = engine.calculateAIMove(
      game.board,
      playerMove,
      gameDifficulty,
      newTurnCount,
      boardHistory
    );
  } catch (error) {
    console.error("AI calculation error:", error);
    aiResult = { move: null, logs: ["gameRoom.log.calculationErrorKo"] };
  }
  
  // Calculate actual time spent on calculation
  const actualCalculationTime = Date.now() - calculationStartTime;
  const calculationTimeSeconds = Math.floor(actualCalculationTime / 1000);
  
  // Ensure minimum analysis time for UX
  const remainingMinTime = Math.max(0, minAnalysisTime - actualCalculationTime);
  if (remainingMinTime > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingMinTime));
  }
  
  // Recalculate AI time after actual calculation
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
    // Check for threefold repetition before applying AI move
    const boardHistory = game.boardHistory || [];
    if (engine.wouldCauseRepetition(game.board, aiResult.move, boardHistory)) {
      console.warn("AI move would cause threefold repetition, skipping");
    }
    
    // Apply AI move using engine
    const newBoardFen = engine.makeMove(game.board, aiResult.move);
    const moveStr = `AI: ${aiResult.move.from.r},${aiResult.move.from.c} -> ${aiResult.move.to.r},${aiResult.move.to.c}`;
    const aiHistory = [...game.history, moveStr];
    const now = new Date();
    
    // Update board history for repetition detection
    const updatedBoardHistory = [...boardHistory, newBoardFen];
    const trimmedBoardHistory = updatedBoardHistory.slice(-20);
    
    // Update AI time (add time bonus for making a move)
    const updatedAiTime = aiTimeAfterThinking + (game.timePerMove ?? 5);
    
    // Check winner using engine
    const aiWinner = engine.checkWinner(
      newBoardFen, 
      newTurnCount, 
      game.playerTimeRemaining ?? 180, 
      updatedAiTime
    );
    
    // Store the single psychological insight message
    aiLogs = aiResult.logs;
    aiLog = aiResult.logs[0] || "gameRoom.log.moveExecuted";
    
    const updated = await gameStorage.updateGame(gameId, {
      board: newBoardFen,
      boardHistory: trimmedBoardHistory,
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
