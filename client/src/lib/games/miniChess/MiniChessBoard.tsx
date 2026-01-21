/**
 * Mini Chess Board Component
 *
 * Game-specific board component for Mini Chess.
 * Handles rendering of the 5x5 chess board with pieces.
 * Features premium visual effects and smooth animations.
 */

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChessPiece } from "@/components/ChessPieces";
import type { BaseGameBoardProps } from "../GameBoardInterface";
import { useWorkerCleanup } from "../useWorkerCleanup";
import { terminateMiniChessWorkerPool } from "./miniChessWorkerPool";

const BOARD_SIZE = 5;

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
  hasError = false,
  isTutorialMode = false,
}: BaseGameBoardProps) {
  // Ensure background workers are cleaned up when component unmounts
  useWorkerCleanup(terminateMiniChessWorkerPool, "Mini Chess");

  // Parse board string (FEN format: "NPKPN/5/5/5/npkpn")
  const rows: string[][] = useMemo(() => {
    const result: string[][] = [];
    const fenRows = boardString.split("/");

    for (let r = 0; r < BOARD_SIZE; r++) {
      const row: string[] = [];
      const fenRow = fenRows[r] || "";

      for (let i = 0; i < fenRow.length; i++) {
        const char = fenRow[i];
        if (char >= "1" && char <= "5") {
          // Empty squares
          const emptyCount = parseInt(char);
          for (let j = 0; j < emptyCount; j++) {
            row.push(".");
          }
        } else {
          // Piece
          row.push(char);
        }
      }

      // Ensure row has exactly 5 columns
      while (row.length < BOARD_SIZE) {
        row.push(".");
      }

      result.push(row);
    }
    return result;
  }, [boardString]);

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
      small: 45,
      medium: 60,
      large: 90,
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
    const viewportBasedCellSize = availableWidth / BOARD_SIZE;
    const responsiveCellSize = Math.max(40, Math.min(maxCellSize, viewportBasedCellSize));

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
  }, [size, viewportWidth]);

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

  // Determine if interaction should be disabled globally
  const isAITurnOrProcessing = useMemo(() => {
    return (isProcessing || turn === "ai") && turn !== undefined;
  }, [isProcessing, turn]);

  // Calculate board dimensions
  const cellSize = config.cellSize;
  const gap = 4;
  const boardWidth = BOARD_SIZE * cellSize + (BOARD_SIZE - 1) * gap;
  const boardHeight = BOARD_SIZE * cellSize + (BOARD_SIZE - 1) * gap;

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
          background: `linear-gradient(135deg, rgba(0,243,255,0.2) 0%, rgba(0,0,0,0.9) 50%, ${aiColors.glow.replace("0.6", "0.2")} 100%)`,
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
          <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary/70 z-20" />
          <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary/70 z-20" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary/70 z-20" />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary/70 z-20" />

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
                  className="w-full h-full"
                  style={{
                    background: `linear-gradient(180deg,
                      transparent 0%,
                      ${aiColors.glow.replace("0.6", "0.03")} 45%,
                      ${aiColors.glow.replace("0.6", "0.12")} 50%,
                      ${aiColors.glow.replace("0.6", "0.03")} 55%,
                      transparent 100%
                    )`,
                    backgroundSize: "100% 200%",
                    animation: "minichess-scan 2s ease-in-out infinite",
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
                gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
                gap: `${gap}px`,
              }}
            >
              {rows.map((row, r) =>
                row.map((pieceChar, c) => {
                  // Player uses lowercase (n, p, k), AI uses uppercase (N, P, K)
                  const isPlayerPiece =
                    pieceChar !== "." &&
                    pieceChar === pieceChar.toLowerCase() &&
                    pieceChar !== pieceChar.toUpperCase();
                  const isAiPiece =
                    pieceChar !== "." &&
                    pieceChar === pieceChar.toUpperCase() &&
                    pieceChar !== pieceChar.toLowerCase();
                  const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
                  const isValidMoveTarget = validMoves.some((m) => m.r === r && m.c === c);

                  // Highlight logic
                  const isLastMoveSource = lastMove?.from.r === r && lastMove?.from.c === c;
                  const isLastMoveDest = lastMove?.to.r === r && lastMove?.to.c === c;
                  const isLastMove = isLastMoveSource || isLastMoveDest;

                  // Checkerboard pattern (subtle)
                  const isDarkSquare = (r + c) % 2 === 1;

                  const isInteractionDisabled =
                    isAITurnOrProcessing && !isSelected && !isValidMoveTarget;

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      className={cn(
                        "relative flex items-center justify-center transition-all duration-200",
                        isInteractionDisabled
                          ? "cursor-default"
                          : "cursor-pointer minichess-cell-interactive",
                        hasError && "brightness-75"
                      )}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        background: isSelected
                          ? "linear-gradient(135deg, rgba(0,243,255,0.25) 0%, rgba(0,180,200,0.15) 100%)"
                          : isValidMoveTarget
                            ? "linear-gradient(135deg, rgba(0,243,255,0.12) 0%, rgba(0,200,220,0.06) 100%)"
                            : isDarkSquare
                              ? "linear-gradient(135deg, rgba(30,35,40,0.7) 0%, rgba(20,25,30,0.85) 100%)"
                              : "linear-gradient(135deg, rgba(45,50,55,0.5) 0%, rgba(35,40,45,0.65) 100%)",
                        boxShadow: isSelected
                          ? "inset 0 0 20px rgba(0,243,255,0.3), 0 0 15px rgba(0,243,255,0.2)"
                          : isValidMoveTarget
                            ? "inset 0 0 12px rgba(0,243,255,0.15), 0 0 8px rgba(0,243,255,0.1)"
                            : "inset 0 0 8px rgba(0,0,0,0.4)",
                        border: isSelected
                          ? "2px solid rgba(0,243,255,0.8)"
                          : isValidMoveTarget
                            ? "1px solid rgba(0,243,255,0.5)"
                            : "1px solid rgba(60,70,80,0.3)",
                        pointerEvents: isInteractionDisabled ? "none" : "auto",
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (
                          !isProcessing &&
                          (turn === "player" ||
                            turn === undefined ||
                            isSelected ||
                            isValidMoveTarget)
                        ) {
                          onSquareClick(r, c);
                        }
                      }}
                      onMouseEnter={() => {
                        if (onSquareHover && !isProcessing && (turn === "player" || turn === undefined)) {
                          onSquareHover(r, c);
                        }
                      }}
                      whileHover={!isInteractionDisabled ? { scale: 1.05 } : {}}
                      animate={{
                        scale: isSelected ? 1.02 : 1,
                      }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      {/* Chess Piece */}
                      {pieceChar !== "." && (
                        <motion.div
                          key={`piece-${pieceChar}-${r}-${c}`}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                            mass: 1,
                          }}
                          className={cn(
                            "z-10 flex items-center justify-center select-none",
                            isPlayerPiece
                              ? "text-primary [filter:drop-shadow(0_0_4px_rgba(0,243,255,0.7))]"
                              : cn(aiColors.text, aiColors.filter)
                          )}
                          style={{ width: "70%", height: "70%" }}
                        >
                          <ChessPiece type={pieceChar} />
                        </motion.div>
                      )}

                      {/* Selection ring */}
                      {isSelected && !isTutorialMode && (
                        <motion.div
                          layoutId="minichess-selection"
                          className="absolute inset-0 z-30 pointer-events-none"
                          style={{
                            border: "2px solid rgba(0,243,255,0.9)",
                            boxShadow: "0 0 15px rgba(0,243,255,0.5), inset 0 0 10px rgba(0,243,255,0.2)",
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}

                      {/* Valid Move Indicator */}
                      {isValidMoveTarget && !isSelected && (
                        <motion.div
                          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <motion.div
                            className="rounded-full bg-primary"
                            style={{
                              width: `${cellSize * 0.18}px`,
                              height: `${cellSize * 0.18}px`,
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

                      {/* Last move indicator (center dot) */}
                      {isLastMove && !isSelected && (
                        <motion.div
                          className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${cellSize * 0.12}px`,
                              height: `${cellSize * 0.12}px`,
                              background: "rgba(255, 170, 0, 0.8)",
                              boxShadow: "0 0 6px rgba(255, 170, 0, 0.5)",
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
