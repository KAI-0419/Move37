// Client-side game hooks using localStorage (100% offline)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MoveRequest } from "@shared/schema";
import { createGame, getGame, makeGameMove } from "@/lib/gameEngine";
import { gameStorage } from "@/lib/storage";

export function useGame(id: number | null) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      if (!id) return null;
      return await getGame(id);
    },
    enabled: !!id,
    // No polling needed - state is managed locally
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const game = await createGame();
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
    onSuccess: (data) => {
      // Immediately update the game state in cache
      queryClient.setQueryData(["game", gameId], data);
      // Also invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["game", gameId] });
    },
    onError: (error) => {
      console.error("Move mutation error:", error);
    },
  });
}
