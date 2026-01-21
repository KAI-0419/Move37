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

  // Snap to card positions and auto-select the first visible game
  const snapToIndex = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    setCurrentIndex(clampedIndex);

    // Auto-select the first visible game for better UX
    const firstVisibleGameIndex = Math.round(clampedIndex);
    const game = AVAILABLE_GAMES[firstVisibleGameIndex];
    if (game && game.available && game.id !== selectedGameType) {
      onGameTypeChange(game.id);
    }
  };

  // Get the first visible game (for Enter key selection)
  const getFirstVisibleGameIndex = () => {
    return Math.round(currentIndex);
  };

  // Reset currentIndex when cardsToShow changes to prevent out-of-bounds
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [maxIndex, currentIndex]);

  // Sync carousel with selected game mode on mount and when it changes
  useEffect(() => {
    const gameIndex = AVAILABLE_GAMES.findIndex(g => g.id === selectedGameType);
    if (gameIndex !== -1 && gameIndex !== currentIndex) {
      // If the selected game is out of view (considering cards shown), snap to it
      // We want the selected game to be visible. 
      // Simple strategy: snap the selected game to the start (leftmost) if possible, 
      // or at least ensure it's in the visible range.
      // Given the current implementation of snapToIndex simply sets currentIndex, 
      // and currentIndex defines the START of the visible area:

      // If we just want it to be *visible*, we could be smarter, but 
      // "always show the page of the selected game mode" implies centering or bringing it into view.
      // Let's set it as the current index (start of view) but respected bounds.

      // However, if we scroll to the end, currentIndex might need to be maxIndex.
      // Let's just try to set it to gameIndex, clamped by maxIndex.

      // Wait, if I choose the last game, gameIndex will be high.
      // currentIndex is the index of the LEFTMOST card.
      // So if I select the last game, and I have 3 cards to show, 
      // currentIndex should be (Total - 3).

      // Actually, existing snapToIndex clamps to maxIndex.
      // But we shouldn't pass gameIndex directly if it's > maxIndex.
      // snapToIndex logic: Math.max(0, Math.min(index, maxIndex))

      // If I want the selected game to be focused, passing gameIndex directly 
      // (which snapToIndex clamps) is a good start. 
      // But if the user selects the very last game, gameIndex is N-1.
      // maxIndex is N - cardsToShow.
      // Clamped index will be maxIndex. 
      // So the view will start at maxIndex. 
      // The cards shown will be [maxIndex, maxIndex+1, ... maxIndex+cardsToShow-1].
      // The last card (index N-1) WILL be visible.

      // So yes, calling snapToIndex(gameIndex) is correct to bring it into view 
      // (specifically, making it the first one if possible, or sticking to the end).

      // One detail: if the user manually scrolled, we might not want to force jump 
      // unless the SELECTION changed externally (start up) or the user clicked something outside.
      // But here selectedGameType IS the source of truth.
      // If the user clicks a card in the carousel, onGameTypeChange is called, 
      // selectedGameType updates, and this specific effect triggers.
      // But wait! If I click the 2nd visible card, gameIndex is currentIndex + 1.
      // This effect will run and set currentIndex to currentIndex + 1.
      // So the carousel will shift to make the selected card the FIRST one.
      // This might be annoying if I just wanted to select it but keep context?
      // The user request says: "always show the page of the selected game mode".
      // "항상 선택된 게임 모드의 페이지를 보여주도록" -> "Always show the page of the selected game mode".

      // If I interpret "page" as "the card", then yes, it should be visible.
      // If I interpret it as "snap to start", then my logic is correct.
      // Standard carousel behavior often centers or brings to start.
      // The previous code had `snapToIndex` doing `setCurrentIndex`.

      // Let's protect against redundant updates if it's already visible?
      // "always show" -> implies if it's hidden, show it.
      // If it's already visible, maybe don't move it?
      // But the request says "always show the page...".
      // If I assume the user implies "on load/init", that's one thing.
      // But "always" implies synchronization.

      // Let's look at the existing behavior again.
      // When I click a card, `onGameTypeChange` is called.
      // If I click the 3rd card, it becomes selected.
      // Should the carousel scroll to make it the 1st card?
      // If yes, `snapToIndex(gameIndex)` is good.
      // If no (it should stay in place), then we should only move if it's NOT visible.

      // Let's refine the logic to be less intrusive if possible, OR strictly follow "show the page".
      // Usually, selecting an item doesn't necessarily mean "scroll it to start".
      // However, if I refresh, I want it to be there.
      // And if I change it via some other means (if any), it should jump.

      // Let's implement the "sync" which ensures it is visible.
      // Ideally: if gameIndex is within [currentIndex, currentIndex + effectiveCardsToShow - 1], do nothing?
      // BUT, the user said "show the PAGE of the selected game mode".
      // This strongly suggests the view should update to reflect the selection.
      // I will stick to the "snap to index" behavior as it guarantees visibility and is a predictable "sync".
      // Also, looking at `snapToIndex` implementation, it sets state.
      // `setCurrentIndex` will trigger a re-render/animation.

      // Important: `snapToIndex` is defined inside the component and captures `maxIndex`.
      // I shouldn't duplicate existing logic if I can help it, but I can't call `snapToIndex` from useEffect easily 
      // if it's not wrapped in useCallback or I ignore dependency warnings (which I can't do lightly).

      // Actually, `snapToIndex` depends on `maxIndex` and `onGameTypeChange`.
      // `onGameTypeChange` changes `selectedGameType`.
      // This creates a potential loop if `snapToIndex` calls `onGameTypeChange`...
      // Wait, `snapToIndex` in the original code:
      // const snapToIndex = (index: number) => {
      //   ...
      //   const game = AVAILABLE_GAMES[firstVisibleGameIndex];
      //   if (... && game.id !== selectedGameType) { onGameTypeChange(game.id); }
      // }

      // OH! `snapToIndex` ALSO selects the game at the new index!
      // This is a TWO-WAY binding.
      // 1. Scroll changes selection (via snapToIndex -> onGameTypeChange).
      // 2. We want Selection to change Scroll.

      // If I add `useEffect(() => snapToIndex(gameIndex), [selectedGameType])`:
      // 1. `selectedGameType` changes to X.
      // 2. Effect calls `snapToIndex(index of X)`.
      // 3. `snapToIndex` sets `currentIndex` to `index of X`.
      // 4. `snapToIndex` gets `firstVisibleGameIndex` (which is now `index of X`).
      // 5. `snapToIndex` sees `game.id` (X) equals `selectedGameType` (X).
      // 6. It does NOT call `onGameTypeChange`.
      // Loop broken. Safe.

      // EXCEPT: `snapToIndex` is not a dependency-stable function (re-created every render).
      // I should extract the logic or move the effect.

      // Better approach:
      // Just set `currentIndex` directly in the effect, but clamp it.
      // And do NOT trigger the "auto-select" logic that `snapToIndex` has.
      // The "auto-select" logic in `snapToIndex` is for when the *user scrolls*.
      // When we sync from state, we only want to scroll, not re-select (it's already selected).

      // So:
      const clampedIndex = Math.max(0, Math.min(gameIndex, maxIndex));
      if (clampedIndex !== currentIndex) {
        setCurrentIndex(clampedIndex);
      }
    }
  }, [selectedGameType, maxIndex, currentIndex]);

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
            snapToIndex(currentIndex - 1);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex < maxIndex) {
            snapToIndex(currentIndex + 1);
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
        snapToIndex(currentIndex - 1);
      } else if (velocity < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1);
      } else {
        snapToIndex(currentIndex);
      }
    } else if (Math.abs(offset) > threshold) {
      // Significant drag - snap in direction of drag
      if (offset > 0 && currentIndex > 0) {
        snapToIndex(currentIndex - 1);
      } else if (offset < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1);
      } else {
        snapToIndex(currentIndex); // Snap back
      }
    } else {
      snapToIndex(currentIndex); // Snap back if not enough drag
    }
  };

  // Navigation handlers
  const handlePrev = () => {
    if (disabled) return;
    if (currentIndex > 0) {
      snapToIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (disabled) return;
    if (currentIndex < maxIndex) {
      snapToIndex(currentIndex + 1);
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
                    snapToIndex(i);
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
