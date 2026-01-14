import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGame, useMakeMove, useCreateGame } from "@/hooks/use-game";
import { Scanlines } from "@/components/Scanlines";
import { GameUIFactory } from "@/lib/games/GameUIFactory";
import { GlitchButton } from "@/components/GlitchButton";
import { TerminalText } from "@/components/TerminalText";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { gameStorage, handleVictoryUnlock, getUnlockedDifficulties } from "@/lib/storage";
import type { GameType } from "@shared/schema";
import { parseGameTypeFromUrl, validateGameType, getCurrentSearchParams, buildGameRoomUrl } from "@/lib/routing";
import { getGameUIConfig, getDifficultyColorConfig } from "@/lib/games/GameUIConfig";
import { WinnerOverlay } from "@/components/WinnerOverlay";
import { PlayerStatusCard } from "@/components/PlayerStatusCard";
import { AIStatusCard } from "@/components/AIStatusCard";
import { TurnBanner } from "@/components/TurnBanner";
import { TerminalLog } from "@/components/TerminalLog";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { GameErrorState } from "@/components/GameErrorState";
import { GameLoadingState } from "@/components/GameLoadingState";
import { useGameTimer } from "@/hooks/use-game-timer";
import { useGameLogs } from "@/hooks/use-game-logs";
import { usePreventNavigation } from "@/hooks/use-prevent-navigation";
import { GameInteractionHandlerFactory, type SelectThenMoveState } from "@/lib/games/GameInteractionHandler";
import { GameEngineFactory } from "@/lib/games/GameEngineFactory";
import { DEFAULT_GAME_TYPE, DEFAULT_DIFFICULTY } from "@shared/gameConfig";
import { terminateMCTSWorkerPool } from "@/lib/games/entropy/mctsWorkerPool";

