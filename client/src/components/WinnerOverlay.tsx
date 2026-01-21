/**
 * Winner Overlay Component
 * 
 * Displays game result (victory/defeat/draw) with actions
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Trophy, TriangleAlert, Skull, X } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { cn } from "@/lib/utils";
import { getUnlockedDifficulties } from "@/lib/storage";
import { getNextDifficulty } from "@/lib/difficulty-utils";
import type { GameType } from "@shared/schema";
import type { DifficultyColorConfig } from "@/lib/games/GameUIConfig";
import confetti from "canvas-confetti";

export interface WinnerOverlayProps {
  winner: "player" | "ai" | "draw";
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  gameType: GameType;
  difficultyColors: DifficultyColorConfig;
  justUnlockedDifficulty?: "NEXUS-5" | "NEXUS-7" | null; // Difficulty that was just unlocked in this victory
  onReturnToLobby: () => void;
  onPlayAgain: (targetDifficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => Promise<void>;
  onResetGameState: () => void;
  onClose?: () => void;
}

export function WinnerOverlay({
  winner,
  difficulty,
  gameType,
  difficultyColors,
  justUnlockedDifficulty,
  onReturnToLobby,
  onPlayAgain,
  onResetGameState,
  onClose,
}: WinnerOverlayProps) {
  const { t } = useTranslation();

  // Celebrate victory with confetti
  useEffect(() => {
    if (winner === 'player') {
      // Fire confetti from multiple angles
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        // Fire from left
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });

        // Fire from right
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [winner]);

  // Get unlocked difficulties for the game type
  const unlocked = getUnlockedDifficulties(gameType);
  const currentDifficulty = difficulty;
  const nextLevel = getNextDifficulty(currentDifficulty);

  // Determine target difficulty for "Play Again" button
  const getTargetDifficulty = (): "NEXUS-3" | "NEXUS-5" | "NEXUS-7" => {
    // Lost: always play again at current level
    if (winner !== 'player' && winner !== 'draw') {
      return currentDifficulty;
    }
    // Won
    if (winner === 'player') {
      // NEXUS-7: no next level, play again at NEXUS-7
      if (currentDifficulty === "NEXUS-7") {
        return currentDifficulty;
      }
      // Won and next level exists: play next level
      if (nextLevel) {
        return nextLevel;
      }
    }
    // Draw or other cases: play again at current level
    return currentDifficulty;
  };

  // Get button text
  const getButtonText = (): string => {
    if (winner !== 'player' && winner !== 'draw') {
      return t("gameRoom.playAgain");
    }
    if (currentDifficulty === "NEXUS-7" && winner === 'player') {
      return t("gameRoom.playAgain");
    }
    if (winner === 'player' && nextLevel) {
      return t("gameRoom.nextLevel");
    }
    return t("gameRoom.newGame");
  };

  // Handle play again button click
  const handlePlayAgain = async () => {
    try {
      const targetDifficulty = getTargetDifficulty();
      await onPlayAgain(targetDifficulty);
      onResetGameState();
    } catch (error) {
      console.error("Failed to create new game:", error);
    }
  };

  // Check if unlock message should be shown
  // Show unlock message if:
  // 1. Player won
  // 2. A difficulty was just unlocked in this victory (most reliable)
  // 3. OR the next difficulty is unlocked (fallback for edge cases)
  const shouldShowUnlock = winner === 'player' && (
    (justUnlockedDifficulty !== null && justUnlockedDifficulty !== undefined) ||
    ((currentDifficulty === "NEXUS-3" && unlocked.has("NEXUS-5")) ||
      (currentDifficulty === "NEXUS-5" && unlocked.has("NEXUS-7")))
  );

  // Determine unlock level: use justUnlockedDifficulty if available, otherwise infer from current difficulty
  const unlockLevel = justUnlockedDifficulty === "NEXUS-5" ? "5"
    : justUnlockedDifficulty === "NEXUS-7" ? "7"
      : currentDifficulty === "NEXUS-3" ? "5"
        : "7";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md overflow-y-auto"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="relative text-center space-y-4 sm:space-y-5 md:space-y-6 w-full max-w-[95vw] sm:max-w-md p-4 sm:p-6 md:p-8 lg:p-10 border border-white/20 bg-black my-auto">
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 text-muted-foreground hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* Icon - Responsive sizing */}
        <div className="flex justify-center">
          {winner === 'player' ? (
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-secondary mb-2 sm:mb-4" />
          ) : winner === 'draw' ? (
            <TriangleAlert className="w-12 h-12 sm:w-16 sm:h-16 text-secondary mb-2 sm:mb-4" />
          ) : (
            <Skull className={cn("w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-4", difficultyColors.icon)} />
          )}
        </div>

        {/* Title - Responsive font size */}
        <h2 className={cn(
          "text-2xl sm:text-3xl lg:text-4xl font-display font-black leading-tight px-2",
          winner === 'player' ? "text-primary" :
            winner === 'draw' ? "text-secondary" :
              difficultyColors.text
        )}>
          {winner === 'player' ? t("gameRoom.youWon") :
            winner === 'draw' ? t("gameRoom.draw") :
              t("gameRoom.youLost")}
        </h2>

        {/* Message - Responsive font size and max width */}
        <p className="font-mono text-xs sm:text-sm text-muted-foreground max-w-[280px] sm:max-w-none mx-auto px-2">
          {winner === 'player'
            ? t("gameRoom.victoryMessage")
            : winner === 'draw'
              ? t("gameRoom.drawMessage")
              : t("gameRoom.defeatMessage")}
        </p>

        {/* Unlock message - Responsive padding */}
        {shouldShowUnlock && (
          <p className="font-mono text-xs text-primary border border-primary/30 px-3 sm:px-4 py-2 bg-primary/5 mx-auto max-w-[280px] sm:max-w-none">
            {t("gameRoom.unlocked", { level: unlockLevel })}
          </p>
        )}

        {/* Button layout - Mobile vertical, Desktop horizontal */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4">
          <GlitchButton
            className="w-full sm:w-auto"
            onClick={onReturnToLobby}
          >
            {t("gameRoom.returnToLobby")}
          </GlitchButton>
          <GlitchButton
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handlePlayAgain}
          >
            {getButtonText()}
          </GlitchButton>
        </div>
      </div>
    </motion.div>
  );
}
