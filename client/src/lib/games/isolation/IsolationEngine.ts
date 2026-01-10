/**
 * ISOLATION Game Engine
 * 
 * Implementation of IGameEngine interface for ISOLATION game.
 * This engine handles all ISOLATION-specific game logic.
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
import type { BoardState, MoveWithDestroy } from "./types";
import {
  parseBoardState,
  generateBoardString,
  getInitialBoard,
  isValidPosition,
  isDestroyed,
  isOccupied,
  floodFill,
  getEmptyCells,
} from "./boardUtils";
import { isValidMove, getValidMoves, getValidDestroyPositions } from "./moveValidation";
import { getAIMove } from "./evaluation";

export class IsolationEngine implements IGameEngine {
  getGameType(): GameType {
    return "GAME_2";
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
      const valid = isValidMove(board, move.from, move.to, isPlayer);
      
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
    
    // Validate that move.from matches either playerPos or aiPos
    const isPlayerMove = board.playerPos.r === move.from.r && board.playerPos.c === move.from.c;
    const isAIMove = board.aiPos.r === move.from.r && board.aiPos.c === move.from.c;
    
    if (!isPlayerMove && !isAIMove) {
      // Invalid move: from position doesn't match any piece
      // This should never happen if isValidMove was called first, but we handle it defensively
      console.error("Invalid move: from position doesn't match any piece", {
        from: move.from,
        playerPos: board.playerPos,
        aiPos: board.aiPos,
      });
      // Return original board state to prevent corruption
      return boardState;
    }
    
    // Apply the move
    if (isPlayerMove) {
      // Player move
      board.playerPos = move.to;
    } else {
      // AI move
      board.aiPos = move.to;
    }
    
    // Handle destroy action - REQUIRED in Isolation game
    if (move.destroy) {
      const destroyPos = move.destroy as { r: number; c: number };
      // Validate destroy position
      if (
        isValidPosition(destroyPos, board.boardSize) &&
        !isDestroyed(destroyPos, board.destroyed) &&
        !isOccupied(destroyPos, board.playerPos, board.aiPos)
      ) {
        board.destroyed.push(destroyPos);
        console.log(`makeMove: Destroyed tile at (${destroyPos.r}, ${destroyPos.c})`);
      } else {
        console.error("makeMove: Invalid destroy position", {
          destroyPos,
          isValid: isValidPosition(destroyPos, board.boardSize),
          isDestroyed: isDestroyed(destroyPos, board.destroyed),
          isOccupied: isOccupied(destroyPos, board.playerPos, board.aiPos),
          playerPos: board.playerPos,
          aiPos: board.aiPos,
        });
        // In Isolation, destroy is required - if invalid, try to find a valid one
        const destroyCandidates = getValidDestroyPositions(
          { ...board, playerPos: isPlayerMove ? board.playerPos : { ...board.playerPos }, aiPos: isAIMove ? board.aiPos : { ...board.aiPos } },
          move.to,
          isPlayerMove
        );
        if (destroyCandidates.length > 0) {
          const fallbackDestroy = destroyCandidates[0];
          board.destroyed.push(fallbackDestroy);
          console.log(`makeMove: Using fallback destroy at (${fallbackDestroy.r}, ${fallbackDestroy.c})`);
        } else {
          console.error("makeMove: No valid destroy candidates available - this should not happen");
        }
      }
    } else {
      // Destroy is required in Isolation game
      console.warn("makeMove: No destroy specified in move - this should not happen in Isolation");
      const destroyCandidates = getValidDestroyPositions(
        { ...board, playerPos: isPlayerMove ? board.playerPos : { ...board.playerPos }, aiPos: isAIMove ? board.aiPos : { ...board.aiPos } },
        move.to,
        isPlayerMove
      );
      if (destroyCandidates.length > 0) {
        const fallbackDestroy = destroyCandidates[0];
        board.destroyed.push(fallbackDestroy);
        console.log(`makeMove: Auto-selected destroy at (${fallbackDestroy.r}, ${fallbackDestroy.c})`);
      }
    }
    
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
      
      // For ISOLATION: Check if the player whose turn it is NEXT can move
      // turnCount is incremented BEFORE checkWinner is called
      // Initial state: turnCount = 0 (even) -> Player's turn first
      // After player move: turnCount = 1 (odd) -> AI's turn next -> Check if AI can move
      // After AI move: turnCount = 2 (even) -> Player's turn next -> Check if player can move
      
      // Special case: turnCount = 0 means initial state, no one has moved yet
      // In this case, we shouldn't declare a winner
      if (turnCount === 0) {
        return null;
      }
      
      const isAITurnNext = turnCount % 2 === 1;
      
      if (isAITurnNext) {
        // Player just moved, now it's AI's turn
        // Check if AI can move
        const aiMoves = getValidMoves(board, board.aiPos, false);
        console.log(`checkWinner: After player move (turnCount=${turnCount}), AI has ${aiMoves.length} moves`);
        if (aiMoves.length === 0) {
          // AI has no moves, player wins
          console.log("checkWinner: AI has no moves, player wins");
          return "player";
        }
      } else {
        // AI just moved, now it's player's turn
        // Check if player can move
        const playerMoves = getValidMoves(board, board.playerPos, true);
        console.log(`checkWinner: After AI move (turnCount=${turnCount}), player has ${playerMoves.length} moves`);
        if (playerMoves.length === 0) {
          // Player has no moves, AI wins
          console.log("checkWinner: Player has no moves, AI wins");
          return "ai";
        }
      }
      
      // If the player whose turn it is can move, game continues
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
          const validMoves = getValidMoves(board, board.aiPos, false);
          if (validMoves.length > 0) {
            return {
              move: {
                from: board.aiPos,
                to: validMoves[0],
              },
              logs: result.logs || ["gameRoom.log.moveExecuted"],
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
        const validMoves = getValidMoves(board, board.aiPos, false);
        if (validMoves.length > 0) {
          return {
            move: {
              from: board.aiPos,
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
        logs: ["gameRoom.log.calculationErrorKo"],
      };
    }
  }

  wouldCauseRepetition(
    boardState: string,
    move: GameMove,
    boardHistory: string[]
  ): boolean {
    // For ISOLATION, repetition is less critical, but we can check for exact board state repetition
    const board = parseBoardState(boardState);
    
    // Apply the move temporarily
    const tempBoard = { ...board };
    if (tempBoard.playerPos.r === move.from.r && tempBoard.playerPos.c === move.from.c) {
      tempBoard.playerPos = move.to;
    } else if (tempBoard.aiPos.r === move.from.r && tempBoard.aiPos.c === move.from.c) {
      tempBoard.aiPos = move.to;
    }
    
    if (move.destroy) {
      const destroyPos = move.destroy as { r: number; c: number };
      if (
        isValidPosition(destroyPos, tempBoard.boardSize) &&
        !isDestroyed(destroyPos, tempBoard.destroyed) &&
        !isOccupied(destroyPos, tempBoard.playerPos, tempBoard.aiPos)
      ) {
        tempBoard.destroyed.push(destroyPos);
      }
    }
    
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
    const board = parseBoardState(boardState);
    return getValidMoves(board, position, isPlayer);
  }

  parseBoard(boardState: string): any {
    // For UI compatibility, convert board state to a 2D array format
    const board = parseBoardState(boardState);
    const { boardSize, playerPos, aiPos, destroyed } = board;
    
    // Create a 2D array where:
    // - 'P' = Player piece
    // - 'A' = AI piece
    // - 'X' = Destroyed cell
    // - null = Empty cell
    const result: (string | null)[][] = [];
    
    for (let r = 0; r < boardSize.rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < boardSize.cols; c++) {
        const pos = { r, c };
        
        if (isDestroyed(pos, destroyed)) {
          row.push('X');
        } else if (pos.r === playerPos.r && pos.c === playerPos.c) {
          row.push('P');
        } else if (pos.r === aiPos.r && pos.c === aiPos.c) {
          row.push('A');
        } else {
          row.push(null);
        }
      }
      result.push(row);
    }
    
    return result;
  }

  generateBoardString(board: any): string {
    // Convert from 2D array format back to BoardState
    // This is used when we need to convert from UI format
    const rows = board.length;
    const cols = board[0]?.length || 0;
    
    const boardState: BoardState = {
      boardSize: { rows, cols },
      playerPos: { r: -1, c: -1 },
      aiPos: { r: -1, c: -1 },
      destroyed: [],
    };
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell === 'P') {
          boardState.playerPos = { r, c };
        } else if (cell === 'A') {
          boardState.aiPos = { r, c };
        } else if (cell === 'X') {
          boardState.destroyed.push({ r, c });
        }
      }
    }
    
    // If positions weren't found, use defaults
    if (boardState.playerPos.r === -1) {
      boardState.playerPos = { r: 0, c: 0 };
    }
    if (boardState.aiPos.r === -1) {
      boardState.aiPos = { r: rows - 1, c: cols - 1 };
    }
    
    return generateBoardString(boardState);
  }

  isPlayerPiece(
    boardState: string,
    position: { r: number; c: number },
    isPlayer: boolean
  ): boolean {
    const board = parseBoardState(boardState);
    const expectedPos = isPlayer ? board.playerPos : board.aiPos;
    return position.r === expectedPos.r && position.c === expectedPos.c;
  }

  parseHistory(historyEntry: any): GameMove | null {
    // History format: "from_r,from_c:to_r,to_c:destroy_r,destroy_c" or JSON
    try {
      if (typeof historyEntry === 'string') {
        const parts = historyEntry.split(':');
        if (parts.length >= 2) {
          const [fromStr, toStr, destroyStr] = parts;
          const [fromR, fromC] = fromStr.split(',').map(Number);
          const [toR, toC] = toStr.split(',').map(Number);
          
          const move: GameMove = {
            from: { r: fromR, c: fromC },
            to: { r: toR, c: toC },
          };
          
          if (destroyStr) {
            const [destroyR, destroyC] = destroyStr.split(',').map(Number);
            move.destroy = { r: destroyR, c: destroyC };
          }
          
          return move;
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
    // Format: "from_r,from_c:to_r,to_c:destroy_r,destroy_c"
    let result = `${move.from.r},${move.from.c}:${move.to.r},${move.to.c}`;
    
    if (move.destroy) {
      const destroy = move.destroy as { r: number; c: number };
      result += `:${destroy.r},${destroy.c}`;
    }
    
    return result;
  }
}
