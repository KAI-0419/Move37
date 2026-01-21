/**
 * Game Mode Carousel Component
 * 
 * Displays available game modes in a carousel with drag/swipe support
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, PanInfo } from "framer-motion";
import { Lock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useResponsive, getCardsToShow } from "@/hooks/use-responsive";
import { cn } from "@/lib/utils";
import { AVAILABLE_GAMES } from "@/lib/gameTypes";
import type { GameType } from "@shared/schema";

export interface GameModeCarouselProps {
  selectedGameType: GameType;
  onGameTypeChange: (gameType: GameType) => void;
  t: (key: string) => string;
  disabled?: boolean;
}

export function GameModeCarousel({
  selectedGameType,
  onGameTypeChange,
  t,
  disabled = false,
}: GameModeCarouselProps) {
  const { toast } = useToast();
  const { width } = useResponsive();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate how many cards to show based on screen width (responsive)
  // Mobile (< 640px): 1 card, Small Tablet (640-767px): 1.5 cards, Tablet (768-1023px): 2 cards, Desktop (>= 1024px): 3 cards
  const cardsToShow = useMemo(() => getCardsToShow(width), [width]);

  // Calculate card dimensions based on responsive cardsToShow
  // For fractional cards (1.5), we show 1 full card + peek of next
  const effectiveCardsToShow = Math.ceil(cardsToShow);

  // Width of each card relative to the visible container (accounts for padding)
  // Each card should take up (100% / cardsToShow) of the visible area
  const cardWidthInParent = 100 / cardsToShow;

  // Total width of the moving container to hold all cards
  // We need enough space for all games, each taking up cardWidthInParent
  const totalWidth = AVAILABLE_GAMES.length * cardWidthInParent;

  // Width of each card relative to the moving container (for animation)
  const itemWidth = 100 / AVAILABLE_GAMES.length;

  // Maximum index we can scroll to
  const maxIndex = Math.max(0, AVAILABLE_GAMES.length - cardsToShow);

  // Calculate the actual percentage offset for smooth animation
  // Offset is calculated as a percentage of the moving container's own width
  const getOffset = (index: number) => {
    return -index * itemWidth;
  };

  // Snap to card positions (no auto-select to prevent unwanted game changes)
  const snapToIndex = (index: number, shouldAutoSelect: boolean = false) => {
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    setCurrentIndex(clampedIndex);

    // Only auto-select when explicitly requested (e.g., user interaction)
    if (shouldAutoSelect) {
      const firstVisibleGameIndex = Math.round(clampedIndex);
      const game = AVAILABLE_GAMES[firstVisibleGameIndex];
      if (game && game.available && game.id !== selectedGameType) {
        onGameTypeChange(game.id);
      }
    }
  };

  // Get the first visible game (for Enter key selection)
  const getFirstVisibleGameIndex = () => {
    return Math.round(currentIndex);
  };

  // Reset currentIndex when cardsToShow changes, ensuring selected game stays visible
  useEffect(() => {
    // Find the selected game's index
    const selectedGameIndex = AVAILABLE_GAMES.findIndex(g => g.id === selectedGameType);

    if (selectedGameIndex !== -1) {
      // Calculate the index that shows the selected game
      // If selected game index is within valid range, use it; otherwise clamp to maxIndex
      const targetIndex = Math.max(0, Math.min(selectedGameIndex, maxIndex));

      // Only update if needed to prevent unnecessary re-renders
      if (currentIndex > maxIndex || currentIndex !== targetIndex) {
        setCurrentIndex(targetIndex);
      }
    } else if (currentIndex > maxIndex) {
      // Fallback: just clamp to maxIndex if selected game not found
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [maxIndex, selectedGameType, currentIndex]);

  // Sync carousel with selected game mode - ensure selected game is visible
  useEffect(() => {
    const gameIndex = AVAILABLE_GAMES.findIndex(g => g.id === selectedGameType);
    if (gameIndex === -1) return; // Game not found

    // Calculate the target index to show the selected game
    // The selected game should be the first visible card if possible
    const targetIndex = Math.max(0, Math.min(gameIndex, maxIndex));

    // Check if the selected game is currently visible in the viewport
    const firstVisibleIndex = Math.floor(currentIndex);
    const lastVisibleIndex = Math.min(
      Math.ceil(currentIndex + cardsToShow) - 1,
      AVAILABLE_GAMES.length - 1
    );
    const isSelectedGameVisible = gameIndex >= firstVisibleIndex && gameIndex <= lastVisibleIndex;

    // Only update if the selected game is not visible
    if (!isSelectedGameVisible) {
      setCurrentIndex(targetIndex);
    }
  }, [selectedGameType, maxIndex, currentIndex, cardsToShow]);

  // Keyboard navigation
  useEffect(() => {
    if (disabled) return; // Disable keyboard navigation when tutorial is open

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex > 0) {
            snapToIndex(currentIndex - 1, true);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex < maxIndex) {
            snapToIndex(currentIndex + 1, true);
          }
          break;
        case "Enter":
          e.preventDefault();
          const firstVisibleIndex = getFirstVisibleGameIndex();
          const game = AVAILABLE_GAMES[firstVisibleIndex];
          if (game && game.available) {
            onGameTypeChange(game.id);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, maxIndex, onGameTypeChange, disabled]);

  // Handle drag end
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50; // Minimum drag distance to trigger slide
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // Use velocity to determine direction if drag distance is ambiguous
    if (Math.abs(velocity) > 500) {
      // High velocity - snap in direction of velocity
      if (velocity > 0 && currentIndex > 0) {
        snapToIndex(currentIndex - 1, true);
      } else if (velocity < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1, true);
      } else {
        snapToIndex(currentIndex, false);
      }
    } else if (Math.abs(offset) > threshold) {
      // Significant drag - snap in direction of drag
      if (offset > 0 && currentIndex > 0) {
        snapToIndex(currentIndex - 1, true);
      } else if (offset < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1, true);
      } else {
        snapToIndex(currentIndex, false); // Snap back
      }
    } else {
      snapToIndex(currentIndex, false); // Snap back if not enough drag
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    if (disabled) return;
    if (currentIndex > 0) {
      snapToIndex(currentIndex - 1, true);
    }
  };

  const handleNext = () => {
    if (disabled) return;
    if (currentIndex < maxIndex) {
      snapToIndex(currentIndex + 1, true);
    }
  };

  const canScrollPrev = currentIndex > 0;
  const canScrollNext = currentIndex < maxIndex;

  return (
    <div className="relative">
      {/* Carousel Container */}
      <div ref={containerRef} className="overflow-hidden relative">
        <motion.div
          className="flex"
          style={{ width: `${totalWidth}%` }}
          drag={disabled ? false : "x"}
          dragConstraints={containerRef}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={{ x: getOffset(currentIndex) + "%" }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 40,
            mass: 0.8,
          }}
        >
          {AVAILABLE_GAMES.map((game, gameIndex) => {
            const isSelected = selectedGameType === game.id;
            const isAvailable = game.available;
            const isFirstVisible = gameIndex === currentIndex;

            return (
              <motion.div
                key={game.id}
                className="flex-shrink-0 px-1 sm:px-2"
                style={{ width: `${itemWidth}%` }}
              >
                <motion.button
                  onClick={() => {
                    if (disabled) return;
                    if (!isAvailable) {
                      if (game.comingSoon) {
                        toast({
                          title: t("lobby.toast.comingSoon"),
                          description: t("lobby.toast.comingSoonDescription"),
                          variant: "default",
                        });
                      }
                      return;
                    }
                    onGameTypeChange(game.id);
                  }}
                  disabled={disabled}
                  whileHover={!isAvailable && !disabled ? { scale: 1.02 } : {}}
                  whileTap={isAvailable && !disabled ? { scale: 0.98 } : {}}
                  className={cn(
                    "w-full p-3 sm:p-4 border transition-all duration-300 text-left relative group rounded-lg h-full",
                    "backdrop-blur-sm touch-manipulation",
                    !isAvailable
                      ? "border-white/30 bg-white/10 cursor-pointer hover:border-primary/40 hover:bg-primary/10"
                      : isSelected
                        ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                        : isFirstVisible && isAvailable
                          ? "border-primary/60 bg-primary/5 hover:border-primary/70 hover:bg-primary/15 shadow-[0_0_10px_rgba(0,243,255,0.15)]"
                          : "border-white/10 bg-white/5 hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                  )}
                >
                  {!isAvailable && game.comingSoon && (
                    <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex items-center gap-1 sm:gap-1.5 bg-black/60 border border-white/20 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 z-10 backdrop-blur-sm">
                      <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/70 flex-shrink-0" />
                      <span className="text-[7px] sm:text-[8px] text-primary/70 font-mono uppercase tracking-wider">
                        {t("lobby.game.comingSoon")}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "text-2xl sm:text-2.5xl lg:text-3xl mb-1.5 sm:mb-2",
                      isAvailable ? "opacity-100" : "opacity-70"
                    )}
                  >
                    {game.icon}
                  </div>
                  <h4
                    className={cn(
                      "text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1 line-clamp-1",
                      isAvailable ? "text-foreground" : "text-foreground/80"
                    )}
                  >
                    {t(game.nameKey)}
                  </h4>
                  <p
                    className={cn(
                      "text-[9px] sm:text-[10px] line-clamp-2",
                      isAvailable ? "text-muted-foreground" : "text-muted-foreground/70"
                    )}
                  >
                    {t(game.descriptionKey)}
                  </p>
                  {isSelected && isAvailable && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2"
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Navigation Controls: Dots Indicator with Navigation Buttons */}
      {maxIndex > 0 && (
        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
          {/* Previous Button - Fixed width placeholder to prevent layout shift */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
            {canScrollPrev && !disabled && (
              <motion.button
                onClick={handlePrev}
                className="w-full h-full p-0 flex items-center justify-center bg-black/70 sm:bg-black/60 border border-white/20 rounded-full backdrop-blur-sm hover:bg-black/80 hover:border-primary/50 transition-all touch-manipulation"
                aria-label="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </motion.button>
            )}
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: Math.ceil(maxIndex) + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!disabled) {
                    snapToIndex(i, true);
                  }
                }}
                disabled={disabled}
                className={cn(
                  "h-1.5 rounded-full transition-all touch-manipulation",
                  Math.round(currentIndex) === i
                    ? "bg-primary w-5 sm:w-6"
                    : "bg-white/20 w-1.5 hover:bg-white/40",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Next Button - Fixed width placeholder to prevent layout shift */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
            {canScrollNext && !disabled && (
              <motion.button
                onClick={handleNext}
                className="w-full h-full p-0 flex items-center justify-center bg-black/70 sm:bg-black/60 border border-white/20 rounded-full backdrop-blur-sm hover:bg-black/80 hover:border-primary/50 transition-all touch-manipulation"
                aria-label="Next"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </motion.button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
