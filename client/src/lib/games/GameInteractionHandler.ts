/**
 * Game Interaction Handler
 * 
 * Abstracts game-specific interaction logic (click handling, move selection, etc.)
 * Each game can provide its own interaction handler implementation.
 */

import type { GameType } from "@shared/schema";
import type { Game } from "@shared/schema";
import type { InteractionPattern, TurnSystemType } from "./GameUIConfig";
import { GameEngineFactory } from "./GameEngineFactory";
import { getValidMovesClient } from "@/lib/gameLogic";

/**
 * Interaction state for select-then-move pattern
 */
export interface SelectThenMoveState {
  selectedSquare: { r: number; c: number } | null;
  validMoves: { r: number; c: number }[];
}

/**
 * Interaction handler interface
 */
export interface GameInteractionHandler {
  /**
   * Handle square/cell click
   * @param r - Row index
   * @param c - Column index
   * @param game - Current game state
   * @param gameId - Game ID
   * @param makeMove - Function to execute move
   * @param setHasError - Function to set error state
   * @param t - Translation function
   * @returns Promise that resolves when interaction is handled
   */
  handleClick: (
    r: number,
    c: number,
    game: Game,
    gameId: number | null,
    makeMove: (move: { from: { r: number; c: number }; to: { r: number; c: number } }) => Promise<any>,
    setHasError: (hasError: boolean) => void,
    t: (key: string) => string
  ) => Promise<void>;

  /**
   * Get interaction state (for select-then-move pattern)
   */
  getInteractionState?: () => SelectThenMoveState | null;

  /**
   * Update interaction state (for select-then-move pattern)
   */
  updateInteractionState?: (state: SelectThenMoveState | null) => void;

  /**
   * Reset interaction state
   */
  resetState?: () => void;
}

/**
 * Select-then-move interaction handler (for chess-like games)
 */
class SelectThenMoveHandler implements GameInteractionHandler {
  private state: SelectThenMoveState = {
    selectedSquare: null,
    validMoves: [],
  };

  private setState: ((state: SelectThenMoveState) => void) | null = null;
  private gameType: GameType;
  private game: Game | null = null;
  private turnSystemType: 'player-ai' | 'none' | 'custom';

  constructor(
    gameType: GameType,
    setState: (state: SelectThenMoveState) => void,
    turnSystemType: 'player-ai' | 'none' | 'custom' = 'player-ai'
  ) {
    this.gameType = gameType;
    this.setState = setState;
    this.turnSystemType = turnSystemType;
  }

  updateGame(game: Game) {
    this.game = game;
    this.updateValidMoves();
  }

  private updateValidMoves() {
    if (!this.game || !this.state.selectedSquare) {
      this.state.validMoves = [];
      return;
    }

    // Check turn system: if it's player-ai system and it's not player's turn, clear moves
    if (this.turnSystemType === 'player-ai' && this.game.turn !== 'player') {
      this.state.validMoves = [];
      return;
    }

    try {
      this.state.validMoves = getValidMovesClient(
        this.game.board,
        this.state.selectedSquare,
        true,
        this.gameType
      );
    } catch (error) {
      console.error("Error calculating valid moves:", error);
      this.state.validMoves = [];
    }

    if (this.setState) {
      this.setState({ ...this.state });
    }
  }

  getInteractionState(): SelectThenMoveState | null {
    return this.state;
  }

  updateInteractionState(state: SelectThenMoveState | null): void {
    if (state) {
      this.state = state;
      this.updateValidMoves();
    } else {
      this.state = { selectedSquare: null, validMoves: [] };
    }
    if (this.setState) {
      this.setState(this.state);
    }
  }

  resetState(): void {
    this.state = { selectedSquare: null, validMoves: [] };
    if (this.setState) {
      this.setState(this.state);
    }
  }