export default function GameRoom() {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [gameId, setGameId] = useState<number | null>(() => gameStorage.getCurrentGameId());
  const { data: game, isLoading, error } = useGame(gameId);
  // Only create makeMove hook if gameId is valid
  const makeMove = useMakeMove(gameId ?? 0);
  const createGame = useCreateGame();

  // Get game type from URL parameters
  const urlGameType = useMemo(() => {
    const searchParams = getCurrentSearchParams();
    return parseGameTypeFromUrl(searchParams);
  }, [location]);

  // Validate and sync game type between URL and game data
  const validatedGameType = useMemo<GameType>(() => {
    // Priority: URL > Game data > Default
    if (urlGameType) {
      return urlGameType;
    }
    if (game?.gameType) {
      return validateGameType(game.gameType as GameType);
    }
    return DEFAULT_GAME_TYPE;
  }, [urlGameType, game?.gameType]);

  // Get game-specific UI configuration
  const uiConfig = useMemo(() => getGameUIConfig(validatedGameType), [validatedGameType]);

  // Interaction handler state (for select-then-move pattern)
  const [interactionState, setInteractionState] = useState<SelectThenMoveState | null>(null);
  
  // Player move tracking: time and hover events
  const playerTurnStartTimeRef = useRef<number | null>(null);
  const hoverCountRef = useRef<number>(0);
  
  // Track when player's turn starts
  useEffect(() => {
    // Determine if it's player's turn
    const isPlayerTurnNow = uiConfig.turnSystemType === 'none' || game?.turn === 'player';
    if (isPlayerTurnNow && !game?.winner) {
      playerTurnStartTimeRef.current = Date.now();
      hoverCountRef.current = 0; // Reset hover count for new turn
    }
  }, [game?.turn, game?.winner, uiConfig.turnSystemType]);
  
  // Create interaction handler
  const interactionHandler = useMemo(() => {
    return GameInteractionHandlerFactory.createHandler(
      validatedGameType,
      uiConfig.interactionPattern,
      setInteractionState,
      uiConfig.turnSystemType,
      (hoverCount: number) => {
        hoverCountRef.current = hoverCount;
      }
    );
  }, [validatedGameType, uiConfig.interactionPattern, uiConfig.turnSystemType]);

  // Update interaction handler when game changes (for select-then-move and direct-move patterns)
  useEffect(() => {
    if (game && interactionHandler.updateGame) {
      interactionHandler.updateGame(game);
    }
  }, [game, interactionHandler]);

  const [hasError, setHasError] = useState(false);
  const prevGameIdRef = useRef<number | null>(null);
  
  // Use game logs hook
  const { logHistory, setLogHistory } = useGameLogs({ game, gameType: validatedGameType });
  const isNavigatingAwayRef = useRef(false);
  const hasUnlockedRef = useRef(false); // Track if we've already unlocked for this game

  // Reset unlock tracking when game changes
  useEffect(() => {
    if (gameId !== prevGameIdRef.current) {
      hasUnlockedRef.current = false;
      setJustUnlockedDifficulty(null);
      prevGameIdRef.current = gameId;
    }
  }, [gameId]);

  // Sync URL with game type when game loads and handle mismatches
  useEffect(() => {
    if (!game || isLoading) return;
    
    const gameTypeFromData = game.gameType || DEFAULT_GAME_TYPE;
    const gameTypeFromUrl = urlGameType;
    
    // If URL has game type but it doesn't match game data, update URL
    if (gameTypeFromUrl && gameTypeFromUrl !== gameTypeFromData) {
      console.warn(
        `Game type mismatch: URL has ${gameTypeFromUrl} but game data has ${gameTypeFromData}. Updating URL.`
      );
      const correctUrl = buildGameRoomUrl(gameTypeFromData as GameType);
      window.history.replaceState(null, "", correctUrl);
    }
    // If URL doesn't have game type but game data does, update URL
    else if (!gameTypeFromUrl && gameTypeFromData) {
      const correctUrl = buildGameRoomUrl(gameTypeFromData as GameType);
      window.history.replaceState(null, "", correctUrl);
    }
  }, [game?.gameType, urlGameType, isLoading]);

  // Redirect if no game found in storage
  useEffect(() => {
    if (!gameId && !isLoading) {
      isNavigatingAwayRef.current = true; // 자동 리다이렉트는 확인 창 표시하지 않음
      setLocation("/");
    }
  }, [gameId, isLoading, setLocation]);


  // Track if a difficulty was just unlocked in this victory
  const [justUnlockedDifficulty, setJustUnlockedDifficulty] = useState<"NEXUS-5" | "NEXUS-7" | null>(null);

  // Cleanup MCTS Worker Pool when component unmounts (GAME_3 only)
  useEffect(() => {
    return () => {
      // Only terminate Worker Pool for ENTROPY game (GAME_3)
      if (validatedGameType === 'GAME_3') {
        console.log('[GameRoom] Terminating MCTS Worker Pool for ENTROPY');
        terminateMCTSWorkerPool();
      }
    };
  }, [validatedGameType]);

  // Handle victory unlock when player wins
  useEffect(() => {
    // Only process if player won, difficulty exists, and we haven't unlocked yet for this game
    if (game?.winner === 'player' && game?.difficulty && !hasUnlockedRef.current && validatedGameType) {
      const difficulty = game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
      
      // Check what will be unlocked before unlocking
      const nextDifficulty = difficulty === "NEXUS-3" ? "NEXUS-5" : difficulty === "NEXUS-5" ? "NEXUS-7" : null;
      
      // Unlock next difficulty for this specific game type
      if (nextDifficulty) {
        // Unlock the difficulty (localStorage is synchronous, so this is immediate)
        handleVictoryUnlock(difficulty, validatedGameType);
        hasUnlockedRef.current = true;
        
        // Mark that we just unlocked this difficulty
        setJustUnlockedDifficulty(nextDifficulty);
        
        // Verify unlock was successful and log message
        // getUnlockedDifficulties reads from localStorage which is already updated
        const unlocked = getUnlockedDifficulties(validatedGameType);
        if (difficulty === "NEXUS-3" && unlocked.has("NEXUS-5")) {
          setLogHistory(prev => [...prev, { 
            message: t("gameRoom.log.nexusUnlocked", { level: "5", message: t("gameRoom.log.nexus5Unlocked") }), 
            timestamp: new Date() 
          }]);
        } else if (difficulty === "NEXUS-5" && unlocked.has("NEXUS-7")) {
          setLogHistory(prev => [...prev, { 
            message: t("gameRoom.log.nexusUnlocked", { level: "7", message: t("gameRoom.log.nexus7Unlocked") }), 
            timestamp: new Date() 
          }]);
        }
      }
    }
    
    // Reset justUnlockedDifficulty when game changes or winner changes to non-player
    if (game?.winner !== 'player' || !game?.difficulty) {
      setJustUnlockedDifficulty(null);
    }
  }, [game?.winner, game?.difficulty, validatedGameType, t]);


  // Determine if it's player's turn based on turn system type
  const isPlayerTurn = useMemo(() => {
    if (uiConfig.turnSystemType === 'none') {
      // No turn system: player can always act
      return true;
    }
    // Default: player-ai turn system
    return game?.turn === 'player';
  }, [game?.turn, uiConfig.turnSystemType]);

  const hasWinner = !!game?.winner;
  const { playerTimeRemaining, aiTimeRemaining, formatTime } = useGameTimer({
    game,
    uiConfig,
    isPlayerTurn,
    hasWinner,
  });

  // Get difficulty-based color classes from game-specific config (must be before aiCardProps)
  const difficulty = useMemo(() => {
    if (!game) return DEFAULT_DIFFICULTY;
    return (game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || DEFAULT_DIFFICULTY;
  }, [game?.difficulty]);
  
  const difficultyColors = useMemo(() => {
    return getDifficultyColorConfig(validatedGameType, difficulty);
  }, [validatedGameType, difficulty]);

  // Conditionally compute Player/AI card props only if cards are shown
  // Early return optimization: skip computation if cards are not shown
  const playerCardProps = useMemo(() => {
    if (!uiConfig.showPlayerCard) return null;
    // Only compute props if card is shown
    return {
      isPlayerTurn,
      timeRemaining: playerTimeRemaining,
      enableTimer: uiConfig.enableTimer,
      enableTurnSystem: uiConfig.enableTurnSystem,
      formatTime,
    };
  }, [
    uiConfig.showPlayerCard,
    isPlayerTurn,
    playerTimeRemaining,
    uiConfig.enableTimer,
    uiConfig.enableTurnSystem,
    formatTime,
  ]);

  const aiCardProps = useMemo(() => {
    if (!uiConfig.showAICard) return null;
    // Only compute props if card is shown
    return {
      difficulty,
      isAITurn: !isPlayerTurn,
      isProcessing: makeMove.isPending,
      timeRemaining: aiTimeRemaining,
      enableTimer: uiConfig.enableTimer,
      enableTurnSystem: uiConfig.enableTurnSystem,
      difficultyColors,
      formatTime,
    };
  }, [
    uiConfig.showAICard,
    difficulty,
    isPlayerTurn,
    makeMove.isPending,
    aiTimeRemaining,
    uiConfig.enableTimer,
    uiConfig.enableTurnSystem,
    difficultyColors,
    formatTime,
  ]);

  // Use prevent navigation hook
  const { 
    handleNavigateAway, 
    isConfirmOpen, 
    confirmNavigation, 
    cancelNavigation 
  } = usePreventNavigation({
    game,
    gameType: validatedGameType,
    isNavigatingAwayRef,
    t,
  });

  // Get interaction state for select-then-move and direct-move patterns
  const selectedSquare = useMemo(() => {
    if (uiConfig.interactionPattern === 'select-then-move' && interactionState) {
      return interactionState.selectedSquare;
    }
    if (uiConfig.interactionPattern === 'direct-move' && interactionHandler.getInteractionState) {
      const state = interactionHandler.getInteractionState();
      return state?.selectedSquare || null;
    }
    return null;
  }, [interactionState, uiConfig.interactionPattern, interactionHandler]);

  const validMoves = useMemo(() => {
    if (uiConfig.interactionPattern === 'select-then-move' && interactionState) {
      return interactionState.validMoves;
    }
    // Support direct-move pattern (used by GAME_2/Isolation)
    if (uiConfig.interactionPattern === 'direct-move' && interactionHandler.getInteractionState) {
      const state = interactionHandler.getInteractionState();
      return state?.validMoves || [];
    }
    return [];
  }, [interactionState, uiConfig.interactionPattern, interactionHandler]);

  // Get destroy candidates for games that require destroy selection (e.g., GAME_2/Isolation)
  const destroyCandidates = useMemo(() => {
    // Only get destroy candidates if the interaction handler supports it
    if (interactionHandler.getDestroyCandidates) {
      return interactionHandler.getDestroyCandidates();
    }
    return [];
  }, [interactionHandler, interactionState, game?.board, game?.turn]);

  // Parse last move using game engine (MUST be before any early returns to comply with React hooks rules)
  const lastMove = useMemo(() => {
    if (!game || !game.history || game.history.length === 0) {
      return null;
    }
    try {
      const engine = GameEngineFactory.getEngine(validatedGameType);
      const parsed = engine.parseHistory(game.history[game.history.length - 1]);
      return parsed;
    } catch (error) {
      console.error("Failed to parse history entry:", error);
      return null;
    }
  }, [game?.history, validatedGameType]);

  // Determine error state and message
  const isInvalidGameId = gameId === null;
  const isGameNotFound = gameId !== null && !isLoading && !error && !game;
  const hasErrorState = error || isGameNotFound || (isInvalidGameId && !isLoading);

  if (isLoading) {
    return <GameLoadingState />;
  }

  if (hasErrorState) {
    let errorTitle = t("gameRoom.criticalFailure");
    let errorMessage = t("gameRoom.connectionLost");

    if (isInvalidGameId) {
      errorTitle = t("gameRoom.noActiveGame");
      errorMessage = t("gameRoom.noActiveGameMessage");
    } else if (isGameNotFound) {
      errorTitle = t("gameRoom.gameNotFound");
      errorMessage = t("gameRoom.gameNotFoundMessage", { id: gameId });
    } else if (error) {
      errorTitle = t("gameRoom.systemError");
      errorMessage = t("gameRoom.systemErrorMessage");
    }

    return (
      <GameErrorState
        errorTitle={errorTitle}
        errorMessage={errorMessage}
        onAbort={() => setLocation("/")}
      />
    );
  }

  const handleSquareClick = async (r: number, c: number) => {
    if (!game) return;
    
    // Prevent clicks during processing or when game is over
    // Check turn system: if it's player-ai system and it's AI's turn, prevent clicks
    const isAITurn = uiConfig.turnSystemType === 'player-ai' && game.turn === 'ai';
    if (makeMove.isPending || isAITurn || game.winner) {
      return;
    }

    // Use interaction handler to handle the click
    await interactionHandler.handleClick(
      r,
      c,
      game,
      gameId,
      async (move) => {
        // Calculate move time and get hover count
        // moveTimeSeconds: 플레이어가 수를 두기까지 걸린 시간 (초 단위)
        // undefined인 경우: 시간 추적이 시작되지 않았거나 리셋된 경우
        const moveTimeSeconds = playerTurnStartTimeRef.current 
          ? (Date.now() - playerTurnStartTimeRef.current) / 1000 
          : undefined;
        
        // hoverCount: 플레이어가 수를 두기 전에 hover한 횟수 (망설임 지표)
        // 0인 경우 undefined로 전달하여 불필요한 데이터 전송 방지
        const hoverCount = interactionHandler.getHoverCount?.() ?? 0;
        
        // Add metadata to move with explicit type handling
        const moveWithMetadata = {
          ...move,
          moveTimeSeconds: moveTimeSeconds !== undefined && moveTimeSeconds > 0 
            ? moveTimeSeconds 
            : undefined,
          hoverCount: hoverCount > 0 ? hoverCount : undefined
        };
        
        // Reset tracking after move (다음 턴을 위해)
        playerTurnStartTimeRef.current = null;
        hoverCountRef.current = 0;
        
        return await makeMove.mutateAsync(moveWithMetadata);
      },
      setHasError,
      t
    );
  };

  const handleSquareHover = (r: number, c: number) => {
    if (!game || !isPlayerTurn || game.winner) return;
    
    // Track hover events through interaction handler
    if (interactionHandler.handleHover) {
      interactionHandler.handleHover(r, c, game);
    }
  };

  // Early return if game is not loaded (after all hooks have been called)
  if (!game) {
    return null;
  }

  // Determine layout type
  const layoutType = uiConfig.layoutType || 'standard';

  // Render layout based on game configuration
  if (layoutType === 'minimal') {
    // Minimal layout: Only board, no sidebars
    return (
      <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col overflow-hidden font-mono relative">
        <Scanlines />

        {/* CENTER: BOARD ONLY */}
        <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 lg:p-8 relative z-0 overflow-hidden min-h-0">
          {/* Turn Indicator Banner - Show if enabled or game has ended */}
          {(uiConfig.showTurnBanner || game.winner) && (
            <TurnBanner
              winner={game.winner as "player" | "ai" | "draw" | null}
              turn={game.turn as 'player' | 'ai'}
              isProcessing={makeMove.isPending}
              enableTurnSystem={uiConfig.enableTurnSystem}
              difficultyColors={difficultyColors}
            />
          )}

          <div className="relative w-full h-full flex items-center justify-center">
            {(() => {
              const gameType = validatedGameType;
              try {
                const BoardComponent = GameUIFactory.getBoardComponent(gameType);
                // Only pass turn prop if turn system is enabled
                const turnProp = uiConfig.turnSystemType === 'player-ai' 
                  ? (game.turn as 'player' | 'ai')
                  : undefined;
                return (
                <BoardComponent
                  boardString={game.board}
                  turn={turnProp}
                  selectedSquare={selectedSquare}
                  validMoves={validMoves}
                  destroyCandidates={destroyCandidates}
                  onSquareClick={handleSquareClick}
                  onSquareHover={handleSquareHover}
                  lastMove={lastMove}
                  isProcessing={makeMove.isPending}
                  difficulty={(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || DEFAULT_DIFFICULTY}
                  hasError={hasError}
                />
                );
              } catch (error) {
                console.error(`Failed to load board component for game type ${gameType}:`, error);
                return (
                  <div className="text-center text-muted-foreground">
                    <p>{t("gameRoom.uiNotImplemented", { gameType })}</p>
                  </div>
                );
              }
            })()}
          </div>

          {/* Winner Overlay - Show if enabled and game has ended */}
          {game.winner && uiConfig.showWinnerOverlay && (
            <WinnerOverlay
              winner={game.winner as "player" | "ai" | "draw"}
              difficulty={(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || DEFAULT_DIFFICULTY}
              gameType={validatedGameType}
              difficultyColors={difficultyColors}
              justUnlockedDifficulty={justUnlockedDifficulty}
              onReturnToLobby={() => {
                isNavigatingAwayRef.current = true;
                window.dispatchEvent(new Event('storage'));
                setLocation("/");
              }}
              onPlayAgain={async (targetDifficulty) => {
                const newGame = await createGame.mutateAsync({
                  gameType: validatedGameType,
                  difficulty: targetDifficulty,
                });
                setGameId(newGame.id);
              }}
              onResetGameState={() => {
                if (interactionHandler.resetState) {
                  interactionHandler.resetState();
                }
                setLogHistory([]);
                setHasError(false);
                setJustUnlockedDifficulty(null);
              }}
            />
          )}
        </main>

        {/* Mobile Surrender Button - Positioned at bottom on small screens */}
        {!game.winner && (
          <div className="lg:hidden w-full px-4 py-3 border-t border-border bg-black/40 backdrop-blur-sm shrink-0 z-10 flex justify-center">
            <div className="w-full max-w-[280px]">
              <GlitchButton 
                variant="outline"
                className={cn(
                  "w-full text-[10px] py-2",
                  difficultyColors.borderOpacity,
                  difficultyColors.textOpacity,
                  difficultyColors.bgHover
                )}
                onClick={() => handleNavigateAway("/")}
              >
                {t("gameRoom.surrender")}
              </GlitchButton>
            </div>
          </div>
        )}
        
        <ConfirmationDialog
          isOpen={isConfirmOpen}
          title={t("gameRoom.confirmLeave")}
          description={t("gameRoom.confirmLeaveSubtext")}
          confirmText={t("gameRoom.surrender")}
          cancelText={t("gameRoom.continueGame")}
          onConfirm={confirmNavigation}
          onCancel={cancelNavigation}
          difficultyColors={difficultyColors}
        />
      </div>
    );
  }

  // Standard layout: 3-panel layout (left sidebar, center board, right terminal)
  return (
    <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col lg:flex-row overflow-hidden font-mono relative">
      <Scanlines />

      {/* LEFT PANEL: STATUS & INFO - Only render if needed */}
      {(uiConfig.showPlayerCard || uiConfig.showAICard) && (
        <aside className="w-full lg:w-1/4 p-2 sm:p-3 md:p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-border bg-black/40 backdrop-blur-sm flex flex-col items-center lg:items-stretch z-10 shrink-0 min-w-0 overflow-hidden">
          {/* Responsive layout - horizontal on mobile/tablet, vertical on desktop */}
          <div className="flex flex-col items-center lg:items-start gap-2 sm:gap-2.5 md:gap-3 lg:gap-0 flex-1 lg:flex-1 min-w-0 w-full">
            {/* Title - Hidden on mobile/tablet, shown only on desktop (lg+) */}
            <div className="mb-0 lg:mb-8 hidden lg:block shrink-0">
              <h1
                onClick={() => handleNavigateAway("/")}
                className="text-2xl font-display font-black tracking-tighter cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
              >
                MOVE 37
              </h1>
            </div>

            {/* Cards Container - Horizontal on mobile/tablet for space efficiency, vertical on desktop */}
            <div className="flex flex-row lg:flex-col gap-2 sm:gap-2.5 md:gap-3 lg:gap-6 flex-1 lg:flex-none min-w-0 w-full">
              {/* Player Card */}
              {playerCardProps && (
                <PlayerStatusCard {...playerCardProps} />
              )}

              {/* AI Card */}
              {aiCardProps && (
                <AIStatusCard {...aiCardProps} />
              )}
            </div>
          </div>

          {/* Action Buttons - Fixed at bottom of left panel */}
          {/* Desktop Button */}
          <div className="hidden lg:block space-y-2 shrink-0 mt-auto">
            <GlitchButton 
              variant="outline" 
              className={cn(
                "w-full text-sm py-4",
                difficultyColors.borderOpacity,
                difficultyColors.textOpacity,
                difficultyColors.bgHover
              )}
              onClick={() => handleNavigateAway("/")}
            >
              {t("gameRoom.surrender")}
            </GlitchButton>
          </div>
        </aside>
      )}

      {/* CENTER PANEL: BOARD */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 lg:p-8 relative z-0 overflow-hidden min-h-0">
        {/* Turn Indicator Banner - Only render if enabled */}
        {(uiConfig.showTurnBanner || game.winner) && (
          <TurnBanner
            winner={game.winner as "player" | "ai" | "draw" | null}
            turn={game.turn as 'player' | 'ai'}
            isProcessing={makeMove.isPending}
            enableTurnSystem={uiConfig.enableTurnSystem}
            difficultyColors={difficultyColors}
          />
        )}

        <div className="relative w-full h-full flex items-center justify-center">
          {(() => {
            const gameType = validatedGameType;
            try {
              const BoardComponent = GameUIFactory.getBoardComponent(gameType);
              // Only pass turn prop if turn system is enabled
              const turnProp = uiConfig.turnSystemType === 'player-ai' 
                ? (game.turn as 'player' | 'ai')
                : undefined;
              return (
                <BoardComponent
                  boardString={game.board}
                  turn={turnProp}
                  selectedSquare={selectedSquare}
                  validMoves={validMoves}
                  destroyCandidates={destroyCandidates}
                  onSquareClick={handleSquareClick}
                  lastMove={lastMove}
                  isProcessing={makeMove.isPending}
                  difficulty={(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || DEFAULT_DIFFICULTY}
                  hasError={hasError}
                />
              );
              } catch (error) {
                console.error(`Failed to load board component for game type ${gameType}:`, error);
                return (
                  <div className="text-center text-muted-foreground">
                    <p>{t("gameRoom.uiNotImplemented", { gameType })}</p>
                  </div>
                );
              }
          })()}
        </div>

        {/* Winner Overlay - Show if enabled and game has ended */}
        {game.winner && uiConfig.showWinnerOverlay && (
          <WinnerOverlay
            winner={game.winner as "player" | "ai" | "draw"}
            difficulty={(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || DEFAULT_DIFFICULTY}
            gameType={validatedGameType}
            difficultyColors={difficultyColors}
            onReturnToLobby={() => {
              isNavigatingAwayRef.current = true;
              window.dispatchEvent(new Event('storage'));
              setLocation("/");
            }}
            onPlayAgain={async (targetDifficulty) => {
              const newGame = await createGame.mutateAsync({
                gameType: validatedGameType,
                difficulty: targetDifficulty,
              });
              setGameId(newGame.id);
            }}
            onResetGameState={() => {
              if (interactionHandler.resetState) {
                interactionHandler.resetState();
              }
              setLogHistory([]);
              setHasError(false);
            }}
          />
        )}
      </main>

      {/* Mobile Surrender Button - Positioned above terminal log on small screens */}
      {!game.winner && (
        <div className="lg:hidden w-full px-4 py-3 border-t border-border bg-black/40 backdrop-blur-sm shrink-0 z-10 flex justify-center">
          <div className="w-full max-w-[280px]">
            <GlitchButton 
              variant="outline"
              className={cn(
                "w-full text-[10px] py-2",
                difficultyColors.borderOpacity,
                difficultyColors.textOpacity,
                difficultyColors.bgHover
              )}
              onClick={() => handleNavigateAway("/")}
            >
              {t("gameRoom.surrender")}
            </GlitchButton>
          </div>
        </div>
      )}

      {/* RIGHT PANEL: TERMINAL LOG - Only render if enabled */}
      {uiConfig.showTerminalLog && (
        <TerminalLog
          logHistory={logHistory}
          difficultyColors={difficultyColors}
        />
      )}

      <ConfirmationDialog
        isOpen={isConfirmOpen}
        title={t("gameRoom.confirmLeave")}
        description={t("gameRoom.confirmLeaveSubtext")}
        confirmText={t("gameRoom.surrender")}
        cancelText={t("gameRoom.continueGame")}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        difficultyColors={difficultyColors}
      />
    </div>
  );
}

