import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useGame, useMakeMove, useCreateGame } from "@/hooks/use-game";
import { ChessBoard } from "@/components/ChessBoard";
import { Scanlines } from "@/components/Scanlines";
import { GlitchButton } from "@/components/GlitchButton";
import { TerminalText } from "@/components/TerminalText";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, Trophy, Radio, Terminal as TerminalIcon, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseBoardString, getValidMovesClient } from "@/lib/gameLogic";
import { parseFen } from "@shared/gameLogic";
import { gameStorage } from "@/lib/storage";

export default function GameRoom() {
  const [location, setLocation] = useLocation();
  const [gameId, setGameId] = useState<number | null>(() => gameStorage.getCurrentGameId());
  const { data: game, isLoading, error } = useGame(gameId);
  // Only create makeMove hook if gameId is valid
  const makeMove = useMakeMove(gameId ?? 0);
  const createGame = useCreateGame();

  const [selectedSquare, setSelectedSquare] = useState<{r: number, c: number} | null>(null);
  const [logHistory, setLogHistory] = useState<Array<{ message: string; timestamp: Date }>>([]);
  const [hasError, setHasError] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const prevGameIdRef = useRef<number | null>(null);
  const isNavigatingAwayRef = useRef(false);

  // Redirect if no game found in storage
  useEffect(() => {
    if (!gameId && !isLoading) {
      isNavigatingAwayRef.current = true; // 자동 리다이렉트는 확인 창 표시하지 않음
      setLocation("/");
    }
  }, [gameId, isLoading, setLocation]);

  // Initialize logs when game loads
  useEffect(() => {
    if (game && logHistory.length === 0) {
      const initialTime = new Date();
      setLogHistory([
        { message: "// Monitoring neural activity...", timestamp: initialTime },
        { message: "// Connection established.", timestamp: initialTime },
        { message: "// Access level: UNRESTRICTED", timestamp: initialTime }
      ]);
    }
  }, [game, logHistory.length]);

  // Update logs when game updates
  useEffect(() => {
    if (game?.aiLog) {
      // Check if this is a new AI log (not already in history)
      setLogHistory(prev => {
        // Only add if it's a new psychological insight (not system messages)
        const isNewInsight = game.aiLog && 
          game.aiLog !== "Analyzing..." && 
          game.aiLog !== "System Initialized. Awaiting input..." &&
          !prev.some(log => log.message === game.aiLog);
        
        if (isNewInsight) {
          return [...prev, { message: game.aiLog!, timestamp: new Date() }];
        }
        return prev;
      });
    }
  }, [game?.aiLog]);

  // Auto scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logHistory]);

  // 페이지 이탈 방지: 게임이 진행 중일 때만 확인 창 표시
  useEffect(() => {
    // 게임이 진행 중인지 확인 (게임이 로드되었고, 게임이 종료되지 않았을 때)
    const isGameInProgress = game && !game.winner;

    if (!isGameInProgress) {
      return; // 게임이 종료되었거나 로드되지 않았으면 이벤트 리스너 추가하지 않음
    }

    // 브라우저 탭/창 닫기 또는 새로고침 시 확인 창 표시
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 최신 브라우저에서는 메시지가 표시되지 않지만, 이벤트를 발생시켜야 확인 창이 표시됨
      e.returnValue = '';
    };

    // 브라우저 뒤로가기 버튼 처리
    const handlePopState = (e: PopStateEvent) => {
      // 게임이 진행 중이고, 사용자가 명시적으로 이동을 허용하지 않았을 때만 확인
      if (isGameInProgress && !isNavigatingAwayRef.current) {
        // popstate는 이미 발생한 후이므로, 즉시 확인 창을 표시하고 취소하면 현재 페이지로 다시 이동
        const confirmed = window.confirm(
          "게임이 진행 중입니다. 정말 로비로 돌아가시겠습니까?\n\n진행 중인 게임은 저장되지 않습니다."
        );
        
        if (!confirmed) {
          // 사용자가 취소하면 현재 페이지로 다시 이동 (뒤로가기 취소)
          window.history.pushState(null, '', '/game');
          // wouter가 경로 변경을 감지하도록 강제로 이벤트 발생
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          // 사용자가 확인하면 이동 허용
          isNavigatingAwayRef.current = true;
        }
      }
    };

    // 현재 상태를 히스토리에 추가하여 popstate 이벤트를 감지할 수 있도록 함
    // 이미 pushState가 되어 있으면 다시 추가하지 않음
    if (window.location.pathname === '/game') {
      window.history.pushState(null, '', '/game');
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [game]);

  // 경로 변경 감지: /game에서 다른 경로로 변경되려고 할 때 확인 창 표시
  // 이는 브라우저 뒤로가기 버튼이나 다른 라우팅 변경을 감지하기 위함
  const prevLocationRef = useRef(location);
  useEffect(() => {
    // 게임이 진행 중이고, 경로가 /game에서 다른 경로로 변경된 경우
    const isGameInProgress = game && !game.winner;
    const wasOnGamePage = prevLocationRef.current === '/game';
    const isLeavingGamePage = location !== '/game';
    
    if (isGameInProgress && wasOnGamePage && isLeavingGamePage && !isNavigatingAwayRef.current) {
      // 경로가 이미 변경된 경우, 확인 창을 표시하고 취소하면 다시 /game으로 이동
      const confirmed = window.confirm(
        "게임이 진행 중입니다. 정말 로비로 돌아가시겠습니까?\n\n진행 중인 게임은 저장되지 않습니다."
      );
      
      if (!confirmed) {
        // 사용자가 취소하면 다시 /game으로 이동
        isNavigatingAwayRef.current = true; // 무한 루프 방지
        setLocation('/game');
        // 다음 렌더링 사이클에서 다시 false로 설정
        setTimeout(() => {
          isNavigatingAwayRef.current = false;
        }, 0);
      } else {
        // 사용자가 확인하면 이동 허용
        isNavigatingAwayRef.current = true;
      }
    }
    
    // 현재 경로를 이전 경로로 저장
    prevLocationRef.current = location;
  }, [location, game, setLocation]);

  // 라우팅 변경 시 확인 창 표시를 위한 핸들러
  const handleNavigateAway = (targetPath: string) => {
    // 게임이 진행 중인지 확인
    const isGameInProgress = game && !game.winner;

    if (isGameInProgress && !isNavigatingAwayRef.current) {
      const confirmed = window.confirm(
        "게임이 진행 중입니다. 정말 로비로 돌아가시겠습니까?\n\n진행 중인 게임은 저장되지 않습니다."
      );
      
      if (!confirmed) {
        return; // 사용자가 취소하면 이동하지 않음
      }
    }

    // 확인했거나 게임이 종료되었으면 이동
    isNavigatingAwayRef.current = true;
    setLocation(targetPath);
  };

  // Calculate valid moves for selected piece
  // MUST be before early returns to maintain consistent hook order
  const validMoves = useMemo(() => {
    // Early return if game data is not available
    if (!game || !game.board) return [];
    
    // Early return if no square is selected
    if (!selectedSquare) return [];
    
    // Early return if it's not player's turn
    if (game.turn !== 'player') return [];
    
    // Calculate valid moves
    try {
      const board = parseBoardString(game.board);
      return getValidMovesClient(board, selectedSquare, true);
    } catch (error) {
      console.error("Error calculating valid moves:", error);
      return [];
    }
  }, [selectedSquare, game?.board, game?.turn]);

  // Determine error state and message
  const isInvalidGameId = gameId === null;
  const isGameNotFound = gameId !== null && !isLoading && !error && !game;
  const hasErrorState = error || isGameNotFound || (isInvalidGameId && !isLoading);

  if (isLoading) return (
    <div className="h-screen w-full bg-background flex items-center justify-center text-primary font-mono">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <TerminalText text="CONNECTING TO NEURAL LINK..." />
      </div>
      <Scanlines />
    </div>
  );

  if (hasErrorState) {
    let errorTitle = "CRITICAL SYSTEM FAILURE";
    let errorMessage = "Connection Lost.";
    
    if (isInvalidGameId) {
      errorTitle = "NO ACTIVE GAME";
      errorMessage = "No active game session found.";
    } else if (isGameNotFound) {
      errorTitle = "GAME NOT FOUND";
      errorMessage = `Game data for ID #${gameId} is missing or corrupted.`;
    } else if (error) {
      errorTitle = "SYSTEM ERROR";
      errorMessage = "An unexpected error occurred.";
    }

    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-destructive font-mono gap-4">
        <AlertTriangle className="w-12 h-12" />
        <h2 className="text-xl">{errorTitle}</h2>
        <p>{errorMessage}</p>
        <GlitchButton onClick={() => setLocation("/")} variant="outline">
          ABORT
        </GlitchButton>
        <Scanlines />
      </div>
    );
  }

  const handleSquareClick = async (r: number, c: number) => {
    // Safety check: ensure gameId is valid and game exists
    if (!gameId || !game) {
      console.error("Cannot make move: invalid game ID or game not loaded");
      return;
    }

    // Prevent clicks during processing or when game is over
    if (makeMove.isPending || game.turn === 'ai' || game.winner) {
      return;
    }

    // Parse FEN to get piece at coord
    const board = parseFen(game.board);
    const clickedPiece = board[r][c];
    // Player uses lowercase pieces (n, p, k), AI uses uppercase (N, P, K)
    const isMyPiece = clickedPiece !== null && clickedPiece === clickedPiece.toLowerCase() && clickedPiece !== clickedPiece.toUpperCase();

    // Select own piece
    if (isMyPiece) {
      setSelectedSquare({ r, c });
      return;
    }

    // If piece selected, try move
    if (selectedSquare) {
      // Check if clicking the same square (deselect)
      if (selectedSquare.r === r && selectedSquare.c === c) {
        setSelectedSquare(null);
        return;
      }

      try {
        // Double-check gameId is valid before making move
        if (!gameId) {
          throw new Error("Invalid game ID");
        }

        const result = await makeMove.mutateAsync({
          from: selectedSquare,
          to: { r, c }
        });
        setSelectedSquare(null);
        
        // Player move is now immediately visible
        // AI calculation will happen in background and update the game state
        
        // Log for debugging
        console.log("Move successful:", {
          from: selectedSquare,
          to: { r, c },
          updatedGame: result.game
        });
      } catch (err: any) {
        console.error("Move failed:", err);
        // Trigger error animation on board
        setHasError(true);
        setSelectedSquare(null);
        // Reset error state after animation completes
        setTimeout(() => {
          setHasError(false);
        }, 500);
      }
    }
  };

  const isPlayerTurn = game.turn === 'player';
  const lastMove = (game.history && game.history.length > 0) 
    ? parseHistoryString(game.history[game.history.length - 1]) 
    : null;

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col lg:flex-row overflow-hidden font-mono relative">
      <Scanlines />

      {/* LEFT PANEL: STATUS & INFO - Mobile: Top Row, Desktop: Left Column */}
      <aside className="w-full lg:w-1/4 p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-border bg-black/40 backdrop-blur-sm flex flex-row lg:flex-col justify-between items-center lg:items-stretch z-10 shrink-0">
        <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-0">
          <div className="mb-0 lg:mb-8">
            <h1 onClick={() => handleNavigateAway("/")} className="text-xl lg:text-2xl font-display font-black tracking-tighter cursor-pointer hover:text-primary transition-colors">
              MOVE 37
            </h1>
            <div className="hidden lg:flex text-xs text-muted-foreground mt-1 items-center gap-2">
              <Radio className="w-3 h-3 text-accent animate-pulse" />
              CONNECTED: {game.id}
            </div>
          </div>

          <div className="flex lg:flex-col gap-3 lg:gap-6">
            {/* Player Card */}
            <div className={cn(
              "px-3 py-2 lg:p-4 border transition-all duration-300 min-w-[120px] lg:min-w-0",
              isPlayerTurn ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,243,255,0.1)]" : "border-white/10 opacity-50"
            )}>
              <h3 className="text-[10px] lg:text-sm font-bold mb-0 lg:mb-1 uppercase tracking-tighter lg:tracking-normal">PLAYER (YOU)</h3>
              <div className="flex items-center gap-2 text-[8px] lg:text-xs">
                <div className={cn("w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full", isPlayerTurn ? "bg-primary animate-pulse" : "bg-gray-600")} />
                <span className="hidden sm:inline">{isPlayerTurn ? "AWAITING INPUT" : "STANDBY"}</span>
              </div>
            </div>

            {/* AI Card */}
            <div className={cn(
              "px-3 py-2 lg:p-4 border transition-all duration-300 min-w-[120px] lg:min-w-0",
              !isPlayerTurn || makeMove.isPending ? "border-destructive bg-destructive/5 shadow-[0_0_15px_rgba(255,0,60,0.1)]" : "border-white/10 opacity-50"
            )}>
              <h3 className="text-[10px] lg:text-sm font-bold mb-0 lg:mb-1 text-destructive uppercase tracking-tighter lg:tracking-normal">
                {(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || "NEXUS-7"} (AI)
              </h3>
              <div className="flex items-center gap-2 text-[8px] lg:text-xs text-destructive">
                <div className={cn("w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full", (!isPlayerTurn || makeMove.isPending) ? "bg-destructive animate-pulse" : "bg-gray-600")} />
                <span className="hidden sm:inline">{makeMove.isPending ? "ANALYZING MOVES..." : !isPlayerTurn ? "CALCULATING PROBABILITIES..." : "OBSERVING"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden on small mobile top bar, or moved */}
        <div className="hidden lg:block space-y-2">
           <GlitchButton 
             variant="outline" 
             className="w-full text-sm py-4 border-destructive/50 text-destructive/80 hover:bg-destructive/10"
             onClick={() => handleNavigateAway("/")}
           >
             SURRENDER
           </GlitchButton>
        </div>
      </aside>

      {/* CENTER PANEL: BOARD - Flex grow to occupy available space */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-8 relative z-0 overflow-hidden min-h-0">
        
        {/* Turn Indicator Banner - Smaller on mobile */}
        <div className="mb-2 sm:mb-4 lg:mb-8 text-center h-6 lg:h-8">
          <AnimatePresence mode="wait">
            {game.winner ? (
               <motion.div
                 key="winner"
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className={cn(
                   "text-lg lg:text-2xl font-display font-black tracking-widest px-4 lg:px-6 py-1 lg:py-2 border-y-2",
                   game.winner === 'player' ? "text-primary border-primary" : 
                   game.winner === 'draw' ? "text-secondary border-secondary" :
                   "text-destructive border-destructive"
                 )}
               >
                 {game.winner === 'player' ? "VICTORY" : 
                  game.winner === 'draw' ? "DRAW" :
                  "DEFEAT"}
               </motion.div>
            ) : (
              <motion.div
                key={makeMove.isPending ? 'analyzing' : game.turn}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className={cn(
                  "text-xs lg:text-lg tracking-widest font-bold uppercase",
                  makeMove.isPending ? "text-destructive" : game.turn === 'player' ? "text-primary" : "text-destructive"
                )}
              >
                {makeMove.isPending ? ">> AI ANALYZING" : game.turn === 'player' ? ">> YOUR TURN" : ">> OPPONENT THINKING"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative w-full h-full flex items-center justify-center">
          <ChessBoard
            boardString={game.board}
            turn={game.turn as 'player' | 'ai'}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            lastMove={lastMove}
            isProcessing={makeMove.isPending}
            difficulty={(game.difficulty as "NEXUS-3" | "NEXUS-5" | "NEXUS-7") || "NEXUS-7"}
            hasError={hasError}
          />
        </div>

        {/* Mobile Action Buttons - Visible only on mobile bottom */}
        <div className="mt-4 lg:hidden w-full max-w-[280px]">
           <button 
             className="w-full text-[10px] py-2 border border-destructive/50 text-destructive/80 font-bold uppercase tracking-widest bg-destructive/5"
             onClick={() => handleNavigateAway("/")}
           >
             [ SURRENDER ]
           </button>
        </div>


        {/* Winner Overlay */}
        {game.winner && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm"
           >
             <div className="text-center space-y-6 max-w-md p-8 border border-white/20 bg-black">
               {game.winner === 'player' ? (
                 <Trophy className="w-16 h-16 text-secondary mx-auto mb-4" />
               ) : game.winner === 'draw' ? (
                 <AlertTriangle className="w-16 h-16 text-secondary mx-auto mb-4" />
               ) : (
                 <Skull className="w-16 h-16 text-destructive mx-auto mb-4" />
               )}
               <h2 className={cn(
                 "text-4xl font-display font-black", 
                 game.winner === 'player' ? "text-primary" : 
                 game.winner === 'draw' ? "text-secondary" :
                 "text-destructive"
               )}>
                 {game.winner === 'player' ? "YOU WON" : 
                  game.winner === 'draw' ? "DRAW" :
                  "YOU LOST"}
               </h2>
               <p className="font-mono text-sm text-muted-foreground">
                 {game.winner === 'player' 
                   ? "Unexpected outcome. The machine is humbled." 
                   : game.winner === 'draw'
                   ? "Resource depletion. Neither side achieved victory."
                   : "Logic prevails. Human error detected."}
               </p>
               <div className="flex gap-4 justify-center">
                 <GlitchButton onClick={() => {
                   isNavigatingAwayRef.current = true;
                   setLocation("/");
                 }}>
                   RETURN TO LOBBY
                 </GlitchButton>
                 <GlitchButton variant="outline" onClick={async () => {
                   try {
                     const newGame = await createGame.mutateAsync();
                     setGameId(newGame.id);
                     // setLocation will trigger a re-render/refetch if we're already on /game
                     // but we might need to reset state manually or rely on the gameId effect
                   } catch (error) {
                     console.error("Failed to create new game:", error);
                   }
                 }}>
                   NEW GAME
                 </GlitchButton>
               </div>
             </div>
           </motion.div>
        )}
      </main>

      {/* RIGHT PANEL: TERMINAL LOG */}
      <aside className="w-full lg:w-1/4 h-32 sm:h-48 lg:h-auto border-t lg:border-t-0 lg:border-l border-border bg-black/80 flex flex-col z-10 shrink-0">
        <div className="p-2 lg:p-3 border-b border-border bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-3 h-3 lg:w-4 lg:h-4 text-accent" />
            <span className="text-[10px] lg:text-xs font-bold tracking-widest text-accent">SYSTEM LOG</span>
          </div>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-red-500/20" />
            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-yellow-500/20" />
            <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-green-500/20" />
          </div>
        </div>
        
        <div className="flex-1 p-2 lg:p-4 overflow-y-auto font-mono text-[10px] lg:text-xs space-y-2 lg:space-y-3 custom-scrollbar">
           {logHistory.map((log, i) => {
             const isAILog = log.message.startsWith(">") || log.message.startsWith("---");
             const isSystemLog = log.message.startsWith("//");
             return (
               <div 
                 key={i} 
                 className={cn(
                   "border-l-2 pl-3 py-1 transition-all",
                   isAILog ? "border-destructive/30 bg-destructive/5" : "border-accent/20"
                 )}
               >
                 {!isSystemLog && (
                   <span className="text-accent/50 mr-2 text-[10px]">[{log.timestamp.toLocaleTimeString()}]</span>
                 )}
                 <span className={cn(
                   "text-xs font-mono",
                   isAILog ? "text-destructive/90" : isSystemLog ? "text-muted-foreground opacity-50" : "text-foreground"
                 )}>
                   {log.message}
                 </span>
               </div>
             );
           })}
           <div ref={logEndRef} />
        </div>
      </aside>
    </div>
  );
}

// Simple parser for history strings (e.g., "e2e4" style logic or just JSON objects)
// Adjust based on your backend logic. Assuming simple coord objects for now or we won't show history lines if format differs.
function parseHistoryString(move: any): { from: {r: number, c: number}, to: {r: number, c: number} } | null {
  // If backend stores explicit from/to object in history array
  if (typeof move === 'object' && move.from && move.to) return move;
  return null;
}
