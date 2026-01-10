/**
 * Player Status Card Component
 * 
 * Displays player status with turn indicator and timer
 */

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface PlayerStatusCardProps {
  isPlayerTurn: boolean;
  timeRemaining: number;
  enableTimer: boolean;
  enableTurnSystem: boolean;
  formatTime: (seconds: number) => string;
}

export function PlayerStatusCard({
  isPlayerTurn,
  timeRemaining,
  enableTimer,
  enableTurnSystem,
  formatTime,
}: PlayerStatusCardProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(
      "px-2 sm:px-3 py-1.5 sm:py-2 lg:p-4 border transition-all duration-300 flex-1 lg:w-full min-w-0 flex flex-col",
      isPlayerTurn ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,243,255,0.1)]" : "border-white/10 opacity-50"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 lg:mb-1">
            <h3 className="text-xs sm:text-sm lg:text-sm font-bold uppercase tracking-tight lg:tracking-normal truncate">
              {t("gameRoom.player")}
            </h3>
            {enableTurnSystem && (
              <div className={cn(
                "w-1.5 h-1.5 sm:w-2 sm:h-2 lg:w-2 lg:h-2 rounded-full shrink-0",
                isPlayerTurn ? "bg-primary animate-pulse" : "bg-gray-600"
              )} />
            )}
          </div>
          {enableTurnSystem && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs lg:text-xs">
              <span className="hidden sm:inline truncate text-[10px] sm:text-xs">
                {isPlayerTurn ? t("gameRoom.awaitingInput") : t("gameRoom.standby")}
              </span>
            </div>
          )}
        </div>
        {enableTimer && (
          <div className={cn(
            "text-sm sm:text-base lg:text-lg font-mono font-bold tabular-nums shrink-0",
            timeRemaining <= 10 ? "text-destructive animate-pulse" :
            timeRemaining <= 30 ? "text-yellow-500" :
            "text-primary"
          )}>
            {formatTime(timeRemaining)}
          </div>
        )}
      </div>
    </div>
  );
}
