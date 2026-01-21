/**
 * ISOLATION Board Component
 *
 * Game-specific board component for ISOLATION.
 * Handles rendering of the 7x7 board with pieces and destroyed tiles.
 * Features premium visual effects and smooth animations.
 */

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KingPiece } from "@/components/ChessPieces";
import type { BaseGameBoardProps } from "../GameBoardInterface";
import { parseBoardState } from "./boardUtils";

/**
 * ISOLATION Board Component
 *
 * Renders a 7x7 board with player and AI pieces (Queens).
 * Destroyed tiles are shown with premium visual effects.
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
  isTutorialMode = false,
}: BaseGameBoardProps) {
  // Parse board state
  const boardState = parseBoardState(boardString);
  const { boardSize, playerPos, aiPos, destroyed } = boardState;

  // Track viewport for responsive sizing
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return 1024;
  });

  // Update viewport width on resize with debouncing
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setViewportWidth(window.innerWidth);
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    setViewportWidth(window.innerWidth);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Size configurations with responsive cell sizing
  const sizeConfig = useMemo(() => {
    const maxCellSizes = {
      small: 34,
      medium: 45,
      large: 70,
    };

    const paddingValues = {
      small: { className: "p-2", pixels: 8 },
      medium: { className: "p-3", pixels: 12 },
      large: { className: "p-4", pixels: 16 },
    };

    const maxCellSize = maxCellSizes[size];
    const paddingConfig = paddingValues[size];
    const reservedSpace = paddingConfig.pixels * 2 + 48;
    const availableWidth = Math.max(280, Math.min(viewportWidth * 0.9, 600) - reservedSpace);
    const viewportBasedCellSize = availableWidth / boardSize.cols;
    const responsiveCellSize = Math.max(28, Math.min(maxCellSize, viewportBasedCellSize));

    return {
      small: {
        cellSize: size === "small" ? responsiveCellSize : maxCellSizes.small,
        padding: paddingConfig.className,
      },
      medium: {
        cellSize: size === "medium" ? responsiveCellSize : maxCellSizes.medium,
        padding: paddingConfig.className,
      },
      large: {
        cellSize: size === "large" ? responsiveCellSize : maxCellSizes.large,
        padding: paddingConfig.className,
      },
    };
  }, [size, viewportWidth, boardSize.cols]);

  const config = sizeConfig[size];

  // Get AI colors based on difficulty
  const getAiColors = () => {
    switch (difficulty) {
      case "NEXUS-3":
        return {
          text: "text-blue-400",
          bg: "rgba(96, 165, 250, 0.25)",
          border: "rgba(96, 165, 250, 0.8)",
          glow: "rgba(96, 165, 250, 0.6)",
          solid: "#60a5fa",
          filter: "[filter:drop-shadow(0_0_4px_rgba(96,165,250,0.7))]",
        };
      case "NEXUS-5":
        return {
          text: "text-secondary",
          bg: "rgba(255, 170, 0, 0.25)",
          border: "rgba(255, 170, 0, 0.8)",
          glow: "rgba(255, 170, 0, 0.6)",
          solid: "#ffaa00",
          filter: "[filter:drop-shadow(0_0_4px_rgba(255,200,0,0.7))]",
        };
      case "NEXUS-7":
      default:
        return {
          text: "text-destructive",
          bg: "rgba(255, 0, 60, 0.25)",
          border: "rgba(255, 0, 60, 0.8)",
          glow: "rgba(255, 0, 60, 0.6)",
          solid: "#ff003c",
          filter: "[filter:drop-shadow(0_0_4px_rgba(255,0,60,0.7))]",
        };
    }
  };

  const aiColors = getAiColors();

  // Check if a position is destroyed
  const isDestroyedTile = (r: number, c: number) => {
    return destroyed.some((d) => d.r === r && d.c === c);
  };

  // Check if a position has a piece
  const getPieceAt = (r: number, c: number) => {
    if (playerPos && r === playerPos.r && c === playerPos.c) return "player";
    if (aiPos && r === aiPos.r && c === aiPos.c) return "ai";
    return null;
  };

  // Determine if interaction should be disabled globally
  const isAITurnOrProcessing = useMemo(() => {
    return (isProcessing || turn === "ai") && turn !== undefined;
  }, [isProcessing, turn]);

  // Calculate board dimensions
  const cellSize = config.cellSize;
  const gap = 4;
  const boardWidth = boardSize.cols * cellSize + (boardSize.cols - 1) * gap;
  const boardHeight = boardSize.rows * cellSize + (boardSize.rows - 1) * gap;

  return (
    <motion.div
      className={cn(
        "relative w-fit mx-auto",
        config.padding,
        isAITurnOrProcessing ? "cursor-default" : "cursor-pointer"
      )}
      animate={
        hasError
          ? {
            x: [0, -1.5, 1.2, -0.8, 0.5, -0.2, 0],
            y: [0, 0.8, -0.6, 0.4, -0.3, 0.1, 0],
            rotate: [0, -0.5, 0.4, -0.3, 0.2, -0.1, 0],
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
      {/* Premium Board Frame */}
      <div
        className="relative"
        style={{
          background: `linear-gradient(135deg, rgba(0,243,255,0.15) 0%, rgba(0,0,0,0.9) 50%, ${aiColors.glow.replace("0.6", "0.15")} 100%)`,
          padding: "3px",
          clipPath: "polygon(2% 0%, 98% 0%, 100% 2%, 100% 98%, 98% 100%, 2% 100%, 0% 98%, 0% 2%)",
        }}
      >
        {/* Inner frame with gradient border effect */}
        <div
          className="relative"
          style={{
            background: "linear-gradient(180deg, hsl(var(--background)) 0%, rgba(0,20,25,1) 100%)",
            boxShadow: `
              inset 0 0 60px rgba(0,243,255,0.05),
              0 0 40px rgba(0,243,255,0.15),
              0 0 80px rgba(0,243,255,0.05)
            `,
          }}
        >
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary/60 z-20" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary/60 z-20" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary/60 z-20" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary/60 z-20" />

          {/* AI Analysis Overlay */}
          <AnimatePresence>
            {isAITurnOrProcessing && (
              <motion.div
                className="absolute inset-0 z-30 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div
                  className="w-full h-full isolation-ai-scan"
                  style={{
                    background: `linear-gradient(180deg,
                      transparent 0%,
                      ${aiColors.glow.replace("0.6", "0.03")} 45%,
                      ${aiColors.glow.replace("0.6", "0.1")} 50%,
                      ${aiColors.glow.replace("0.6", "0.03")} 55%,
                      transparent 100%
                    )`,
                    backgroundSize: "100% 200%",
                    animation: "isolation-scan 2s ease-in-out infinite",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interaction blocker during AI turn */}
          {isAITurnOrProcessing && (
            <div
              className="absolute inset-0 z-50 cursor-default"
              style={{ pointerEvents: "auto" }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          )}

          {/* Grid Container */}
          <div
            className="relative p-3"
            style={{
              width: `${boardWidth + 24}px`,
              height: `${boardHeight + 24}px`,
            }}
          >
            {/* Grid background pattern */}
            <div
              className="absolute inset-3 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at center, rgba(0,243,255,0.15) 0%, transparent 70%)`,
              }}
            />

            {/* Game cells grid */}
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${boardSize.cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${boardSize.rows}, ${cellSize}px)`,
                gap: `${gap}px`,
              }}
            >
              {Array.from({ length: boardSize.rows }).map((_, r) =>
                Array.from({ length: boardSize.cols }).map((_, c) => {
                  const piece = getPieceAt(r, c);
                  const isDestroyed = isDestroyedTile(r, c);
                  const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
                  const isValidMoveTarget = !isDestroyed && validMoves.some((m) => m.r === r && m.c === c);
                  const isDestroyCandidate = destroyCandidates.some((d) => d.r === r && d.c === c);
                  const isLastMoveSource = lastMove?.from.r === r && lastMove?.from.c === c;
                  const isLastMoveDest = lastMove?.to.r === r && lastMove?.to.c === c;
                  const isLastMove = isLastMoveSource || isLastMoveDest;
                  const isDarkSquare = (r + c) % 2 === 1;
                  const isInteractionDisabled = isAITurnOrProcessing && !isSelected && !isValidMoveTarget && !isDestroyCandidate;

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      className={cn(
                        "relative flex items-center justify-center transition-all duration-200",
                        isDestroyed
                          ? "cursor-not-allowed"
                          : isInteractionDisabled
                            ? "cursor-default"
                            : "cursor-pointer isolation-cell-interactive",
                        hasError && "brightness-75"
                      )}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        background: isDestroyed
                          ? "linear-gradient(135deg, rgba(5,0,0,0.98) 0%, rgba(15,0,5,0.95) 100%)"
                          : isDestroyCandidate
                            ? "linear-gradient(135deg, rgba(255,50,80,0.15) 0%, rgba(255,0,60,0.08) 100%)"
                            : isSelected
                              ? "linear-gradient(135deg, rgba(0,243,255,0.25) 0%, rgba(0,180,200,0.15) 100%)"
                              : isValidMoveTarget
                                ? "linear-gradient(135deg, rgba(0,243,255,0.12) 0%, rgba(0,200,220,0.06) 100%)"
                                : isDarkSquare
                                  ? "linear-gradient(135deg, rgba(30,35,40,0.6) 0%, rgba(20,25,30,0.8) 100%)"
                                  : "linear-gradient(135deg, rgba(40,45,50,0.4) 0%, rgba(30,35,40,0.6) 100%)",
                        boxShadow: isDestroyed
                          ? "inset 0 0 20px rgba(0,0,0,0.9), inset 0 0 10px rgba(80,0,0,0.4)"
                          : isDestroyCandidate
                            ? "inset 0 0 15px rgba(255,0,60,0.2), 0 0 10px rgba(255,0,60,0.15)"
                            : isSelected
                              ? "inset 0 0 20px rgba(0,243,255,0.3), 0 0 15px rgba(0,243,255,0.2)"
                              : isValidMoveTarget
                                ? "inset 0 0 12px rgba(0,243,255,0.15), 0 0 8px rgba(0,243,255,0.1)"
                                : "inset 0 0 8px rgba(0,0,0,0.4)",
                        border: isDestroyed
                          ? "1px solid rgba(60,0,0,0.8)"
                          : isDestroyCandidate
                            ? "2px solid rgba(255,0,60,0.6)"
                            : isSelected
                              ? "2px solid rgba(0,243,255,0.8)"
                              : isValidMoveTarget
                                ? "1px solid rgba(0,243,255,0.5)"
                                : "1px solid rgba(60,70,80,0.3)",
                        pointerEvents: isInteractionDisabled ? "none" : "auto",
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isDestroyed) return;
                        if (!isProcessing && (turn === "player" || turn === undefined || isSelected || isValidMoveTarget || isDestroyCandidate)) {
                          onSquareClick(r, c);
                        }
                      }}
                      onMouseEnter={() => {
                        if (onSquareHover && !isProcessing && (turn === "player" || turn === undefined)) {
                          onSquareHover(r, c);
                        }
                      }}
                      whileHover={!isDestroyed && !isInteractionDisabled ? { scale: 1.05 } : {}}
                      animate={{
                        scale: isSelected ? 1.02 : 1,
                      }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      {/* Destroyed tile effect */}
                      {isDestroyed && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                          {/* Dark void background */}
                          <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/20 to-black" />
                          {/* Subtle crack pattern */}
                          <div
                            className="absolute inset-0 opacity-30"
                            style={{
                              backgroundImage: `
                                linear-gradient(45deg, transparent 40%, rgba(40,0,0,0.5) 45%, rgba(40,0,0,0.5) 55%, transparent 60%),
                                linear-gradient(-45deg, transparent 40%, rgba(40,0,0,0.5) 45%, rgba(40,0,0,0.5) 55%, transparent 60%)
                              `,
                            }}
                          />
                          {/* X mark */}
                          <X
                            className="relative text-red-900/70 drop-shadow-[0_0_4px_rgba(80,0,0,0.8)]"
                            style={{ width: "50%", height: "50%" }}
                            strokeWidth={2.5}
                          />
                        </div>
                      )}

                      {/* Player piece */}
                      {piece === "player" && (
                        <motion.div
                          key={`piece-player-${r}-${c}`}
                          layout={!isTutorialMode}
                          layoutId={
                            !isTutorialMode && lastMove && isLastMoveDest
                              ? `piece-moving-${lastMove.from.r}-${lastMove.from.c}-player`
                              : !isTutorialMode
                                ? `piece-player-${r}-${c}`
                                : undefined
                          }
                          initial={false}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{
                            layout: { type: "spring", stiffness: 350, damping: 25 },
                            scale: { duration: 0.15 },
                            opacity: { duration: 0.15 },
                          }}
                          className="z-20 flex items-center justify-center select-none text-primary [filter:drop-shadow(0_0_4px_rgba(0,243,255,0.7))]"
                          style={{ width: "70%", height: "70%" }}
                        >
                          <KingPiece />
                        </motion.div>
                      )}

                      {/* AI piece */}
                      {piece === "ai" && (
                        <motion.div
                          key={`piece-ai-${r}-${c}`}
                          layout={!isTutorialMode}
                          layoutId={
                            !isTutorialMode && lastMove && isLastMoveDest
                              ? `piece-moving-${lastMove.from.r}-${lastMove.from.c}-ai`
                              : !isTutorialMode
                                ? `piece-ai-${r}-${c}`
                                : undefined
                          }
                          initial={false}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{
                            layout: { type: "spring", stiffness: 350, damping: 25 },
                            scale: { duration: 0.15 },
                            opacity: { duration: 0.15 },
                          }}
                          className={cn(
                            "z-20 flex items-center justify-center select-none",
                            aiColors.text,
                            aiColors.filter
                          )}
                          style={{ width: "70%", height: "70%" }}
                        >
                          <KingPiece />
                        </motion.div>
                      )}

                      {/* Selection ring */}
                      {isSelected && !isTutorialMode && (
                        <motion.div
                          layoutId="isolation-selection"
                          className="absolute inset-0 z-30 pointer-events-none"
                          style={{
                            border: "2px solid rgba(0,243,255,0.9)",
                            boxShadow: "0 0 15px rgba(0,243,255,0.5), inset 0 0 10px rgba(0,243,255,0.2)",
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}

                      {/* Valid move indicator */}
                      {isValidMoveTarget && !isSelected && !isDestroyed && (
                        <motion.div
                          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="rounded-full bg-primary"
                            style={{
                              width: `${cellSize * 0.2}px`,
                              height: `${cellSize * 0.2}px`,
                              boxShadow: "0 0 12px rgba(0,243,255,0.8), 0 0 20px rgba(0,243,255,0.4)",
                            }}
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.7, 1, 0.7],
                            }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </motion.div>
                      )}

                      {/* Destroy candidate indicator */}
                      {isDestroyCandidate && (
                        <motion.div
                          className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="absolute inset-0"
                            style={{
                              background: "radial-gradient(circle at center, rgba(255,0,60,0.15) 0%, transparent 70%)",
                            }}
                            animate={{ opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                          <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <X
                              className="text-destructive/80 drop-shadow-[0_0_8px_rgba(255,0,60,0.6)]"
                              style={{ width: `${cellSize * 0.4}px`, height: `${cellSize * 0.4}px` }}
                              strokeWidth={2.5}
                            />
                          </motion.div>
                        </motion.div>
                      )}

                      {/* Last move indicator (center dot) - Only show if not occupied by piece or if transparency allows */}
                      {isLastMove && !isSelected && !isDestroyed && (
                        <motion.div
                          className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${cellSize * 0.2}px`,
                              height: `${cellSize * 0.2}px`,
                              background: "rgba(255, 170, 0, 0.8)",
                              boxShadow: "0 0 8px rgba(255, 170, 0, 0.6)",
                            }}
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
