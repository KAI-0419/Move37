/**
 * Mini Chess Game Engine
 * 
 * Implementation of IGameEngine interface for Mini Chess game.
 * This engine handles all Mini Chess-specific game logic.
 */

import type { GameType } from "@shared/schema";
import type { 
  IGameEngine, 
  GameMove, 
  PlayerMove, 
  AIMoveResult, 
  ValidationResult, 
  WinnerResult 
} from "@shared/gameEngineInterface";
import { 
  INITIAL_BOARD_FEN, 
  type Board, 
  type Piece 
} from "./types";
import { parseFen, generateFen, makeMove as makeBoardMove } from "./boardUtils";
import { isValidMove, getValidMoves } from "./moveValidation";
import { checkWinner } from "./winnerCheck";
import { wouldCauseThreefoldRepetition } from "./repetition";
// Import AI logic from local evaluation module
import { getAIMove } from "./evaluation";

export class MiniChessEngine implements IGameEngine {
  getGameType(): GameType {
    return "MINI_CHESS";
  }

  getInitialBoard(): string {
    return INITIAL_BOARD_FEN;
  }

  isValidMove(
    boardState: string,
    move: GameMove,
    isPlayer: boolean
  ): ValidationResult {
    try {
      const board = parseFen(boardState);
      const valid = isValidMove(board, move.from, move.to, isPlayer);
      
      if (!valid) {
        return {
          valid: false,
          error: "gameRoom.errors.illegalMove"
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid move"
      };
    }
  }

  makeMove(boardState: string, move: GameMove): string {
    const board = parseFen(boardState);
    const newBoard = makeBoardMove(board, move.from, move.to);
    return generateFen(newBoard);
  }

  checkWinner(
    boardState: string,
    turnCount: number,
    playerTimeRemaining: number,
    aiTimeRemaining: number
  ): WinnerResult {
    const board = parseFen(boardState);
    return checkWinner(board, turnCount, playerTimeRemaining, aiTimeRemaining);
  }

  calculateAIMove(
    boardState: string,
    playerLastMove: PlayerMove | null,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    turnCount?: number,
    boardHistory?: string[]
  ): AIMoveResult {
    const board = parseFen(boardState);
    
    // Convert PlayerMove to format expected by getAIMove
    const playerMoveForAI = playerLastMove ? {
      from: playerLastMove.from,
      to: playerLastMove.to,
      piece: playerLastMove.piece as Piece,
      captured: playerLastMove.captured as Piece | undefined
    } : null;
    
    // Use local AI logic from evaluation module
    const result = getAIMove(
      board,
      playerMoveForAI,
      difficulty,
      turnCount,
      boardHistory
    );
    
    return {
      move: result.move,
      logs: result.logs
    };
  }

  wouldCauseRepetition(
    boardState: string,
    move: GameMove,
    boardHistory: string[]
  ): boolean {
    const board = parseFen(boardState);
    return wouldCauseThreefoldRepetition(board, move.from, move.to, boardHistory);
  }

  getValidMoves(
    boardState: string,
    position: { r: number; c: number },
    isPlayer: boolean
  ): { r: number; c: number }[] {
    const board = parseFen(boardState);
    return getValidMoves(board, position, isPlayer);
  }

  parseBoard(boardState: string): Board {
    return parseFen(boardState);
  }

  generateBoardString(board: Board): string {
    return generateFen(board);
  }
}
