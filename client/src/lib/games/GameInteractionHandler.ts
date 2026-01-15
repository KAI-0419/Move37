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
import { getValidDestroyPositions } from "./isolation/moveValidation";
import { parseBoardState } from "./isolation/boardUtils";

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
   * Handle square/cell hover (for tracking hesitation)
   * @param r - Row index
   * @param c - Column index
   * @param game - Current game state
   */
  handleHover?: (r: number, c: number, game: Game) => void;

  /**
   * Get hover count (hesitation indicator)
   */
  getHoverCount?: () => number;

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

  /**
   * Update game state (for handlers that need to track game changes)
   */
  updateGame?: (game: Game) => void;

  /**
   * Get destroy candidates (for games that require destroy selection)
   */
  getDestroyCandidates?: () => { r: number; c: number }[];
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
  private onHoverCallback: ((hoverCount: number) => void) | null = null;
  private hoverCount: number = 0;
  private lastHoveredSquare: { r: number; c: number } | null = null;
  private lastHoverTimestamp: number = 0; // 마지막 hover 시간 기록 (debounce용)

  constructor(
    gameType: GameType,
    setState: (state: SelectThenMoveState) => void,
    turnSystemType: 'player-ai' | 'none' | 'custom' = 'player-ai',
    onHoverCallback?: (hoverCount: number) => void
  ) {
    this.gameType = gameType;
    this.setState = setState;
    this.turnSystemType = turnSystemType;
    this.onHoverCallback = onHoverCallback || null;
  }

  updateGame(game: Game) {
    // 게임 상태가 변경되면 항상 최신 상태로 업데이트하고 validMoves 재계산
    const previousBoard = this.game?.board;
    this.game = game;
    
    // 보드 상태가 변경되었거나 선택된 칸이 있으면 validMoves 재계산
    // 이렇게 하면 게임 상태 업데이트 시 항상 최신 validMoves를 사용할 수 있음
    if (this.state.selectedSquare && (previousBoard !== game.board || !this.state.validMoves.length)) {
      this.updateValidMoves();
    }
  }

  private updateValidMoves() {
    if (!this.game || !this.state.selectedSquare) {
      this.state.validMoves = [];
      if (this.setState) {
        this.setState({ ...this.state });
      }
      return;
    }

    // Check turn system: if it's player-ai system and it's not player's turn, clear moves
    if (this.turnSystemType === 'player-ai' && this.game.turn !== 'player') {
      this.state.validMoves = [];
      if (this.setState) {
        this.setState({ ...this.state });
      }
      return;
    }

    try {
      // 항상 최신 게임 보드 상태를 사용하여 validMoves 계산
      // 이렇게 하면 게임 상태가 업데이트되는 동안에도 정확한 validMoves를 얻을 수 있음
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
    this.hoverCount = 0;
    this.lastHoveredSquare = null;
    this.lastHoverTimestamp = 0;
    if (this.setState) {
      this.setState(this.state);
    }
  }

  handleHover(r: number, c: number, game: Game): void {
    // Only track hover on player pieces before selection
    if (this.state.selectedSquare) {
      return; // Already selected a piece
    }

    const engine = GameEngineFactory.getCachedEngine(this.gameType);
    const isMyPiece = engine.isPlayerPiece(game.board, { r, c }, true);
    
    if (isMyPiece) {
      // Track hover on player pieces (hesitation indicator)
      // 같은 칸을 여러 번 hover하는 것도 망설임으로 인식
      const now = Date.now();
      const hoverKey = `${r}-${c}`;
      const lastHoverKey = this.lastHoveredSquare ? `${this.lastHoveredSquare.r}-${this.lastHoveredSquare.c}` : null;
      const isDifferentSquare = hoverKey !== lastHoverKey;
      const HOVER_DEBOUNCE_MS = 200; // 200ms 이내의 연속 hover는 무시 (너무 빠른 반복 제외)
      const timeSinceLastHover = now - this.lastHoverTimestamp;
      
      // 다른 칸을 hover하거나, 같은 칸이지만 충분한 시간이 지난 경우 카운트
      // (같은 칸을 여러 번 hover하는 것도 망설임으로 인식)
      if (isDifferentSquare || timeSinceLastHover >= HOVER_DEBOUNCE_MS) {
        this.hoverCount++;
        this.lastHoveredSquare = { r, c };
        this.lastHoverTimestamp = now;
        
        if (this.onHoverCallback) {
          this.onHoverCallback(this.hoverCount);
        }
      }
    }
  }

  getHoverCount(): number {
    return this.hoverCount;
  }

  async handleClick(
    r: number,
    c: number,
    game: Game,
    gameId: number | null,
    makeMove: (move: { from: { r: number; c: number }; to: { r: number; c: number }; destroy?: { r: number; c: number } }) => Promise<any>,
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

    const engine = GameEngineFactory.getCachedEngine(this.gameType);
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
  private selectedPiece: { r: number; c: number } | null = null;
  private validMoves: { r: number; c: number }[] = [];
  private pendingMove: { from: { r: number; c: number }; to: { r: number; c: number } } | null = null;
  private destroyCandidates: { r: number; c: number }[] = [];
  private game: Game | null = null;
  private setState: ((state: SelectThenMoveState) => void) | null = null;

  constructor(
    gameType: GameType,
    setState?: (state: SelectThenMoveState) => void,
    turnSystemType: 'player-ai' | 'none' | 'custom' = 'player-ai'
  ) {
    this.gameType = gameType;
    this.setState = setState || null;
    this.turnSystemType = turnSystemType;
  }

  updateGame(game: Game) {
    const previousBoard = this.game?.board;
    this.game = game;
    
    // If game board state changed and we have a pending move, reset state
    // (This should not happen in normal flow, but handle defensively)
    if (previousBoard && previousBoard !== game.board && this.pendingMove) {
      console.warn("Game state changed while pending move exists, resetting state");
      this.resetState();
      return;
    }
    
    // For ENTROPY (Hex), update valid moves (all empty cells)
    if (this.gameType === "GAME_3") {
      try {
        const engine = GameEngineFactory.getCachedEngine(this.gameType);
        this.validMoves = engine.getValidMoves(
          game.board,
          { r: -1, c: -1 }, // Position doesn't matter for Hex
          true
        );
        this.notifyStateChange();
      } catch (error) {
        console.error("Error updating valid moves for ENTROPY:", error);
        this.validMoves = [];
        this.notifyStateChange();
      }
      return;
    }
    
    // If we have a selected piece, update valid moves
    if (this.selectedPiece) {
      this.updateValidMoves();
    }
    
    // If we have a pending move, recalculate destroy candidates with new board state
    if (this.pendingMove && this.gameType === "GAME_2") {
      try {
        const boardState = parseBoardState(game.board);
        this.destroyCandidates = getValidDestroyPositions(
          boardState,
          this.pendingMove.to,
          true
        );
      } catch (error) {
        console.error("Error recalculating destroy candidates:", error);
        this.destroyCandidates = [];
      }
    }
  }

  private updateValidMoves() {
    // Clear pending move and destroy candidates when updating valid moves (new piece selection)
    this.pendingMove = null;
    this.destroyCandidates = [];

    if (!this.game || !this.selectedPiece) {
      this.validMoves = [];
      this.notifyStateChange();
      return;
    }

    // Check turn system: if it's player-ai system and it's not player's turn, clear moves
    if (this.turnSystemType === 'player-ai' && this.game.turn !== 'player') {
      this.validMoves = [];
      this.notifyStateChange();
      return;
    }

    try {
      const engine = GameEngineFactory.getCachedEngine(this.gameType);
      this.validMoves = engine.getValidMoves(
        this.game.board,
        this.selectedPiece,
        true
      );
    } catch (error) {
      console.error("Error calculating valid moves:", error);
      this.validMoves = [];
    }
    
    this.notifyStateChange();
  }

  private notifyStateChange() {
    if (this.setState) {
      this.setState({
        selectedSquare: this.selectedPiece,
        validMoves: this.validMoves,
      });
    }
  }

  resetState(): void {
    this.selectedPiece = null;
    this.validMoves = [];
    this.pendingMove = null;
    this.destroyCandidates = [];
    this.notifyStateChange();
  }

  async handleClick(
    r: number,
    c: number,
    game: Game,
    gameId: number | null,
    makeMove: (move: { from: { r: number; c: number }; to: { r: number; c: number }; destroy?: { r: number; c: number } }) => Promise<any>,
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

    const engine = GameEngineFactory.getCachedEngine(this.gameType);
    const isMyPiece = engine.isPlayerPiece(game.board, { r, c }, true);

    // If we're waiting for destroy selection
    if (this.pendingMove) {
      // Check if clicked position is a valid destroy candidate
      const isValidDestroy = this.destroyCandidates.some(
        (pos) => pos.r === r && pos.c === c
      );

      if (isValidDestroy) {
        try {
          await makeMove({
            ...this.pendingMove,
            destroy: { r, c },
          });
          this.resetState();
        } catch (err: any) {
          console.error("Move failed:", err);
          setHasError(true);
          this.resetState();
          setTimeout(() => {
            setHasError(false);
          }, 500);
        }
      } else {
        // Clicked outside destroy candidates - show error signal like game 1
        setHasError(true);
        this.resetState();
        setTimeout(() => {
          setHasError(false);
        }, 500);
      }
      return;
    }

    // For ENTROPY (Hex) game, handle empty cell clicks directly
    if (this.gameType === "GAME_3") {
      const engine = GameEngineFactory.getCachedEngine(this.gameType);
      const isValidMove = engine.isValidMove(game.board, {
        from: { r: -1, c: -1 }, // Hex doesn't use from position
        to: { r, c },
      }, true);

      if (isValidMove.valid) {
        try {
          // Hex game: directly place piece on empty cell
          await makeMove({
            from: { r: -1, c: -1 }, // Hex doesn't use from position
            to: { r, c },
          });
          this.resetState();
        } catch (err: any) {
          console.error("Move failed:", err);
          setHasError(true);
          this.resetState();
          setTimeout(() => {
            setHasError(false);
          }, 500);
        }
      } else {
        // Invalid move - show error
        setHasError(true);
        setTimeout(() => {
          setHasError(false);
        }, 500);
      }
      return;
    }

    // If we have a selected piece and clicked a valid move target
    if (this.selectedPiece) {
      const isValidTarget = this.validMoves.some(
        (m) => m.r === r && m.c === c
      );

      if (isValidTarget) {
        // Store the move and get destroy candidates
        this.pendingMove = {
          from: this.selectedPiece,
          to: { r, c },
        };

        // For ISOLATION game, get valid destroy positions
        if (this.gameType === "GAME_2") {
          try {
            const boardState = parseBoardState(game.board);
            // Pass isPlayer=true since this is a player move
            this.destroyCandidates = getValidDestroyPositions(boardState, { r, c }, true);
            
            console.log(`Destroy candidates for move to (${r}, ${c}):`, this.destroyCandidates);
            
            // Isolation game requires destroy after every move
            // If no destroy candidates available (shouldn't happen in normal gameplay), show error
            if (this.destroyCandidates.length === 0) {
              console.warn("No destroy candidates available - this should not happen in Isolation game");
              setHasError(true);
              this.resetState();
              setTimeout(() => {
                setHasError(false);
              }, 1000);
              return;
            }
            
            // Clear valid moves as we are now in destroy selection phase
            this.validMoves = [];
            // Notify that validMoves are now cleared
            this.notifyStateChange();
          } catch (error) {
            console.error("Error getting destroy candidates:", error);
            setHasError(true);
            this.resetState();
            setTimeout(() => {
              setHasError(false);
            }, 1000);
            return;
          }
        } else {
          // For other games, make move immediately
          try {
            await makeMove({
              from: this.selectedPiece,
              to: { r, c },
            });
            this.resetState();
          } catch (err: any) {
            console.error("Move failed:", err);
            setHasError(true);
            this.resetState();
            setTimeout(() => {
              setHasError(false);
            }, 500);
          }
        }
        return;
      } else {
        // Clicked outside valid moves - show error signal like game 1
        setHasError(true);
        setTimeout(() => {
          setHasError(false);
        }, 500);
        
        // Deselect or select new piece
        if (isMyPiece) {
          this.selectedPiece = { r, c };
          this.updateValidMoves();
        } else {
          this.resetState();
        }
        return;
      }
    }

    // Select own piece
    if (isMyPiece) {
      this.selectedPiece = { r, c };
      this.updateValidMoves();
    }
  }

  getInteractionState(): SelectThenMoveState | null {
    // For direct-move, we still use SelectThenMoveState for compatibility
    // For ENTROPY (Hex), return all valid moves (empty cells)
    if (this.gameType === "GAME_3" && this.game) {
      try {
        const engine = GameEngineFactory.getCachedEngine(this.gameType);
        const validMoves = engine.getValidMoves(
          this.game.board,
          { r: -1, c: -1 }, // Position doesn't matter for Hex
          true
        );
        return {
          selectedSquare: null,
          validMoves: validMoves,
        };
      } catch (error) {
        console.error("Error getting valid moves for ENTROPY:", error);
      }
    }
    return {
      selectedSquare: this.selectedPiece,
      validMoves: this.validMoves,
    };
  }

  getDestroyCandidates(): { r: number; c: number }[] {
    // Only return destroy candidates if we have a pending move
    // (destroy candidates are only valid during the destroy selection phase)
    if (this.pendingMove) {
      return this.destroyCandidates;
    }
    return [];
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
    turnSystemType: TurnSystemType = 'player-ai',
    onHoverCallback?: (hoverCount: number) => void
  ): GameInteractionHandler {
    switch (interactionPattern) {
      case 'select-then-move':
        if (!setState) {
          throw new Error("setState is required for select-then-move pattern");
        }
        return new SelectThenMoveHandler(gameType, setState, turnSystemType, onHoverCallback);
      case 'direct-move':
        return new DirectMoveHandler(gameType, setState, turnSystemType);
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
