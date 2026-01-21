/**
 * ENTROPY (Hex) Board Component
 *
 * Game-specific board component for ENTROPY (Hex).
 * Handles rendering of the 11x11 hexagonal grid with polished UI.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BaseGameBoardProps } from "../GameBoardInterface";
import { parseBoardState } from "./boardUtils";
import { useEntropyWorkerCleanup } from "./useEntropyWorkerCleanup";
import type { CellState } from "./types";

/**
 * ENTROPY Board Component
 *
 * Renders an 11x11 hexagonal grid board with premium visual effects.
 * Features edge indicators showing connection goals for each player.
 */
export function EntropyBoard({
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
  isPreviewMode = false,
  highlightSquares = [],
}: BaseGameBoardProps) {
  // Ensure background workers are cleaned up when component unmounts
  useEntropyWorkerCleanup();

  // Parse board state
  const boardState = parseBoardState(boardString);
  const { boardSize, cells } = boardState;

  // Track previously placed pieces for animation
  const prevCellsRef = useRef<CellState[][] | null>(null);
  const [newlyPlaced, setNewlyPlaced] = useState<{ r: number, c: number } | null>(null);

  // Track viewport width for responsive cell sizing
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Default fallback for SSR
  });

  // Detect newly placed pieces for animation
  useEffect(() => {
    if (prevCellsRef.current) {
      for (let r = 0; r < boardSize.rows; r++) {
        for (let c = 0; c < boardSize.cols; c++) {
          const prev = prevCellsRef.current[r]?.[c] || 'EMPTY';
          const curr = cells[r]?.[c] || 'EMPTY';
          if (prev === 'EMPTY' && curr !== 'EMPTY') {
            setNewlyPlaced({ r, c });
            setTimeout(() => setNewlyPlaced(null), 600);
            break;
          }
        }
      }
    }
    prevCellsRef.current = cells.map(row => [...row]);
  }, [cells, boardSize.rows, boardSize.cols]);

  // Update viewport width on resize with debouncing
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setViewportWidth(window.innerWidth);
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    setViewportWidth(window.innerWidth);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Size configurations with responsive cell sizing
  const sizeConfig = useMemo(() => {
    const maxCellSizes = {
      small: isPreviewMode ? 16 : (isTutorialMode ? 13 : 20),
      medium: 24,
      large: 28,
    };

    const paddingValues = {
      small: { className: "p-3", pixels: 12 },
      medium: { className: "p-4", pixels: 16 },
      large: { className: "p-5", pixels: 20 },
    };

    const maxCellSize = maxCellSizes[size];
    const paddingConfig = paddingValues[size];
    const reservedSpace = (paddingConfig.pixels * 2) + 4 + 48;
    const availableWidth = Math.max(320, viewportWidth - reservedSpace);
    const widthRatio = boardSize.cols * Math.sqrt(3) + 1;
    const viewportBasedCellSize = availableWidth / widthRatio;
    const responsiveCellSize = Math.max(12, Math.min(maxCellSize, viewportBasedCellSize));

    return {
      small: {
        cellSize: size === 'small' ? responsiveCellSize : maxCellSizes.small,
        padding: paddingConfig.className,
      },
      medium: {
        cellSize: size === 'medium' ? responsiveCellSize : maxCellSizes.medium,
        padding: paddingConfig.className,
      },
      large: {
        cellSize: size === 'large' ? responsiveCellSize : maxCellSizes.large,
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
          bg: "rgba(96, 165, 250, 0.25)",
          border: "rgba(96, 165, 250, 0.8)",
          glow: "rgba(96, 165, 250, 0.6)",
          solid: "#60a5fa",
        };
      case "NEXUS-5":
        return {
          bg: "rgba(255, 170, 0, 0.25)",
          border: "rgba(255, 170, 0, 0.8)",
          glow: "rgba(255, 170, 0, 0.6)",
          solid: "#ffaa00",
        };
      case "NEXUS-7":
      default:
        return {
          bg: "rgba(255, 0, 60, 0.25)",
          border: "rgba(255, 0, 60, 0.8)",
          glow: "rgba(255, 0, 60, 0.6)",
          solid: "#ff003c",
        };
    }
  };

  const aiColors = getAiColors();

  // Get cell state at position
  const getCellState = (r: number, c: number): CellState => {
    return cells[r]?.[c] || 'EMPTY';
  };

  // Calculate hexagonal cell position
  const getHexPosition = (r: number, c: number) => {
    const cellSize = config.cellSize;
    const hexWidth = cellSize * Math.sqrt(3);
    const hexHeight = cellSize * 2;
    const x = c * hexWidth + (r % 2 === 1 ? hexWidth / 2 : 0);
    const y = r * hexHeight * 0.75;
    return { x, y };
  };

  // Check if cell is on edge (for goal indicators)
  const isTopEdge = (r: number) => r === 0;
  const isBottomEdge = (r: number) => r === boardSize.rows - 1;
  const isLeftEdge = (c: number, r: number) => c === 0;
  const isRightEdge = (c: number, r: number) => c === boardSize.cols - 1;

  // Determine if interaction should be disabled globally
  const isAITurnOrProcessing = useMemo(() => {
    return (isProcessing || turn === "ai") && turn !== undefined;
  }, [isProcessing, turn]);

  // Calculate board dimensions
  const boardWidth = boardSize.cols * config.cellSize * Math.sqrt(3) + config.cellSize;
  const boardHeight = boardSize.rows * config.cellSize * 1.5 + config.cellSize;

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
          background: "linear-gradient(135deg, rgba(0,243,255,0.1) 0%, rgba(0,0,0,0.8) 50%, rgba(255,170,0,0.1) 100%)",
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
          {/* Edge indicators - Top (AI goal) */}
          <div
            className="absolute left-0 right-0 h-1 z-10"
            style={{
              top: "-2px",
              background: `linear-gradient(90deg, transparent 5%, ${aiColors.border} 20%, ${aiColors.solid} 50%, ${aiColors.border} 80%, transparent 95%)`,
              boxShadow: `0 0 15px ${aiColors.glow}, 0 0 30px ${aiColors.glow}`,
            }}
          />

          {/* Edge indicators - Bottom (AI goal) */}
          <div
            className="absolute left-0 right-0 h-1 z-10"
            style={{
              bottom: "-2px",
              background: `linear-gradient(90deg, transparent 5%, ${aiColors.border} 20%, ${aiColors.solid} 50%, ${aiColors.border} 80%, transparent 95%)`,
              boxShadow: `0 0 15px ${aiColors.glow}, 0 0 30px ${aiColors.glow}`,
            }}
          />

          {/* Edge indicators - Left (Player goal) */}
          <div
            className="absolute top-0 bottom-0 w-1 z-10"
            style={{
              left: "-2px",
              background: "linear-gradient(180deg, transparent 5%, rgba(0,243,255,0.8) 20%, rgba(0,243,255,1) 50%, rgba(0,243,255,0.8) 80%, transparent 95%)",
              boxShadow: "0 0 15px rgba(0,243,255,0.6), 0 0 30px rgba(0,243,255,0.3)",
            }}
          />

          {/* Edge indicators - Right (Player goal) */}
          <div
            className="absolute top-0 bottom-0 w-1 z-10"
            style={{
              right: "-2px",
              background: "linear-gradient(180deg, transparent 5%, rgba(0,243,255,0.8) 20%, rgba(0,243,255,1) 50%, rgba(0,243,255,0.8) 80%, transparent 95%)",
              boxShadow: "0 0 15px rgba(0,243,255,0.6), 0 0 30px rgba(0,243,255,0.3)",
            }}
          />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary/50 z-20" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary/50 z-20" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary/50 z-20" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary/50 z-20" />

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
                  className="w-full h-full entropy-ai-scan"
                  style={{
                    background: `linear-gradient(180deg,
                      transparent 0%,
                      ${aiColors.glow.replace('0.6', '0.03')} 45%,
                      ${aiColors.glow.replace('0.6', '0.08')} 50%,
                      ${aiColors.glow.replace('0.6', '0.03')} 55%,
                      transparent 100%
                    )`,
                    backgroundSize: "100% 200%",
                    animation: "entropy-scan 2s ease-in-out infinite",
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hexagonal Grid Container */}
          <div
            className="relative p-4"
            style={{
              width: `${boardWidth + 32}px`,
              height: `${boardHeight + 32}px`,
            }}
          >
            {/* Grid background pattern */}
            <div
              className="absolute inset-4 opacity-30"
              style={{
                backgroundImage: `
                  radial-gradient(circle at center, rgba(0,243,255,0.1) 0%, transparent 70%)
                `,
              }}
            />

            {/* Interaction blocker during AI turn */}
            {isAITurnOrProcessing && (
              <div
                className="absolute inset-0 z-50 cursor-default"
                style={{ pointerEvents: "auto" }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              />
            )}

            {/* Hex cells */}
            {Array.from({ length: boardSize.rows }).map((_, r) =>
              Array.from({ length: boardSize.cols }).map((_, c) => {
                const cellState = getCellState(r, c);
                const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
                const isValidMoveTarget = validMoves.some((m) => m.r === r && m.c === c);
                const isLastMoveDest = lastMove?.to.r === r && lastMove?.to.c === c;
                const isNewlyPlaced = newlyPlaced?.r === r && newlyPlaced?.c === c;
                const isHighlighted = highlightSquares.some(sq => sq.r === r && sq.c === c);
                const { x, y } = getHexPosition(r, c);
                const cellSize = config.cellSize;
                const isInteractionDisabled = isAITurnOrProcessing && !isSelected && !isValidMoveTarget;

                // Edge cell styling
                const onTopEdge = isTopEdge(r);
                const onBottomEdge = isBottomEdge(r);
                const onLeftEdge = isLeftEdge(c, r);
                const onRightEdge = isRightEdge(c, r);
                const isPlayerEdge = onLeftEdge || onRightEdge;
                const isAiEdge = onTopEdge || onBottomEdge;

                return (
                  <motion.div
                    key={`${r}-${c}`}
                    className="absolute"
                    style={{
                      left: `${x + 16}px`,
                      top: `${y + 16}px`,
                      width: `${cellSize * Math.sqrt(3)}px`,
                      height: `${cellSize * 2}px`,
                      pointerEvents: isInteractionDisabled ? "none" : "auto",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isProcessing && (turn === "player" || turn === undefined || isValidMoveTarget)) {
                        onSquareClick(r, c);
                      }
                    }}
                    onMouseEnter={() => {
                      if (onSquareHover && !isProcessing && (turn === "player" || turn === undefined)) {
                        onSquareHover(r, c);
                      }
                    }}
                    whileHover={!isInteractionDisabled && cellState === 'EMPTY' ? { scale: 1.08 } : {}}
                    animate={{
                      scale: isSelected ? 1.12 : 1,
                    }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    {/* Hexagonal cell with enhanced styling */}
                    <div
                      className={cn(
                        "relative w-full h-full flex items-center justify-center transition-all duration-200",
                        cellState === 'EMPTY' && "entropy-cell-empty",
                        cellState === 'EMPTY' && !isInteractionDisabled && "hover:brightness-150",
                        hasError && "brightness-75"
                      )}
                      style={{
                        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                        background: cellState === 'EMPTY'
                          ? isHighlighted
                            ? "linear-gradient(135deg, rgba(0,243,255,0.2) 0%, rgba(0,243,255,0.1) 100%)"
                            : isValidMoveTarget
                              ? "linear-gradient(135deg, rgba(0,243,255,0.15) 0%, rgba(0,243,255,0.05) 100%)"
                              : "linear-gradient(135deg, rgba(40,45,50,0.6) 0%, rgba(20,25,30,0.8) 100%)"
                          : cellState === 'PLAYER'
                            ? "linear-gradient(135deg, rgba(0,243,255,0.3) 0%, rgba(0,150,180,0.2) 100%)"
                            : `linear-gradient(135deg, ${aiColors.bg} 0%, ${aiColors.bg.replace('0.25', '0.15')} 100%)`,
                        boxShadow: cellState === 'PLAYER'
                          ? "inset 0 0 15px rgba(0,243,255,0.3), 0 0 10px rgba(0,243,255,0.2)"
                          : cellState === 'AI'
                            ? `inset 0 0 15px ${aiColors.glow.replace('0.6', '0.3')}, 0 0 10px ${aiColors.glow.replace('0.6', '0.2')}`
                            : isValidMoveTarget
                              ? "inset 0 0 10px rgba(0,243,255,0.2)"
                              : "inset 0 0 8px rgba(0,0,0,0.5)",
                        border: isHighlighted
                          ? "2px solid #00f3ff"
                          : cellState === 'PLAYER'
                            ? "1px solid rgba(0,243,255,0.6)"
                            : cellState === 'AI'
                              ? `1px solid ${aiColors.border}`
                              : isValidMoveTarget
                                ? "1px solid rgba(0,243,255,0.4)"
                                : isLastMoveDest
                                  ? "1px solid rgba(255,170,0,0.6)"
                                  : "1px solid rgba(60,70,80,0.4)",
                        zIndex: isHighlighted ? 10 : 1,
                      }}
                    >
                      {/* Tutorial Highlight Overlay - Wave Ripple Effect */}
                      {isHighlighted && (
                        <motion.div
                          className="absolute inset-0 z-20 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{
                            opacity: [0, 0.7, 0],
                            scale: [0.95, 1.05, 0.95],
                          }}
                          transition={{
                            duration: 2.0,
                            repeat: Infinity,
                            delay: (r + c) * 0.12,
                            ease: "easeInOut"
                          }}
                          style={{
                            background: "rgba(0, 243, 255, 0.15)",
                            border: "2px solid rgba(0, 243, 255, 0.6)",
                            boxShadow: "0 0 15px rgba(0, 243, 255, 0.4), inset 0 0 10px rgba(0, 243, 255, 0.2)",
                            clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                          }}
                        />
                      )}

                      {/* Player piece */}
                      {cellState === 'PLAYER' && (
                        <motion.div
                          className="relative"
                          initial={isNewlyPlaced ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${cellSize * 0.45}px`,
                              height: `${cellSize * 0.45}px`,
                              background: "radial-gradient(circle at 30% 30%, #80ffff 0%, #00f3ff 40%, #00a0b0 100%)",
                              boxShadow: "0 0 12px rgba(0,243,255,0.8), 0 0 25px rgba(0,243,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)",
                            }}
                          />
                          {isLastMoveDest && (
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                border: "2px solid rgba(255,170,0,0.8)",
                                boxShadow: "0 0 10px rgba(255,170,0,0.5)",
                              }}
                            />
                          )}
                        </motion.div>
                      )}

                      {/* AI piece */}
                      {cellState === 'AI' && (
                        <motion.div
                          className="relative"
                          initial={isNewlyPlaced ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${cellSize * 0.45}px`,
                              height: `${cellSize * 0.45}px`,
                              background: `radial-gradient(circle at 30% 30%, ${aiColors.solid}cc 0%, ${aiColors.solid} 40%, ${aiColors.solid}80 100%)`,
                              boxShadow: `0 0 12px ${aiColors.glow}, 0 0 25px ${aiColors.glow.replace('0.6', '0.4')}, inset 0 -2px 4px rgba(0,0,0,0.3)`,
                            }}
                          />
                          {isLastMoveDest && (
                            <div
                              className="absolute inset-0 rounded-full"
                              style={{
                                border: "2px solid rgba(255,170,0,0.8)",
                                boxShadow: "0 0 10px rgba(255,170,0,0.5)",
                              }}
                            />
                          )}
                        </motion.div>
                      )}

                      {/* Valid move indicator */}
                      {cellState === 'EMPTY' && isValidMoveTarget && (
                        <div
                          className="rounded-full"
                          style={{
                            width: `${cellSize * 0.25}px`,
                            height: `${cellSize * 0.25}px`,
                            background: "radial-gradient(circle, rgba(0,243,255,0.8) 0%, rgba(0,243,255,0.3) 100%)",
                            boxShadow: "0 0 8px rgba(0,243,255,0.6)",
                          }}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Goal labels */}
      {!isTutorialMode && (
        <div className="flex justify-between mt-2 px-4 text-[10px] font-mono uppercase tracking-wider opacity-60">
          <span className="text-primary">Your Goal: Left ↔ Right</span>
          <span style={{ color: aiColors.solid }}>AI Goal: Top ↔ Bottom</span>
        </div>
      )}
    </motion.div>
  );
}
