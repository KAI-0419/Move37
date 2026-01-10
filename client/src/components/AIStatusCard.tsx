/**
 * AI Status Card Component
 * 
 * Displays AI status with difficulty, turn indicator, and timer
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DifficultyColorConfig } from "@/lib/games/GameUIConfig";

export interface AIStatusCardProps {
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  isAITurn: boolean;
  isProcessing: boolean;
  timeRemaining: number;
  enableTimer: boolean;
  enableTurnSystem: boolean;
  difficultyColors: DifficultyColorConfig;
  formatTime: (seconds: number) => string;
}

export function AIStatusCard({
  difficulty,
  isAITurn,
  isProcessing,
  timeRemaining,
  enableTimer,
  enableTurnSystem,
  difficultyColors,
  formatTime,
}: AIStatusCardProps) {
  const { t } = useTranslation();

  const isActive = isAITurn || isProcessing;

  return (
    <div className={cn(
      "px-2 sm:px-3 py-1.5 sm:py-2 lg:p-4 border transition-all duration-300 flex-1 lg:w-full min-w-0 flex flex-col",
      isActive
        ? `${difficultyColors.border} ${difficultyColors.bg} ${difficultyColors.shadow}`
        : "border-white/10 opacity-50"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn("flex items-center gap-1.5 sm:gap-2 mb-0.5 lg:mb-1", difficultyColors.text)}>
            <h3 className={cn(
              "text-xs sm:text-sm lg:text-sm font-bold uppercase tracking-tight lg:tracking-normal truncate",
              difficultyColors.text
            )}>
              <span className="hidden sm:inline">{difficulty} </span>
              <span className="sm:hidden">{difficulty.replace("NEXUS-", "N")}</span>
              <span className="text-[10px] sm:text-xs"> ({t("gameRoom.aiLabel")})</span>
            </h3>
            {enableTurnSystem && (
              <div className={cn(
                "w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2 lg:h-2 rounded-full shrink-0",
                isActive
                  ? cn(difficultyColors.bgPulse, "animate-pulse")
                  : "bg-gray-600"
              )} />
            )}
          </div>
          {enableTurnSystem && (
            <div className={cn("flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-xs", difficultyColors.text)}>
              <span className="hidden sm:inline truncate text-[10px] sm:text-xs">
                {isProcessing ? t("gameRoom.analyzingMoves") : isAITurn ? t("gameRoom.calculatingProbabilities") : t("gameRoom.observing")}
              </span>
            </div>
          )}
        </div>
        {enableTimer && (
          <div className={cn(
            "text-sm sm:text-base lg:text-lg font-mono font-bold tabular-nums shrink-0",
            timeRemaining <= 10 ? "text-destructive animate-pulse" :
            timeRemaining <= 30 ? "text-yellow-500" :
            difficultyColors.text
          )}>
            {formatTime(timeRemaining)}
          </div>
        )}
      </div>
    </div>
  );
}
