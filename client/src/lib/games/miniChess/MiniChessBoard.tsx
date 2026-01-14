/**
 * Mini Chess Board Component
 * 
 * Game-specific board component for Mini Chess.
 * Handles rendering of the 5x5 chess board with pieces.
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChessPiece } from "@/components/ChessPieces";
import type { BaseGameBoardProps } from "../GameBoardInterface";

/**
 * Mini Chess Board Component
 * 
 * Renders a 5x5 chess board with pieces (King, Knight, Pawn).
 * Player pieces are lowercase (k, n, p), AI pieces are uppercase (K, N, P).
 */
export function MiniChessBoard({ 
  boardString, 
  turn, 
  selectedSquare, 
  lastMove,
  validMoves = [],
  onSquareClick,
  onSquareHover,
  isProcessing,
  size = "large",
  difficulty = "NEXUS-7",
  hasError = false
}: BaseGameBoardProps) {
  
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

  // Size configurations - Responsive with MD breakpoint for smooth tablet transition
  const sizeConfig = {
    small: {
      boardSize: "w-[240px] h-[240px]",
      padding: "p-1",
      paddingOffset: "6px"
    },
    medium: {
      // Progressive sizing: 280px → 320px → 380px for smooth tablet transition
      boardSize: "w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[380px] md:h-[380px]",
      padding: "p-1",
      paddingOffset: "6px"
    },
    large: {
      // Max 600px for consistency across all game types, responsive to viewport
      boardSize: "w-[min(90vw,75vh,600px)] h-[min(90vw,75vh,600px)]",
      padding: "p-2",
      paddingOffset: "10px"
    }
  };

  const config = sizeConfig[size];
  
  // Get AI piece color based on difficulty
  const getAiPieceColor = () => {
    switch (difficulty) {
      case "NEXUS-3":
        return "text-blue-400 [filter:drop-shadow(0_0_8px_rgba(96,165,250,0.8))]";
      case "NEXUS-5":
        return "text-secondary [filter:drop-shadow(0_0_8px_rgba(255,200,0,0.8))]";
      case "NEXUS-7":
      default:
        return "text-destructive [filter:drop-shadow(0_0_8px_rgba(255,0,60,0.8))]";
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
                  if (!isProcessing && (turn === 'player' || turn === undefined || isSelected || isValidMoveTarget)) {
                    onSquareClick(r, c);
                  }
                }}
                onMouseEnter={() => {
                  if (onSquareHover && !isProcessing && (turn === 'player' || turn === undefined)) {
                    onSquareHover(r, c);
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
                  (isProcessing || turn === 'ai') && !isSelected && !isValidMoveTarget && turn !== undefined && "cursor-default"
                )}
              >
                {pieceChar !== '.' && (
                  <motion.div
                    key={`piece-${pieceChar}-${r}-${c}`}
                    layout
                    // layoutId를 일관되게 설정: 이동 중인 기물만 특별한 ID 사용, 나머지는 고유 ID 사용
                    // 이렇게 하면 framer-motion이 기물의 위치 변화를 정확히 추적할 수 있음
                    layoutId={
                      lastMove && isLastMoveDest 
                        ? `piece-moving-${lastMove.from.r}-${lastMove.from.c}-${pieceChar.toLowerCase()}`
                        : `piece-${pieceChar.toLowerCase()}-${r}-${c}`
                    }
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      layout: { 
                        type: "spring", 
                        stiffness: 400, 
                        damping: 25,
                        duration: 0.5
                      },
                      scale: { duration: 0.15 },
                      opacity: { duration: 0.15 }
                    }}
                    className={cn(
                      "z-10 flex items-center justify-center w-[70%] h-[70%] select-none",
                      isPlayerPiece
                        ? "text-primary [filter:drop-shadow(0_0_8px_rgba(0,243,255,0.8))]"
                        : getAiPieceColor()
                    )}
                  >
                    <ChessPiece type={pieceChar} />
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
