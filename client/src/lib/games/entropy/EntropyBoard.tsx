/**
 * ENTROPY (Hex) Board Component
 *
 * Game-specific board component for ENTROPY (Hex).
 * Handles rendering of the 11x11 hexagonal grid.
 */

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BaseGameBoardProps } from "../GameBoardInterface";
import { parseBoardState } from "./boardUtils";
import type { CellState } from "./types";

/**
 * ENTROPY Board Component
 * 
 * Renders an 11x11 hexagonal grid board.
 * Uses CSS transforms to create hexagonal cells.
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
}: BaseGameBoardProps) {
  // Parse board state
  const boardState = parseBoardState(boardString);
  const { boardSize, cells } = boardState;

  // Track viewport width for responsive cell sizing
  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Default fallback for SSR
  });

  // Update viewport width on resize with debouncing
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setViewportWidth(window.innerWidth);
      }, 150); // 150ms debounce for smooth performance
    };

    window.addEventListener('resize', handleResize);

    // Initial measurement
    setViewportWidth(window.innerWidth);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Size configurations with responsive cell sizing
  const sizeConfig = useMemo(() => {
    // Define max cell sizes for each size variant
    const maxCellSizes = {
      small: 20,
      medium: 24,
      large: 28,
    };

    const paddingValues = {
      small: { className: "p-2", pixels: 8 },    // 0.5rem = 8px
      medium: { className: "p-3", pixels: 12 },  // 0.75rem = 12px
      large: { className: "p-4", pixels: 16 },   // 1rem = 16px
    };

    const maxCellSize = maxCellSizes[size];
    const paddingConfig = paddingValues[size];

    // Calculate available width for the board
    // Account for: padding (both sides) + border (2px each side) + some margin for safety
    const reservedSpace = (paddingConfig.pixels * 2) + 4 + 32; // 32px safety margin
    const availableWidth = Math.max(320, viewportWidth - reservedSpace); // Minimum 320px

    // Calculate required width ratio for hexagonal grid
    // Width = cols * cellSize * √3 + cellSize (extra space for offset)
    const widthRatio = boardSize.cols * Math.sqrt(3) + 1;

    // Calculate cell size that fits within viewport
    const viewportBasedCellSize = availableWidth / widthRatio;

    // Use the smaller of max size or viewport-based size
    // Also enforce minimum cell size of 12px for usability
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

  // Get cell state at position
  const getCellState = (r: number, c: number): CellState => {
    return cells[r]?.[c] || 'EMPTY';
  };

  // Calculate hexagonal cell position
  const getHexPosition = (r: number, c: number) => {
    const cellSize = config.cellSize;
    const hexWidth = cellSize * Math.sqrt(3);
    const hexHeight = cellSize * 2;
    
    // Offset coordinates (odd-r layout)
    const x = c * hexWidth + (r % 2 === 1 ? hexWidth / 2 : 0);
    const y = r * hexHeight * 0.75;
    
    return { x, y };
  };

  // Determine if interaction should be disabled globally (for AI turn or processing)
  // Memoize to prevent unnecessary recalculations during polling re-renders
  const isAITurnOrProcessing = useMemo(() => {
    return (isProcessing || turn === "ai") && turn !== undefined;
  }, [isProcessing, turn]);

  return (
    <motion.div
      className={cn(
        "relative bg-border border-2 border-border shadow-[0_0_30px_rgba(0,243,255,0.1)] w-fit mx-auto",
        config.padding,
        // Apply cursor style at container level to prevent flickering during re-renders
        isAITurnOrProcessing ? "cursor-default" : "cursor-pointer"
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
      {/* Hexagonal Grid Container */}
      <div
        className="relative"
        style={{
          width: `${boardSize.cols * config.cellSize * Math.sqrt(3) + config.cellSize}px`,
          height: `${boardSize.rows * config.cellSize * 1.5 + config.cellSize}px`,
        }}
      >
        {/* Transparent overlay to block all interactions during AI turn */}
        {isAITurnOrProcessing && (
          <div
            className="absolute inset-0 z-50 cursor-default"
            style={{
              pointerEvents: "auto",
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        )}
        {Array.from({ length: boardSize.rows }).map((_, r) =>
          Array.from({ length: boardSize.cols }).map((_, c) => {
            const cellState = getCellState(r, c);
            const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
            const isValidMoveTarget = validMoves.some((m) => m.r === r && m.c === c);
            
            // Highlight logic
            const isLastMoveDest =
              lastMove?.to.r === r && lastMove?.to.c === c;
            const isLastMove = isLastMoveDest;

            const { x, y } = getHexPosition(r, c);
            const cellSize = config.cellSize;

            // Determine if interaction should be disabled for this specific cell
            // Only disable if it's not selected and not a valid move target
            const isInteractionDisabled = isAITurnOrProcessing && 
                                         !isSelected && 
                                         !isValidMoveTarget;

            return (
              <motion.div
                key={`${r}-${c}`}
                className="absolute"
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${cellSize * Math.sqrt(3)}px`,
                  height: `${cellSize * 2}px`,
                  // Disable pointer events when interaction is disabled to prevent hover events
                  // This prevents hover events from triggering during AI turn
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
                animate={{
                  scale: isSelected ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Hexagonal cell */}
                <div
                  className={cn(
                    "relative w-full h-full flex items-center justify-center",
                    // Base styles
                    cellState === 'EMPTY' && "bg-muted/30",
                    // Only apply hover effect when interaction is enabled
                    cellState === 'EMPTY' && !isInteractionDisabled && "hover:bg-muted/50",
                    cellState === 'PLAYER' && "bg-primary/20 border-2 border-primary",
                    cellState === 'AI' && `bg-destructive/20 border-2 border-destructive ${getAiPieceColor()}`,
                    // Selection highlight
                    isSelected && "ring-2 ring-primary ring-offset-2",
                    // Valid move highlight
                    isValidMoveTarget && cellState === 'EMPTY' && "bg-primary/10 ring-1 ring-primary/50",
                    // Last move highlight
                    isLastMove && "ring-2 ring-secondary",
                    // Error state
                    hasError && "bg-destructive/10"
                  )}
                  style={{
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  }}
                >
                  {/* Cell content */}
                  {cellState === 'PLAYER' && (
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  )}
                  {cellState === 'AI' && (
                    <div className={cn("w-3 h-3 rounded-full", getAiPieceColor())} />
                  )}
                  {cellState === 'EMPTY' && isValidMoveTarget && (
                    <div className="w-2 h-2 rounded-full bg-primary/50" />
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
