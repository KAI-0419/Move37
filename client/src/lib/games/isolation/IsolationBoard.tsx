/**
 * ISOLATION Board Component
 * 
 * Game-specific board component for ISOLATION.
 * Handles rendering of the 7x7 board with pieces and destroyed tiles.
 */

import { motion } from "framer-motion";
import { Crown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BaseGameBoardProps } from "../GameBoardInterface";
import { parseBoardState } from "./boardUtils";

/**
 * ISOLATION Board Component
 * 
 * Renders a 7x7 board with player and AI pieces (Queens).
 * Destroyed tiles are shown with a dark background and X mark.
 */
export function IsolationBoard({
  boardString,
  turn,
  selectedSquare,
  lastMove,
  validMoves = [],
  destroyCandidates = [],
  onSquareClick,
  onSquareHover,
  isProcessing,
  size = "large",
  difficulty = "NEXUS-7",
  hasError = false,
}: BaseGameBoardProps) {
  // Parse board state
  const boardState = parseBoardState(boardString);
  const { boardSize, playerPos, aiPos, destroyed } = boardState;

  // Size configurations
  const sizeConfig = {
    small: {
      boardSize: "w-[280px] h-[280px]",
      iconSize: 20,
      padding: "p-1",
      paddingOffset: "6px",
    },
    medium: {
      boardSize: "w-[320px] h-[320px] sm:w-[400px] sm:h-[400px]",
      iconSize: 24,
      padding: "p-1",
      paddingOffset: "6px",
    },
    large: {
      boardSize: "w-[min(90vw,75vh,700px)] h-[min(90vw,75vh,700px)]",
      iconSize: 32,
      padding: "p-2",
      paddingOffset: "10px",
    },
  };

  const config = sizeConfig[size];

  // Get AI piece color based on difficulty
  const getAiPieceColor = () => {
    switch (difficulty) {
      case "NEXUS-3":
        return "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]";
      case "NEXUS-5":
        return "text-secondary drop-shadow-[0_0_8px_rgba(255,200,0,0.8)]";
      case "NEXUS-7":
      default:
        return "text-destructive drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]";
    }
  };

  // Check if a position is destroyed
  const isDestroyedTile = (r: number, c: number) => {
    return destroyed.some((d) => d.r === r && d.c === c);
  };

  // Check if a position has a piece
  const getPieceAt = (r: number, c: number) => {
    if (r === playerPos.r && c === playerPos.c) return "player";
    if (r === aiPos.r && c === aiPos.c) return "ai";
    return null;
  };

  return (
    <motion.div
      className={cn(
        "relative bg-border border-2 border-border shadow-[0_0_30px_rgba(0,243,255,0.1)] w-fit mx-auto",
        config.padding
      )}
      animate={
        hasError
          ? {
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
                "0 0 30px rgba(0,243,255,0.1)",
              ],
              borderColor: [
                "hsl(var(--border))",
                "rgba(255,0,60,0.9)",
                "rgba(255,0,60,0.7)",
                "rgba(255,0,60,0.8)",
                "rgba(255,0,60,0.6)",
                "rgba(255,0,60,0.4)",
                "hsl(var(--border))",
              ],
            }
          : {}
      }
      transition={
        hasError
          ? {
              duration: 0.6,
              ease: [0.25, 0.1, 0.25, 1],
              times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
            }
          : {}
      }
    >
      {/* Grid Container */}
      <motion.div
        className={cn(
          "grid gap-1 bg-background",
          `grid-cols-${boardSize.cols} grid-rows-${boardSize.rows}`,
          config.boardSize
        )}
        style={{
          gridTemplateColumns: `repeat(${boardSize.cols}, 1fr)`,
          gridTemplateRows: `repeat(${boardSize.rows}, 1fr)`,
        }}
        animate={
          hasError
            ? {
                backgroundColor: [
                  "hsl(var(--background))",
                  "rgba(255,0,60,0.12)",
                  "rgba(255,0,60,0.08)",
                  "rgba(255,0,60,0.1)",
                  "rgba(255,0,60,0.06)",
                  "rgba(255,0,60,0.04)",
                  "hsl(var(--background))",
                ],
              }
            : {}
        }
        transition={
          hasError
            ? {
                duration: 0.6,
                ease: [0.25, 0.1, 0.25, 1],
                times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
              }
            : {}
        }
      >
        {Array.from({ length: boardSize.rows }).map((_, r) =>
          Array.from({ length: boardSize.cols }).map((_, c) => {
            const piece = getPieceAt(r, c);
            const isDestroyed = isDestroyedTile(r, c);
            const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
            // IMPORTANT: 파괴된 타일은 절대 이동 가능 타일로 표시하지 않음
            const isValidMoveTarget = !isDestroyed && validMoves.some((m) => m.r === r && m.c === c);
            const isDestroyCandidate = destroyCandidates.some((d) => d.r === r && d.c === c);

            // Highlight logic
            const isLastMoveSource =
              lastMove?.from.r === r && lastMove?.from.c === c;
            const isLastMoveDest =
              lastMove?.to.r === r && lastMove?.to.c === c;
            const isLastMove = isLastMoveSource || isLastMoveDest;

            // Checkerboard pattern (subtle)
            const isDarkSquare = (r + c) % 2 === 1;

            return (
              <motion.div
                key={`${r}-${c}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 파괴된 타일은 절대 클릭 불가
                  if (isDestroyed) {
                    return;
                  }
                  if (!isProcessing && (turn === "player" || turn === undefined || isSelected || isValidMoveTarget)) {
                    onSquareClick(r, c);
                  }
                }}
                onMouseEnter={() => {
                  if (onSquareHover && !isProcessing && (turn === "player" || turn === undefined)) {
                    onSquareHover(r, c);
                  }
                }}
                initial={false}
                animate={{
                  backgroundColor: isDestroyed
                    ? "rgba(20, 0, 0, 0.95)" // 매우 어두운 빨간색 배경으로 명확히 구분
                    : isDestroyCandidate
                    ? "rgba(255, 0, 60, 0.2)"
                    : isSelected
                    ? "rgba(0, 243, 255, 0.25)"
                    : isValidMoveTarget
                    ? "rgba(0, 243, 255, 0.15)"
                    : isLastMove
                    ? "rgba(255, 170, 0, 0.15)"
                    : isDarkSquare
                    ? "rgba(255,255,255,0.03)"
                    : "transparent",
                }}
                className={cn(
                  "w-full h-full flex items-center justify-center relative transition-colors",
                  // 파괴된 타일은 클릭 불가능하게 설정
                  isDestroyed 
                    ? "cursor-not-allowed opacity-60" 
                    : "cursor-pointer",
                  "border border-white/5 hover:border-white/20",
                  isDestroyed && "border-destructive border-2 shadow-[inset_0_0_20px_rgba(255,0,60,0.3)]",
                  isDestroyCandidate && "border-destructive/70 shadow-[0_0_15px_rgba(255,0,60,0.3)] z-30",
                  isSelected && "border-primary shadow-[inset_0_0_20px_rgba(0,243,255,0.4)] z-30",
                  isValidMoveTarget && !isSelected && "border-primary/60 shadow-[0_0_10px_rgba(0,243,255,0.2)] z-20",
                  isLastMove && !isSelected && !isValidMoveTarget && "border-secondary/50",
                  (isProcessing || turn === "ai") &&
                    !isSelected &&
                    !isValidMoveTarget &&
                    !isDestroyCandidate &&
                    turn !== undefined &&
                    "cursor-default"
                )}
              >
                {/* Destroyed tile effect - 매우 명확한 시각적 표시 */}
                {isDestroyed && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0.6, 0.9, 0.6],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {/* 어두운 배경 레이어 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-red-950/80 via-red-900/70 to-black/90" />
                    {/* 빨간색 글로우 효과 */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,60,0.4)_0%,transparent_70%)]" />
                    {/* 크고 선명한 X 아이콘 */}
                    <X
                      className="absolute w-2/3 h-2/3 text-destructive drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]"
                      strokeWidth={3}
                    />
                    {/* 추가 텍스처 효과 */}
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,0,60,0.1)_2px,rgba(255,0,60,0.1)_4px)] opacity-30" />
                  </motion.div>
                )}

                {/* Player piece */}
                {piece === "player" && (
                  <motion.div
                    key={`piece-player-${r}-${c}`}
                    layout
                    layoutId={
                      lastMove && isLastMoveDest
                        ? `piece-moving-${lastMove.from.r}-${lastMove.from.c}-player`
                        : `piece-player-${r}-${c}`
                    }
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      },
                      scale: { duration: 0.15 },
                      opacity: { duration: 0.15 },
                    }}
                    className={cn(
                      "z-20 flex items-center justify-center w-full h-full",
                      "text-primary drop-shadow-[0_0_12px_rgba(0,243,255,0.9)]"
                    )}
                  >
                    <Crown className="w-[80%] h-[80%]" strokeWidth={2.5} />
                  </motion.div>
                )}

                {/* AI piece */}
                {piece === "ai" && (
                  <motion.div
                    key={`piece-ai-${r}-${c}`}
                    layout
                    layoutId={
                      lastMove && isLastMoveDest
                        ? `piece-moving-${lastMove.from.r}-${lastMove.from.c}-ai`
                        : `piece-ai-${r}-${c}`
                    }
                    initial={false}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      layout: {
                        type: "spring",
                        stiffness: 300,
                        damping: 25,
                      },
                      scale: { duration: 0.15 },
                      opacity: { duration: 0.15 },
                    }}
                    className={cn(
                      "z-20 flex items-center justify-center w-full h-full",
                      getAiPieceColor()
                    )}
                  >
                    <Crown className="w-[80%] h-[80%]" strokeWidth={2.5} />
                  </motion.div>
                )}

                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="selection"
                    className="absolute inset-0 border-2 border-primary z-30 shadow-[0_0_15px_rgba(0,243,255,0.5)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Valid Move Indicator - 파괴된 타일이 아닐 때만 표시 */}
                {isValidMoveTarget && !isSelected && !isDestroyed && (
                  <motion.div
                    className="absolute inset-0 z-20 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0.4, 0.7, 0.4],
                      backgroundColor: "rgba(0, 243, 255, 0.2)"
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="absolute inset-0 border-2 border-primary/60 shadow-[0_0_15px_rgba(0,243,255,0.4)]" />
                    <motion.div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-[0_0_15px_rgba(0,243,255,1)]"
                      animate={{ 
                        scale: [1, 1.3, 1],
                        opacity: [0.7, 1, 0.7]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  </motion.div>
                )}

                {/* Destroy Candidate Indicator */}
                {isDestroyCandidate && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center z-30 bg-destructive/5"
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: [0.4, 0.7, 0.4],
                      scale: [0.95, 1.05, 0.95]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <X className="w-1/2 h-1/2 text-destructive shadow-[0_0_10px_rgba(255,0,60,0.5)]" strokeWidth={3} />
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Decorative border corners */}
      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-primary" />
      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-primary" />
      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-primary" />
      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary" />
    </motion.div>
  );
}
