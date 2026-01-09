import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { CreateGameRequest, MoveRequest, GameResponse } from "@shared/schema";

export function useGame(id: number | null) {
  return useQuery({
    queryKey: [api.games.get.path, id],
    queryFn: async () => {
      if (!id) return null;
      const url = buildUrl(api.games.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch game");
      return api.games.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll faster if it's AI's turn
      return query.state.data?.turn === 'ai' ? 1000 : 5000;
    },
  });
}

export function useCreateGame() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.games.create.path, {
        method: api.games.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({} as CreateGameRequest),
      });
      
      if (!res.ok) throw new Error("Failed to initialize system");
      return api.games.create.responses[201].parse(await res.json());
    },
  });
}

export function useMakeMove(gameId: number) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (move: MoveRequest) => {
      const url = buildUrl(api.games.move.path, { id: gameId });
      const res = await fetch(url, {
        method: api.games.move.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(move),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.games.move.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to execute move");
      }
      
      return api.games.move.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Immediately update the game state in cache
      queryClient.setQueryData([api.games.get.path, gameId], data);
    },
  });
}
