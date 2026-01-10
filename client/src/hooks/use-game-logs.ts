/**
 * Game Logs Hook
 * 
 * Manages game log history including initialization and AI log updates
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Game, GameType } from "@shared/schema";
import { getGameUIConfig } from "@/lib/games/GameUIConfig";
import { DEFAULT_GAME_TYPE } from "@shared/gameConfig";

export interface LogEntry {
  message: string;
  timestamp: Date;
}

export interface UseGameLogsOptions {
  game: Game | null | undefined;
  gameType?: GameType;
}

export interface UseGameLogsResult {
  logHistory: LogEntry[];
  setLogHistory: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

/**
 * Hook for managing game logs
 */
export function useGameLogs({ game, gameType }: UseGameLogsOptions): UseGameLogsResult {
  const { t } = useTranslation();
  const [logHistory, setLogHistory] = useState<LogEntry[]>([]);

  // Initialize logs when game loads (only if terminal log is enabled)
  useEffect(() => {
    if (game && logHistory.length === 0) {
      const currentGameType = gameType || game.gameType || DEFAULT_GAME_TYPE;
      const uiConfig = getGameUIConfig(currentGameType);
      
      // Skip log initialization if terminal log is disabled for this game
      if (!uiConfig.showTerminalLog) {
        return;
      }
      
      const initialTime = new Date();
      // Get initial log messages from UI config
      const initialMessages = uiConfig.initialLogMessages || [
        "gameRoom.log.monitoring",
        "gameRoom.log.connectionEstablished",
        "gameRoom.log.accessLevel",
      ];
      
      setLogHistory(
        initialMessages.map((message) => ({
          message: t(message),
          timestamp: initialTime,
        }))
      );
    }
  }, [game, gameType, logHistory.length, t]);

  // Update logs when game updates (only if terminal log is enabled)
  useEffect(() => {
    if (game?.aiLog) {
      const currentGameType = gameType || game.gameType || DEFAULT_GAME_TYPE;
      const uiConfig = getGameUIConfig(currentGameType);
      
      // Skip log updates if terminal log is disabled for this game
      if (!uiConfig.showTerminalLog) {
        return;
      }
      
      // Check if this is a new AI log (not already in history)
      setLogHistory((prev) => {
        // Only add if it's a new psychological insight (not system messages)
        const analyzingText = t("gameRoom.log.analyzing");
        const systemInitializedText = t("gameRoom.log.systemInitialized");
        const isNewInsight =
          game.aiLog &&
          game.aiLog !== analyzingText &&
          game.aiLog !== systemInitializedText &&
          !prev.some((log) => log.message === game.aiLog);

        if (isNewInsight) {
          return [...prev, { message: game.aiLog!, timestamp: new Date() }];
        }
        return prev;
      });
    }
  }, [game?.aiLog, game?.gameType, gameType, t]);

  return {
    logHistory,
    setLogHistory,
  };
}
