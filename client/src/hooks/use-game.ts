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
      const result = await makeGameMove(gameId, move.from, move.to);
      return result;
    },
    onSuccess: async (data) => {
      // Immediately update the game state in cache with player's move
      queryClient.setQueryData(["game", gameId], data.game);
      
      // If AI needs to move, calculate it asynchronously
      if (data.playerMove && data.game.turn === 'ai') {
        // Start AI calculation in background
        calculateAIMove(gameId, data.playerMove).then((aiResult) => {
          queryClient.setQueryData(["game", gameId], aiResult.game);
          queryClient.invalidateQueries({ queryKey: ["game", gameId] });
        }).catch((error) => {
          console.error("AI move calculation error:", error);
        });
      }
      
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => {
      console.error("Move mutation error:", error);
    },
  });
}
