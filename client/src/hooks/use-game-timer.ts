/**
 * Game Timer Hook
 * 
 * Manages game timer logic including time calculation, formatting, and timeout detection
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { gameStorage } from "@/lib/storage";
import type { Game } from "@shared/schema";
import type { GameUIConfig } from "@/lib/games/GameUIConfig";

export interface UseGameTimerOptions {
  game: Game | null | undefined;
  uiConfig: GameUIConfig;
  isPlayerTurn: boolean;
  hasWinner: boolean;
  onPlayerTimeout?: () => void;
  onAITimeout?: () => void;
}

export interface UseGameTimerResult {
  playerTimeRemaining: number;
  aiTimeRemaining: number;
  formatTime: (seconds: number) => string;
}

/**
 * Format time as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate remaining time for display (real-time calculation)
 * Only count down time for the current player's turn
 * Timer stops immediately when game ends (winner is set)
 * Only works if timer is enabled for this game
 */
function calculateRemainingTime(
  baseTime: number | null | undefined,
  lastMoveTimestamp: Date | null | undefined,
  isCurrentPlayer: boolean,
  hasWinner: boolean,
  currentTime: Date,
  uiConfig: GameUIConfig
): number {
  if (!uiConfig.enableTimer) {
    // If timer is disabled, return a default value (won't be displayed anyway)
    return 0;
  }

  const defaultTime = uiConfig.initialTime ?? 180;
  const base = baseTime ?? defaultTime;
  if (base <= 0) return 0;

  // Stop timer immediately when game ends
  if (hasWinner) {
    return base; // Return frozen time when game is over
  }

  if (!lastMoveTimestamp) return base;

  // Only count down time if it's this player's turn
  if (!isCurrentPlayer) {
    return base; // Time is frozen when it's not this player's turn
  }

  // Calculate elapsed time, ensuring it's never negative (in case of timing issues)
  const elapsedMs = currentTime.getTime() - lastMoveTimestamp.getTime();
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  return Math.max(0, base - elapsedSeconds);
}

/**
 * Hook for managing game timer
 * Optimized to skip calculations when timer is disabled
 * Note: Always calls hooks to comply with React rules, but skips work when timer is disabled
 */
export function useGameTimer({
  game,
  uiConfig,
  isPlayerTurn,
  hasWinner,
  onPlayerTimeout,
  onAITimeout,
}: UseGameTimerOptions): UseGameTimerResult {
  const queryClient = useQueryClient();
  
  // Always initialize state (React hook rules)
  // But only update it if timer is enabled
  const [currentTime, setCurrentTime] = useState(new Date());

  // Timer: Update current time every second (only if timer is enabled)
  useEffect(() => {
    // Skip interval setup if timer is disabled
    if (!uiConfig.enableTimer) {
      return;
    }
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [uiConfig.enableTimer]); // Include enableTimer in deps

  // Calculate remaining times (skip calculation if timer is disabled)
  // Use useMemo to avoid unnecessary recalculations
  const defaultTime = uiConfig.initialTime ?? 180;
  const playerTimeRemaining = uiConfig.enableTimer && game
    ? calculateRemainingTime(
        game.playerTimeRemaining,
        game.lastMoveTimestamp,
        isPlayerTurn,
        hasWinner,
        currentTime,
        uiConfig
      )
    : uiConfig.enableTimer && !game
    ? defaultTime
    : 0; // Return 0 if timer is disabled
  const aiTimeRemaining = uiConfig.enableTimer && game
    ? calculateRemainingTime(
        game.aiTimeRemaining,
        game.lastMoveTimestamp,
        !isPlayerTurn,
        hasWinner,
        currentTime,
        uiConfig
      )
    : uiConfig.enableTimer && !game
    ? defaultTime
    : 0; // Return 0 if timer is disabled

  // Check for timeout and handle automatically (only if timer is enabled)
  useEffect(() => {
    if (!uiConfig.enableTimer || !game || game.winner) return;

    // Only check timeout for the current player
    // Skip timeout check if turn system is disabled
    if (uiConfig.turnSystemType === 'none') {
      return; // No turn system means no timeout checks needed
    }

    if (isPlayerTurn && playerTimeRemaining <= 0) {
      // Player timeout - end game immediately
      const checkPlayerTimeout = async () => {
        const currentGame = await gameStorage.getGame(game.id);
        // Check if it's player's turn based on turn system type
        const isPlayerTurnCheck = uiConfig.turnSystemType === 'player-ai' && currentGame?.turn === 'player';
        if (currentGame && isPlayerTurnCheck && !currentGame.winner) {
          // Recalculate to be sure
          const playerTime = calculateRemainingTime(
            currentGame.playerTimeRemaining,
            currentGame.lastMoveTimestamp,
            true,
            false, // hasWinner: false (game is still ongoing)
            new Date(),
            uiConfig
          );
          if (playerTime <= 0) {
            await gameStorage.updateGame(game.id, {
              winner: 'ai',
              aiLog: "gameRoom.log.timeExpiredHuman",
            });
            // Invalidate query to refresh
            queryClient.invalidateQueries({ queryKey: ["game", game.id] });
            onPlayerTimeout?.();
          }
        }
      };
      checkPlayerTimeout();
    } else if (!isPlayerTurn && aiTimeRemaining <= 0) {
      // AI timeout - check and update immediately
      const checkAITimeout = async () => {
        const currentGame = await gameStorage.getGame(game.id);
        // Check if it's AI's turn based on turn system type
        const isAITurnCheck = uiConfig.turnSystemType === 'player-ai' && currentGame?.turn === 'ai';
        if (currentGame && isAITurnCheck && !currentGame.winner) {
          // Recalculate to be sure
          const aiTime = calculateRemainingTime(
            currentGame.aiTimeRemaining,
            currentGame.lastMoveTimestamp,
            true,
            false, // hasWinner: false (game is still ongoing)
            new Date(),
            uiConfig
          );
          if (aiTime <= 0) {
            await gameStorage.updateGame(game.id, {
              winner: 'player',
              aiLog: "gameRoom.log.timeExpiredAI",
            });
            // Invalidate query to refresh
            queryClient.invalidateQueries({ queryKey: ["game", game.id] });
            onAITimeout?.();
          }
        }
      };
      checkAITimeout();
    }
  }, [
    uiConfig.enableTimer,
    uiConfig.turnSystemType,
    playerTimeRemaining,
    aiTimeRemaining,
    isPlayerTurn,
    game?.turn,
    game?.winner,
    game?.id,
    queryClient,
    uiConfig,
    onPlayerTimeout,
    onAITimeout,
  ]);

  return {
    playerTimeRemaining,
    aiTimeRemaining,
    formatTime,
  };
}
