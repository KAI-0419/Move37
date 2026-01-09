// Client-side game hooks using localStorage (100% offline)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MoveRequest } from "@shared/schema";
import { createGame, getGame, makeGameMove, calculateAIMove } from "@/lib/gameEngine";
import type { Piece } from "@shared/gameLogic";
import { gameStorage } from "@/lib/storage";

export function useGame(id: number | null) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      if (!id) return null;
      return await getGame(id);
    },
    enabled: !!id,
    // Poll when it's AI's turn to check for AI move completion
    refetchInterval: (query) => {
      const game = query.state.data;
      return game && game.turn === 'ai' && !game.winner ? 200 : false;
    },
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
      const game = await createGame(difficulty || "NEXUS-7");
      return game;
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
      const result = await makeGameMove(gameId, move.from, move.to);
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
      
      // If AI needs to move, calculate it asynchronously
      // Wait for piece movement animation to complete before starting AI calculation
      if (data.playerMove && data.game.turn === 'ai') {
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
      
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => {
      console.error("Move mutation error:", error);
    },
  });
}
