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
  validMoves?: { r: number, c: number }[];
  onSquareClick: (r: number, c: number) => void;
  isProcessing?: boolean;
  size?: "small" | "medium" | "large";
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  hasError?: boolean;
}

export function ChessBoard({ 
  boardString, 
  turn, 
  selectedSquare, 
  lastMove,
  validMoves = [],
  onSquareClick,
  isProcessing,
  size = "large",
  difficulty = "NEXUS-7",
  hasError = false
}: ChessBoardProps) {
  
  // Parse board string (FEN format: "NPKPN/5/5/5/npkpn")
  const rows: string[][] = [];
  const fenRows = boardString.split('/');
  
  for (let r = 0; r < 5; r++) {
    const row: string[] = [];
    const fenRow = fenRows[r] || '';
    
    for (let i = 0; i < fenRow.length; i++) {
      const char = fenRow[i];
      if (char >= '1' && char <= '5') {
        // Empty squares
        const emptyCount = parseInt(char);
        for (let j = 0; j < emptyCount; j++) {
          row.push('.');
        }
      } else {
        // Piece
        row.push(char);
      }
    }
    
    // Ensure row has exactly 5 columns
    while (row.length < 5) {
      row.push('.');
    }
    
    rows.push(row);
  }

  // Size configurations
  const sizeConfig = {
    small: {
      boardSize: "w-[240px] h-[240px]",
      iconSize: 20,
      padding: "p-1",
      paddingOffset: "6px" // p-1 (4px) + border (2px)
    },
    medium: {
      boardSize: "w-[320px] h-[320px]",
      iconSize: 28,
      padding: "p-1.5",
      paddingOffset: "8px" // p-1.5 (6px) + border (2px)
    },
    large: {
      boardSize: "w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px]",
      iconSize: 32,
      padding: "p-1.5",
      paddingOffset: "8px" // p-1.5 (6px) + border (2px)
    }
  };

  const config = sizeConfig[size];
  
  // Get AI piece color based on difficulty
  const getAiPieceColor = () => {
    switch (difficulty) {
      case "NEXUS-3":
        // 쉬움: 파란색 계열 (primary와 구분되는 밝은 파란색)
        return "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]";
      case "NEXUS-5":
        // 보통: 노란색 계열 (secondary)
        return "text-secondary drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]";
      case "NEXUS-7":
      default:
        // 어려움: 빨간색 계열 (destructive)
        return "text-destructive drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]";
    }
  };
  
  const getPieceIcon = (char: string) => {
    const isPlayer = char === char.toUpperCase();
    const type = char.toLowerCase();
    
    // Icon props
    const strokeWidth = 2.5;
    
    switch(type) {
      case 'k': return <Crown size={config.iconSize} strokeWidth={strokeWidth} />;
      case 'n': return <Component size={config.iconSize} strokeWidth={strokeWidth} className="rotate-45" />; // Abstract knight
      case 'p': return <Circle size={config.iconSize} strokeWidth={strokeWidth} />;
      default: return null;
    }
  };

  return (
    <motion.div 
      className={cn("relative bg-border border-2 border-border shadow-[0_0_30px_rgba(0,243,255,0.1)] w-fit mx-auto", config.padding)}
      animate={hasError ? {
        x: [0, -1.5, 1.2, -0.8, 0.5, -0.2, 0],
        y: [0, 0.8, -0.6, 0.4, -0.3, 0.1, 0],
        rotate: [0, -0.5, 0.4, -0.3, 0.2, -0.1, 0],
        boxShadow: [
          "0 0 30px rgba(0,243,255,0.1)",
          "0 0 40px rgba(255,0,60,0.7)",
          "0 0 35px rgba(255,0,60,0.5)",
          "0 0 38px rgba(255,0,60,0.6)",
          "0 0 33px rgba(255,0,60,0.4)",
          "0 0 36px rgba(255,0,60,0.3)",
          "0 0 30px rgba(0,243,255,0.1)"
        ],
        borderColor: [
          "hsl(var(--border))",
          "rgba(255,0,60,0.9)",
          "rgba(255,0,60,0.7)",
          "rgba(255,0,60,0.8)",
          "rgba(255,0,60,0.6)",
          "rgba(255,0,60,0.4)",
          "hsl(var(--border))"
        ]
      } : {}}
      transition={hasError ? {
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1], // Custom cubic-bezier for smooth, natural feel
        times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1]
      } : {}}
    >
      {/* Grid Container - Fixed size to ensure square cells */}
      <motion.div 
        className={cn("grid grid-cols-5 grid-rows-5 gap-1 bg-background", config.boardSize)}
        animate={hasError ? {
          backgroundColor: [
            "hsl(var(--background))",
            "rgba(255,0,60,0.12)",
            "rgba(255,0,60,0.08)",
            "rgba(255,0,60,0.1)",
            "rgba(255,0,60,0.06)",
            "rgba(255,0,60,0.04)",
            "hsl(var(--background))"
          ]
        } : {}}
        transition={hasError ? {
          duration: 0.6,
          ease: [0.25, 0.1, 0.25, 1],
          times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1]
        } : {}}
      >
        {rows.map((row, r) => (
          row.map((pieceChar, c) => {
            // Player uses lowercase (n, p, k), AI uses uppercase (N, P, K)
            const isPlayerPiece = pieceChar !== '.' && pieceChar === pieceChar.toLowerCase() && pieceChar !== pieceChar.toUpperCase();
            const isAiPiece = pieceChar !== '.' && pieceChar === pieceChar.toUpperCase() && pieceChar !== pieceChar.toLowerCase();
            const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
            const isValidMoveTarget = validMoves.some(m => m.r === r && m.c === c);
            
            // Highlight logic
            const isLastMoveSource = lastMove?.from.r === r && lastMove?.from.c === c;
            const isLastMoveDest = lastMove?.to.r === r && lastMove?.to.c === c;
            const isLastMove = isLastMoveSource || isLastMoveDest;

            // Checkerboard pattern (subtle)
            const isDarkSquare = (r + c) % 2 === 1;

            return (
              <motion.div
                key={`${r}-${c}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isProcessing && (turn === 'player' || isSelected || isValidMoveTarget)) {
                    onSquareClick(r, c);
                  }
                }}
                initial={false}
                animate={{
                  backgroundColor: isSelected 
                    ? "rgba(0, 243, 255, 0.2)" 
                    : isValidMoveTarget
                      ? "rgba(0, 243, 255, 0.1)"
                      : isLastMove 
                        ? "rgba(255, 170, 0, 0.15)"
                        : isDarkSquare 
                          ? "rgba(255,255,255,0.03)" 
                          : "transparent"
                }}
                className={cn(
                  "w-full h-full flex items-center justify-center cursor-pointer relative",
                  "border border-white/5 hover:border-white/20 transition-colors",
                  isSelected && "border-primary shadow-[inset_0_0_15px_rgba(0,243,255,0.3)]",
                  isValidMoveTarget && !isSelected && "border-primary/50",
                  isLastMove && !isSelected && !isValidMoveTarget && "border-secondary/50",
                  // Disable interaction if processing or AI turn (unless it's just selection visual)
                  (isProcessing || turn === 'ai') && !isSelected && !isValidMoveTarget && "cursor-default"
                )}
              >
                {/* Coordinates overlay (optional detail) */}
                <span className="absolute bottom-0.5 right-1 text-[8px] text-muted-foreground opacity-30 font-mono">
                  {String.fromCharCode(97 + c)}{5 - r}
                </span>

                {pieceChar !== '.' && (
                  <motion.div
                    key={`piece-${pieceChar}-${r}-${c}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0 }}
                    className={cn(
                      "transition-all duration-300 z-10",
                      isPlayerPiece 
                        ? "text-primary drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" 
                        : getAiPieceColor()
                    )}
                  >
                    {getPieceIcon(pieceChar)}
                  </motion.div>
                )}

                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="selection"
                    className="absolute inset-0 border-2 border-primary z-20"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                
                {/* Valid Move Indicator */}
                {isValidMoveTarget && !isSelected && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center z-20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary/60 shadow-[0_0_8px_rgba(0,243,255,0.4)]" />
                  </motion.div>
                )}
              </motion.div>
            );
          })
        ))}
      </motion.div>
      
      {/* Decorative border corners */}
      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
    </motion.div>
  );
}