  async handleClick(
    r: number,
    c: number,
    game: Game,
    gameId: number | null,
    makeMove: (move: { from: { r: number; c: number }; to: { r: number; c: number } }) => Promise<any>,
    setHasError: (hasError: boolean) => void,
    t: (key: string) => string
  ): Promise<void> {
    if (!gameId || !game) {
      console.error("Cannot make move: invalid game ID or game not loaded");
      return;
    }

    // Check turn system: if it's player-ai system and it's AI's turn, prevent clicks
    const isAITurn = this.turnSystemType === 'player-ai' && game.turn === 'ai';
    if (isAITurn || game.winner) {
      return;
    }

    const engine = GameEngineFactory.getEngine(this.gameType);
    const isMyPiece = engine.isPlayerPiece(game.board, { r, c }, true);

    // Select own piece
    if (isMyPiece) {
      this.state.selectedSquare = { r, c };
      this.updateValidMoves();
      return;
    }

    // If piece selected, try move
    if (this.state.selectedSquare) {
      // Check if clicking the same square (deselect)
      if (this.state.selectedSquare.r === r && this.state.selectedSquare.c === c) {
        this.resetState();
        return;
      }

      try {
        if (!gameId) {
          throw new Error(t("gameRoom.errors.invalidGameId"));
        }

        await makeMove({
          from: this.state.selectedSquare,
          to: { r, c }
        });
        
        this.resetState();
        
        console.log("Move successful:", {
          from: this.state.selectedSquare,
          to: { r, c },
        });
      } catch (err: any) {
        console.error("Move failed:", err);
        setHasError(true);
        this.resetState();
        setTimeout(() => {
          setHasError(false);
        }, 500);
      }
    }
  }
}

/**
 * Direct-move interaction handler (for games with immediate move execution)
 */
class DirectMoveHandler implements GameInteractionHandler {
  private gameType: GameType;
  private turnSystemType: 'player-ai' | 'none' | 'custom';

  constructor(
    gameType: GameType,
    turnSystemType: 'player-ai' | 'none' | 'custom' = 'player-ai'
  ) {
    this.gameType = gameType;
    this.turnSystemType = turnSystemType;
  }

  async handleClick(
    r: number,
    c: number,
    game: Game,
    gameId: number | null,
    makeMove: (move: { from: { r: number; c: number }; to: { r: number; c: number } }) => Promise<any>,
    setHasError: (hasError: boolean) => void,
    t: (key: string) => string
  ): Promise<void> {
    // Direct-move pattern: Click directly on piece to move it
    // This is a placeholder - actual implementation depends on game rules
    console.warn(`Direct-move pattern not yet fully implemented for game type ${this.gameType}`);
    // For now, this would need game-specific logic to determine the move
  }
}

/**
 * Factory for creating game interaction handlers
 */
export class GameInteractionHandlerFactory {
  /**
   * Create an interaction handler for a game type
   * @param gameType - Type of game
   * @param interactionPattern - Interaction pattern to use
   * @param setState - State setter for select-then-move pattern (optional)
   * @param turnSystemType - Turn system type (optional, defaults to 'player-ai')
   * @returns Interaction handler instance
   */
  static createHandler(
    gameType: GameType,
    interactionPattern: InteractionPattern,
    setState?: (state: SelectThenMoveState) => void,
    turnSystemType: TurnSystemType = 'player-ai'
  ): GameInteractionHandler {
    switch (interactionPattern) {
      case 'select-then-move':
        if (!setState) {
          throw new Error("setState is required for select-then-move pattern");
        }
        return new SelectThenMoveHandler(gameType, setState, turnSystemType);
      case 'direct-move':
        return new DirectMoveHandler(gameType, turnSystemType);
      case 'drag-drop':
        // Drag-drop is typically handled by the board component itself
        // Return a no-op handler for now
        return {
          handleClick: async () => {
            console.warn(`Drag-drop pattern should be handled by board component for game type ${gameType}`);
          },
        };
      default:
        throw new Error(`Unknown interaction pattern: ${interactionPattern}`);
    }
  }
}
