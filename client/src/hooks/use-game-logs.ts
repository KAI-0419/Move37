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
  turnCount?: number; // 턴 정보 추가: 동일 메시지도 다른 턴에서 발생할 수 있음을 구분
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
      
      // Store initial messages as translation keys (not translated text)
      // This ensures consistency with AI logs and proper filtering
      setLogHistory(
        initialMessages.map((message) => ({
          message: message, // Store translation key, not translated text
          timestamp: initialTime,
          turnCount: undefined, // Initial logs don't have turn count
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
      
      // Parse combined log keys (separated by pipe)
      // This allows multiple log messages to be stored in single aiLog field
      const logKeys = game.aiLog.split('|').filter(key => key.trim().length > 0);
      const currentTurn = game.turnCount || 0;
      
      // System messages that should be filtered out (using translation keys directly)
      const SYSTEM_MESSAGE_KEYS = [
        "gameRoom.log.analyzing",
        "gameRoom.log.systemInitialized",
        "gameRoom.log.processing"
      ];
      
      setLogHistory((prev) => {
        let newHistory = [...prev];
        let hasChanged = false;

        // Process each log key separately
        logKeys.forEach(logKey => {
          const trimmedKey = logKey.trim();
          
          // Skip system messages (using translation keys directly, not translated text)
          if (SYSTEM_MESSAGE_KEYS.includes(trimmedKey)) {
            return; // Skip this log key
          }
          
          // Check uniqueness based on message key + turn count
          // This allows same message to appear in different turns
          const isAlreadyLoggedThisTurn = prev.some(
            (log) => {
              // Compare message keys directly (not translated text)
              const logMessageKey = log.message.startsWith("gameRoom.") || 
                                   log.message.startsWith("lobby.") || 
                                   log.message.startsWith("tutorial.")
                ? log.message 
                : null;
              
              // If log entry has a translation key format, compare keys
              // Otherwise compare messages directly
              if (logMessageKey && trimmedKey.startsWith("gameRoom.")) {
                return logMessageKey === trimmedKey && log.turnCount === currentTurn;
              }
              
              // Fallback: compare messages directly (for backward compatibility)
              return log.message === trimmedKey && log.turnCount === currentTurn;
            }
          );

          // Add new log entry if not already logged in this turn
          if (!isAlreadyLoggedThisTurn) {
            newHistory.push({ 
              message: trimmedKey, 
              timestamp: new Date(),
              turnCount: currentTurn 
            });
            hasChanged = true;
          }
        });

        return hasChanged ? newHistory : prev;
      });
    }
  }, [game?.aiLog, game?.turnCount, game?.gameType, gameType, t]);

  return {
    logHistory,
    setLogHistory,
  };
}
