import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useGame, useMakeMove, useCreateGame } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { ChessBoard } from "@/components/ChessBoard";
import { Scanlines } from "@/components/Scanlines";
import { GlitchButton } from "@/components/GlitchButton";
import { TerminalText } from "@/components/TerminalText";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle, Trophy, Radio, Terminal as TerminalIcon, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseBoardString, getValidMovesClient } from "@/lib/gameLogic";
import { parseFen } from "@shared/gameLogic";

export default function GameRoom() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const gameId = id ? parseInt(id) : null;
  const { data: game, isLoading, error } = useGame(gameId);
  const makeMove = useMakeMove(gameId!);
  const createGame = useCreateGame();
  const { toast } = useToast();

  const [selectedSquare, setSelectedSquare] = useState<{r: number, c: number} | null>(null);
  const [logHistory, setLogHistory] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Update logs when game updates
  useEffect(() => {
    if (game?.aiLog && !logHistory.includes(game.aiLog)) {
      setLogHistory(prev => [...prev, game.aiLog!]);
    }
  }, [game?.aiLog]);

  // Auto scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logHistory]);

  if (isLoading) return (
    <div className="h-screen w-full bg-background flex items-center justify-center text-primary font-mono">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <TerminalText text="CONNECTING TO NEURAL LINK..." />
      </div>
      <Scanlines />
    </div>
  );

  if (error || !game) return (
    <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-destructive font-mono gap-4">
      <AlertTriangle className="w-12 h-12" />
      <h2 className="text-xl">CRITICAL SYSTEM FAILURE</h2>
      <p>Connection Lost.</p>
      <GlitchButton onClick={() => setLocation("/")} variant="outline">
        ABORT
      </GlitchButton>
      <Scanlines />
    </div>
  );

  const handleSquareClick = async (r: number, c: number) => {
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
        const result = await makeMove.mutateAsync({
          from: selectedSquare,
          to: { r, c }
        });
        setSelectedSquare(null);
        
        // Log for debugging
        console.log("Move successful:", {
          from: selectedSquare,
          to: { r, c },
          updatedGame: result
        });
      } catch (err: any) {
        console.error("Move failed:", err);
        toast({
          title: "Invalid Move",
          description: err?.message || "That move is not allowed. Try again.",
          variant: "destructive",
        });
        setSelectedSquare(null);
      }
    }
  };

  const isPlayerTurn = game.turn === 'player';
  const lastMove = (game.history && game.history.length > 0) 
    ? parseHistoryString(game.history[game.history.length - 1]) 
    : null;

  // Calculate valid moves for selected piece
  const validMoves = useMemo(() => {
    if (!selectedSquare || !isPlayerTurn) return [];
    const board = parseBoardString(game.board);
    return getValidMovesClient(board, selectedSquare, true);
  }, [selectedSquare, game.board, isPlayerTurn]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col lg:flex-row overflow-hidden font-mono">
      <Scanlines />

      {/* LEFT PANEL: STATUS & INFO */}
      <aside className="w-full lg:w-1/4 p-6 border-r border-border bg-black/40 backdrop-blur-sm flex flex-col justify-between z-10">
        <div>
          <div className="mb-8">
            <h1 onClick={() => setLocation("/")} className="text-2xl font-display font-black tracking-tighter cursor-pointer hover:text-primary transition-colors">
              MOVE 37
            </h1>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <Radio className="w-3 h-3 text-accent animate-pulse" />
              CONNECTED: {game.id}
            </div>
          </div>

          <div className="space-y-6">
            {/* Player Card */}
            <div className={cn(
              "p-4 border transition-all duration-300",
              isPlayerTurn ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,243,255,0.1)]" : "border-white/10 opacity-50"
            )}>
              <h3 className="text-sm font-bold mb-1">PLAYER (YOU)</h3>
              <div className="flex items-center gap-2 text-xs">
                <div className={cn("w-2 h-2 rounded-full", isPlayerTurn ? "bg-primary animate-pulse" : "bg-gray-600")} />
                {isPlayerTurn ? "AWAITING INPUT" : "STANDBY"}
              </div>
            </div>

            {/* AI Card */}
            <div className={cn(
              "p-4 border transition-all duration-300",
              !isPlayerTurn ? "border-destructive bg-destructive/5 shadow-[0_0_15px_rgba(255,0,60,0.1)]" : "border-white/10 opacity-50"
            )}>
              <h3 className="text-sm font-bold mb-1 text-destructive">NEXUS-7 (AI)</h3>
              <div className="flex items-center gap-2 text-xs text-destructive">
                <div className={cn("w-2 h-2 rounded-full", !isPlayerTurn ? "bg-destructive animate-pulse" : "bg-gray-600")} />
                {!isPlayerTurn ? "CALCULATING PROBABILITIES..." : "OBSERVING"}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
           <GlitchButton 
             variant="outline" 
             className="w-full text-sm py-4 border-destructive/50 text-destructive/80 hover:bg-destructive/10"
             onClick={() => setLocation("/")}
           >
             SURRENDER
           </GlitchButton>
        </div>
      </aside>

      {/* CENTER PANEL: BOARD */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 lg:p-12 relative z-0">
        
        {/* Turn Indicator Banner */}
        <div className="mb-8 text-center h-8">
          <AnimatePresence mode="wait">
            {game.winner ? (
               <motion.div
                 key="winner"
                 initial={{ opacity: 0, scale: 0.8 }}
                 animate={{ opacity: 1, scale: 1 }}
                 className={cn(
                   "text-2xl font-display font-black tracking-widest px-6 py-2 border-y-2",
                   game.winner === 'player' ? "text-primary border-primary" : 
                   game.winner === 'draw' ? "text-secondary border-secondary" :
                   "text-destructive border-destructive"
                 )}
               >
                 {game.winner === 'player' ? "VICTORY ACHIEVED" : 
                  game.winner === 'draw' ? "RESOURCE DEPLETION - DRAW" :
                  "SYSTEM DEFEAT"}
               </motion.div>
            ) : (
              <motion.div
                key={game.turn}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={cn(
                  "text-lg tracking-widest font-bold",
                  game.turn === 'player' ? "text-primary" : "text-destructive"
                )}
              >
                {game.turn === 'player' ? ">> YOUR TURN" : ">> OPPONENT THINKING"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ChessBoard
          boardString={game.board}
          turn={game.turn as 'player' | 'ai'}
          selectedSquare={selectedSquare}
          validMoves={validMoves}
          onSquareClick={handleSquareClick}
          lastMove={lastMove}
          isProcessing={makeMove.isPending}
        />

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
                 <GlitchButton onClick={() => setLocation("/")}>
                   RETURN TO LOBBY
                 </GlitchButton>
                 <GlitchButton variant="outline" onClick={async () => {
                   try {
                     const newGame = await createGame.mutateAsync();
                     setLocation(`/game/${newGame.id}`);
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
      <aside className="w-full lg:w-1/4 h-64 lg:h-auto border-t lg:border-t-0 lg:border-l border-border bg-black/80 flex flex-col z-10">
        <div className="p-3 border-b border-border bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold tracking-widest text-accent">SYSTEM LOG</span>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/20" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
            <div className="w-2 h-2 rounded-full bg-green-500/20" />
          </div>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar">
           <div className="text-muted-foreground opacity-50 mb-4">
             // Monitoring neural activity...<br/>
             // Connection established.<br/>
             // Access level: UNRESTRICTED
           </div>
           
           {logHistory.map((log, i) => (
             <div key={i} className="border-l-2 border-accent/20 pl-3 py-1">
               <span className="text-accent/50 mr-2">[{new Date().toLocaleTimeString()}]</span>
               <TerminalText text={log} speed={10} className="text-foreground" />
             </div>
           ))}
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
