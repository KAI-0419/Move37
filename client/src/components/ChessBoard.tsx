import { motion } from "framer-motion";
import { Crown, Component, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type PieceType = 'K' | 'N' | 'P' | '.' | string;
// Assuming board string "rnbqk..." mapped to 5x5
// 5x5 = 25 chars. 
// Valid pieces for Sacrifice Tactics (usually K, N, P variant)
// Let's assume K = King, N = Knight, P = Pawn.
// Uppercase = White (Player), Lowercase = Black (AI).

interface ChessBoardProps {
  boardString: string;
  turn: "player" | "ai";
  selectedSquare: { r: number, c: number } | null;
  lastMove: { from: { r: number, c: number }, to: { r: number, c: number } } | null;
  onSquareClick: (r: number, c: number) => void;
  isProcessing?: boolean;
}

export function ChessBoard({ 
  boardString, 
  turn, 
  selectedSquare, 
  lastMove,
  onSquareClick,
  isProcessing 
}: ChessBoardProps) {
  
  // Parse board string into 2D grid
  // Assuming standard FEN-like or raw string of length 25
  const rows = [];
  for (let r = 0; r < 5; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      const idx = r * 5 + c;
      row.push(boardString[idx] || '.');
    }
    rows.push(row);
  }

  const getPieceIcon = (char: string) => {
    const isPlayer = char === char.toUpperCase();
    const type = char.toLowerCase();
    
    // Icon props
    const size = 32;
    const strokeWidth = 2.5;
    
    switch(type) {
      case 'k': return <Crown size={size} strokeWidth={strokeWidth} />;
      case 'n': return <Component size={size} strokeWidth={strokeWidth} className="rotate-45" />; // Abstract knight
      case 'p': return <Circle size={size} strokeWidth={strokeWidth} />;
      default: return null;
    }
  };

  return (
    <div className="relative p-1 bg-border border-2 border-border shadow-[0_0_30px_rgba(0,243,255,0.1)]">
      {/* Grid Container */}
      <div className="grid grid-cols-5 gap-1 bg-background">
        {rows.map((row, r) => (
          row.map((pieceChar, c) => {
            const isPlayerPiece = pieceChar !== '.' && pieceChar === pieceChar.toUpperCase();
            const isAiPiece = pieceChar !== '.' && pieceChar === pieceChar.toLowerCase();
            const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
            
            // Highlight logic
            const isLastMoveSource = lastMove?.from.r === r && lastMove?.from.c === c;
            const isLastMoveDest = lastMove?.to.r === r && lastMove?.to.c === c;
            const isLastMove = isLastMoveSource || isLastMoveDest;

            // Checkerboard pattern (subtle)
            const isDarkSquare = (r + c) % 2 === 1;

            return (
              <motion.div
                key={`${r}-${c}`}
                onClick={() => onSquareClick(r, c)}
                initial={false}
                animate={{
                  backgroundColor: isSelected 
                    ? "rgba(0, 243, 255, 0.2)" 
                    : isLastMove 
                      ? "rgba(255, 170, 0, 0.15)"
                      : isDarkSquare 
                        ? "rgba(255,255,255,0.03)" 
                        : "transparent"
                }}
                className={cn(
                  "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center cursor-pointer relative",
                  "border border-white/5 hover:border-white/20 transition-colors",
                  isSelected && "border-primary shadow-[inset_0_0_15px_rgba(0,243,255,0.3)]",
                  isLastMove && !isSelected && "border-secondary/50",
                  // Disable interaction if processing or AI turn (unless it's just selection visual)
                  (isProcessing || turn === 'ai') && !isSelected && "cursor-default"
                )}
              >
                {/* Coordinates overlay (optional detail) */}
                <span className="absolute bottom-0.5 right-1 text-[8px] text-muted-foreground opacity-30 font-mono">
                  {String.fromCharCode(97 + c)}{5 - r}
                </span>

                {pieceChar !== '.' && (
                  <motion.div
                    layoutId={`piece-${r}-${c}`} // Ideally unique ID if pieces moved, but grid coord works for simple state
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0 }}
                    className={cn(
                      "transition-all duration-300",
                      isPlayerPiece ? "text-primary drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" : "text-destructive drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]"
                    )}
                  >
                    {getPieceIcon(pieceChar)}
                  </motion.div>
                )}

                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="selection"
                    className="absolute inset-0 border-2 border-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>
            );
          })
        ))}
      </div>
      
      {/* Decorative border corners */}
      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
    </div>
  );
}
