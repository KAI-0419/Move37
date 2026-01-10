/**
 * Turn Banner Component
 * 
 * Displays current turn status or game result
 */

import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DifficultyColorConfig } from "@/lib/games/GameUIConfig";

export interface TurnBannerProps {
  winner: "player" | "ai" | "draw" | null;
  turn: "player" | "ai";
  isProcessing: boolean;
  enableTurnSystem: boolean;
  difficultyColors: DifficultyColorConfig;
}

export function TurnBanner({
  winner,
  turn,
  isProcessing,
  enableTurnSystem,
  difficultyColors,
}: TurnBannerProps) {
  const { t } = useTranslation();

  // Always show if game has ended, or show if turn system is enabled
  if (!winner && !enableTurnSystem) {
    return null;
  }

  return (
    <div className="mb-2 sm:mb-4 lg:mb-8 text-center h-6 lg:h-8">
      <AnimatePresence mode="wait">
        {winner ? (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "text-lg lg:text-2xl font-display font-black tracking-widest px-4 lg:px-6 py-1 lg:py-2 border-y-2",
              winner === 'player' ? "text-primary border-primary" :
              winner === 'draw' ? "text-secondary border-secondary" :
              "text-destructive border-destructive"
            )}
          >
            {winner === 'player' ? t("gameRoom.victory") :
             winner === 'draw' ? t("gameRoom.draw") :
             t("gameRoom.defeat")}
          </motion.div>
        ) : enableTurnSystem ? (
          <motion.div
            key={isProcessing ? 'analyzing' : turn}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={cn(
              "text-xs lg:text-lg tracking-widest font-bold uppercase",
              isProcessing
                ? difficultyColors.text
                : turn === 'player'
                ? "text-primary"
                : difficultyColors.text
            )}
          >
            {isProcessing ? t("gameRoom.aiAnalyzing") : turn === 'player' ? t("gameRoom.yourTurn") : t("gameRoom.opponentThinking")}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
