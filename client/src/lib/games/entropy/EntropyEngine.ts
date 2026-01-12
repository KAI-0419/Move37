/**
 * ENTROPY (Hex) Game Engine
 * 
 * Implementation of IGameEngine interface for ENTROPY (Hex) game.
 * This engine handles all ENTROPY-specific game logic.
 */

import type { GameType } from "@shared/schema";
import type {
  IGameEngine,
  GameMove,
  PlayerMove,
  AIMoveResult,
  ValidationResult,
  WinnerResult,
} from "@shared/gameEngineInterface";
import type { BoardState, Move, Player } from "./types";
import {
  parseBoardState,
  generateBoardString,
  getInitialBoard,
  setCellState,
  cloneBoard,
} from "./boardUtils";
import { isValidMove, getValidMoves } from "./moveValidation";
import { isConnected } from "./connectionCheck";
import { getAIMove } from "./evaluation";

export class EntropyEngine implements IGameEngine {
  getGameType(): GameType {
    return "GAME_3";
  }

  getInitialBoard(): string {
    const board = getInitialBoard();
    return generateBoardString(board);
  }

  isValidMove(
    boardState: string,
    move: GameMove,
    isPlayer: boolean
  ): ValidationResult {
    try {
      const board = parseBoardState(boardState);
      const player: Player = isPlayer ? 'PLAYER' : 'AI';
      
      // In Hex, move only has 'to' position (no 'from')
      const hexMove: Move = { r: move.to.r, c: move.to.c };
      const valid = isValidMove(board, hexMove, player);
      
      if (!valid) {
        return {
          valid: false,
          error: "gameRoom.errors.illegalMove",
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "gameRoom.errors.invalidBoardState",
      };
    }
  }

  makeMove(boardState: string, move: GameMove): string {
    const board = parseBoardState(boardState);
    
    // Determine which player made the move based on turn count
    // Even turn count = PLAYER, odd = AI
    const isPlayerMove = board.turnCount % 2 === 0;
    const player: Player = isPlayerMove ? 'PLAYER' : 'AI';
    
    // Apply the move
    const hexMove: Move = { r: move.to.r, c: move.to.c };
    setCellState(board, hexMove, player);
    
    // Increment turn count
    board.turnCount++;
    
    return generateBoardString(board);
  }

  checkWinner(
    boardState: string,
    turnCount: number,
    playerTimeRemaining: number,
    aiTimeRemaining: number
  ): WinnerResult {
    try {
      const board = parseBoardState(boardState);
      
      // Check for time out conditions
      if (playerTimeRemaining <= 0) {
        console.log("checkWinner: Player time expired");
        return "ai";
      }
      if (aiTimeRemaining <= 0) {
        console.log("checkWinner: AI time expired");
        return "player";
      }
      
      // Check for connections
      if (isConnected(board, 'PLAYER')) {
        console.log("checkWinner: Player connected left to right");
        return "player";
      }
      
      if (isConnected(board, 'AI')) {
        console.log("checkWinner: AI connected top to bottom");
        return "ai";
      }
      
      // Hex game mathematical principle: No draws are possible
      // If board is full, one player MUST have a connection
      // This is a fundamental theorem of Hex game theory
      const emptyCells = getValidMoves(board);
      if (emptyCells.length === 0) {
        // Board is full - recheck connections with absolute certainty
        // In Hex, when board is full, exactly one player has a winning connection
        console.log("checkWinner: Board is full - determining winner by connection");
        
        // Double-check connections (shouldn't be necessary, but ensures correctness)
        const playerConnected = isConnected(board, 'PLAYER');
        const aiConnected = isConnected(board, 'AI');
        
        if (playerConnected && !aiConnected) {
          return "player";
        } else if (aiConnected && !playerConnected) {
          return "ai";
        } else if (playerConnected && aiConnected) {
          // This is mathematically impossible in Hex, but handle edge case
          // The player who made the last move wins (Hex rule)
          // Since turnCount is even for player moves, odd for AI moves
          // If board is full and both connected (impossible), check turn count
          console.warn("checkWinner: Both players connected (mathematically impossible in Hex)");
          return turnCount % 2 === 0 ? "ai" : "player"; // Last move was by opposite player
        } else {
          // Neither connected when board is full - also impossible in Hex
          // But handle gracefully: player with more pieces (shouldn't happen)
          console.error("checkWinner: Board full but no connections (mathematically impossible)");
          // Count pieces as last resort
          let playerCount = 0;
          let aiCount = 0;
          const { rows, cols } = board.boardSize;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (board.cells[r][c] === 'PLAYER') {
                playerCount++;
              } else if (board.cells[r][c] === 'AI') {
                aiCount++;
              }
            }
          }
          return playerCount > aiCount ? "player" : "ai";
        }
      }
      
      // Game continues
      return null;
    } catch (error) {
      console.error("Error checking winner:", error, {
        boardState,
        turnCount,
        playerTimeRemaining,
        aiTimeRemaining,
      });
      return null;
    }
  }

  calculateAIMove(
    boardState: string,
    playerLastMove: PlayerMove | null,
    difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7",
    turnCount?: number,
    boardHistory?: string[]
  ): AIMoveResult {
    try {
      const board = parseBoardState(boardState);
      const result = getAIMove(board, playerLastMove, difficulty, turnCount, boardHistory);
      
      // Validate that result has a valid move structure
      if (result && result.move) {
        // Additional validation: check if move is actually valid
        const isValid = this.isValidMove(boardState, result.move, false);
        if (!isValid.valid) {
          console.warn("AI returned invalid move, recalculating...", result.move);
          // Try to get any valid move as fallback
          const validMoves = getValidMoves(board);
          if (validMoves.length > 0) {
            return {
              move: {
                from: { r: -1, c: -1 },
                to: validMoves[0],
              },
              logs: ["gameRoom.log.entropy.error.recalculation"],
            };
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error("Error in calculateAIMove:", error);
      // Fallback: try to get any valid move
      try {
        const board = parseBoardState(boardState);
        const validMoves = getValidMoves(board);
        if (validMoves.length > 0) {
          return {
            move: {
              from: { r: -1, c: -1 },
              to: validMoves[0],
            },
            logs: ["gameRoom.log.moveExecuted"],
          };
        }
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
      }
      
      return {
        move: null,
        logs: ["gameRoom.log.entropy.error.criticalFailure"],
      };
    }
  }

  wouldCauseRepetition(
    boardState: string,
    move: GameMove,
    boardHistory: string[]
  ): boolean {
    // For Hex, repetition is less critical, but we can check for exact board state repetition
    const board = parseBoardState(boardState);
    
    // Apply the move temporarily
    const tempBoard = cloneBoard(board);
    const isPlayerMove = board.turnCount % 2 === 0;
    const player: Player = isPlayerMove ? 'PLAYER' : 'AI';
    const hexMove: Move = { r: move.to.r, c: move.to.c };
    setCellState(tempBoard, hexMove, player);
    tempBoard.turnCount++;
    
    const newBoardString = generateBoardString(tempBoard);
    
    // Check if this board state has appeared 3 times
    const count = boardHistory.filter(h => h === newBoardString).length;
    return count >= 2; // Already appeared twice, this would be the third
  }

  getValidMoves(
    boardState: string,
    position: { r: number; c: number },
    isPlayer: boolean
  ): { r: number; c: number }[] {
    // In Hex, valid moves are all empty cells (position parameter is ignored)
    const board = parseBoardState(boardState);
    return getValidMoves(board);
  }

  parseBoard(boardState: string): any {
    // For UI compatibility, convert board state to a 2D array format
    const board = parseBoardState(boardState);
    return board.cells;
  }

  generateBoardString(board: any): string {
    // If board is already a BoardState, use it directly
    if (board.boardSize && board.cells) {
      return generateBoardString(board);
    }
    
    // If board is a 2D array, convert to BoardState
    const rows = board.length;
    const cols = board[0]?.length || 0;
    
    const boardState: BoardState = {
      boardSize: { rows, cols },
      cells: board,
      turnCount: 0,
    };
    
    return generateBoardString(boardState);
  }

  isPlayerPiece(
    boardState: string,
    position: { r: number; c: number },
    isPlayer: boolean
  ): boolean {
    const board = parseBoardState(boardState);
    const cellState = board.cells[position.r]?.[position.c];
    const expectedState: Player = isPlayer ? 'PLAYER' : 'AI';
    return cellState === expectedState;
  }

  parseHistory(historyEntry: any): GameMove | null {
    // History format: "r,c" or JSON
    try {
      if (typeof historyEntry === 'string') {
        const parts = historyEntry.split(',');
        if (parts.length === 2) {
          const [r, c] = parts.map(Number);
          return {
            from: { r: -1, c: -1 },
            to: { r, c },
          };
        }
      } else if (typeof historyEntry === 'object') {
        return historyEntry as GameMove;
      }
    } catch (error) {
      console.error("Failed to parse history entry:", error);
    }
    
    return null;
  }

  formatHistoryEntry(move: GameMove, isPlayer: boolean): string {
    // Format: "r,c"
    return `${move.to.r},${move.to.c}`;
  }
}
