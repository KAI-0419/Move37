// Client-side game hooks using localStorage (100% offline)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MoveRequest, GameType } from "@shared/schema";
import { createGame, getGame, makeGameMove, calculateAIMove } from "@/lib/gameEngine";
import { gameStorage } from "@/lib/storage";
import { DEFAULT_GAME_TYPE } from "@shared/gameConfig";
import { getGameUIConfig } from "@/lib/games/GameUIConfig";

export interface CreateGameParams {
  gameType?: GameType; // Optional, defaults to DEFAULT_GAME_TYPE for backward compatibility
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"; // Optional, defaults to NEXUS-7
}

export function useGame(id: number | null) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      if (!id) return null;
      return await getGame(id);
    },
    enabled: !!id,
    // Poll when it's AI's turn to check for AI move completion
    // Only poll if turn system is player-ai and it's AI's turn
    refetchInterval: (query) => {
      const game = query.state.data;
      if (!game || game.winner) return false;
      
      // Get game config to check turn system
      const uiConfig = getGameUIConfig(game.gameType);
      
      // Only poll if turn system is player-ai and it's AI's turn
      const shouldPoll = uiConfig.turnSystemType === 'player-ai' && 
                         game.turn === 'ai';
      return shouldPoll ? 200 : false;
    },
  });
}

/**
 * Hook to create a new game
 * Supports both old API (difficulty only) and new API (gameType + difficulty)
 * for backward compatibility
 */
export function useCreateGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params?: CreateGameParams | "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
      // Backward compatibility: if params is a string, treat it as difficulty
      if (typeof params === "string") {
        const difficulty = params as "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
        return await createGame(DEFAULT_GAME_TYPE, difficulty);
      }
      
      // New API: params is an object
      const { gameType = DEFAULT_GAME_TYPE, difficulty = "NEXUS-7" } = params || {};
      return await createGame(gameType, difficulty);
    },
    onSuccess: (game) => {
      // Update cache and set as current game
      queryClient.setQueryData(["game", game.id], game);
      gameStorage.setCurrentGameId(game.id);
    },
  });
}

export function useMakeMove(gameId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (move: MoveRequest) => {
      // Validate gameId before attempting move
      if (!gameId || gameId <= 0) {
        throw new Error("gameRoom.errors.invalidGameId");
      }
      const result = await makeGameMove(gameId, move.from, move.to, {
        moveTimeSeconds: move.moveTimeSeconds,
        hoverCount: move.hoverCount
      });
      return result;
    },
    onSuccess: async (data) => {
      // Validate gameId is still valid before updating cache
      if (!gameId || gameId <= 0) {
        console.warn("Skipping cache update: invalid game ID");
        return;
      }

      // Immediately update the game state in cache with player's move
      queryClient.setQueryData(["game", gameId], data.game);
      
      // Get game config to check turn system
      const uiConfig = getGameUIConfig(data.game.gameType);
      
      // If AI needs to move, calculate it asynchronously
      // Only if turn system is player-ai and it's AI's turn
      // Wait for piece movement animation to complete before starting AI calculation
      if (data.playerMove && 
          uiConfig.turnSystemType === 'player-ai' && 
          data.game.turn === 'ai') {
        // Store the gameId at the time of starting AI calculation
        const currentGameId = gameId;
        
        // Wait for piece movement animation to complete (600ms)
        // ChessBoard uses framer-motion layout animation with spring transition (~500ms)
        // Adding 100ms buffer to ensure animation is fully complete
        setTimeout(() => {
          // Start AI calculation after animation completes
          calculateAIMove(currentGameId, data.playerMove!)
            .then((aiResult) => {
              // Only update if we're still on the same game
              // This prevents updating cache for a game that user has navigated away from
              const currentGame = queryClient.getQueryData(["game", currentGameId]);
              if (currentGame) {
                queryClient.setQueryData(["game", currentGameId], aiResult.game);
                queryClient.invalidateQueries({ queryKey: ["game", currentGameId] });
              }
            })
            .catch((error) => {
              // Only log if we're still on the same game
              const currentGame = queryClient.getQueryData(["game", currentGameId]);
              if (currentGame) {
                console.error("AI move calculation error:", error);
              }
            });
        }, 600); // Wait 600ms for piece movement animation to complete
      }
      
      // 애니메이션이 완료된 후에만 쿼리 무효화
      // 이렇게 하면 보드 상태 업데이트가 애니메이션과 충돌하지 않음
      // 애니메이션은 약 500ms이므로, 약간의 지연을 두어 애니메이션이 완료된 후 업데이트
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["game", gameId] });
      }, 550); // 애니메이션 완료 후 약간의 여유를 두고 업데이트
    },
    onError: (error) => {
      console.error("Move mutation error:", error);
    },
  });
}
