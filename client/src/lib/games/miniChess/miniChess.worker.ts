/**
 * Web Worker for Mini Chess AI Calculation
 * 
 * Runs the Mini Chess AI (Minimax) in a background thread to prevent UI freezing.
 */

import { runMiniChessSearch } from "./evaluation";
import { parseFen } from "./boardUtils";
import type { PlayerMove, GameMove } from "@shared/gameEngineInterface";
import type { Piece } from "./types";

export interface MiniChessWorkerRequest {
  type: 'CALCULATE_MOVE';
  boardState: string;
  playerLastMove: PlayerMove | null;
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  turnCount?: number;
  boardHistory?: string[];
}

export interface MiniChessWorkerResponse {
  type: 'MOVE_RESULT';
  move: GameMove | null;
  logs: string[];
  error?: string;
}

self.addEventListener('message', (event: MessageEvent<MiniChessWorkerRequest>) => {
  const { type, boardState, playerLastMove, difficulty, turnCount, boardHistory } = event.data;

  if (type === 'CALCULATE_MOVE') {
    try {
      const board = parseFen(boardState);
      
      // PlayerLastMove reconstruction for AI analysis
      // Note: We need to ensure types match what runMiniChessSearch expects
      const playerMoveForAI = playerLastMove ? {
        from: playerLastMove.from,
        to: playerLastMove.to,
        piece: playerLastMove.piece as Piece,
        captured: playerLastMove.captured as Piece | undefined,
        moveTimeSeconds: playerLastMove.moveTimeSeconds,
        hoverCount: playerLastMove.hoverCount
      } : null;

      const result = runMiniChessSearch(
        board,
        playerMoveForAI,
        difficulty,
        turnCount,
        boardHistory
      );

      const response: MiniChessWorkerResponse = {
        type: 'MOVE_RESULT',
        move: result.move ? {
            from: result.move.from,
            to: result.move.to
        } : null,
        logs: result.logs
      };

      self.postMessage(response);
    } catch (error) {
      const response: MiniChessWorkerResponse = {
        type: 'MOVE_RESULT',
        move: null,
        logs: ["gameRoom.log.calculationErrorKo"],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      self.postMessage(response);
    }
  }
});
