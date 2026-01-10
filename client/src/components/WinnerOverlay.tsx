/**
 * Winner Overlay Component
 * 
 * Displays game result (victory/defeat/draw) with actions
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Trophy, AlertTriangle, Skull } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { cn } from "@/lib/utils";
import { getUnlockedDifficulties } from "@/lib/storage";
import { getNextDifficulty } from "@/lib/utils/difficulty-utils";
import type { GameType } from "@shared/schema";
import type { DifficultyColorConfig } from "@/lib/games/GameUIConfig";

export interface WinnerOverlayProps {
  winner: "player" | "ai" | "draw";
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  gameType: GameType;
  difficultyColors: DifficultyColorConfig;
  onReturnToLobby: () => void;
  onPlayAgain: (targetDifficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => Promise<void>;
  onResetGameState: () => void;
}

export function WinnerOverlay({
  winner,
  difficulty,
  gameType,
  difficultyColors,
  onReturnToLobby,
  onPlayAgain,
  onResetGameState,
}: WinnerOverlayProps) {
  const { t } = useTranslation();

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
  const shouldShowUnlock = winner === 'player' && 
    ((currentDifficulty === "NEXUS-3" && unlocked.has("NEXUS-5")) ||
     (currentDifficulty === "NEXUS-5" && unlocked.has("NEXUS-7")));

  const unlockLevel = currentDifficulty === "NEXUS-3" ? "5" : "7";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md overflow-y-auto"
    >
      <div className="text-center space-y-4 sm:space-y-6 w-full max-w-md p-6 sm:p-8 lg:p-10 border border-white/20 bg-black my-auto">
        {/* Icon - Responsive sizing */}
        <div className="flex justify-center">
          {winner === 'player' ? (
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-secondary mb-2 sm:mb-4" />
          ) : winner === 'draw' ? (
            <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-secondary mb-2 sm:mb-4" />
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
