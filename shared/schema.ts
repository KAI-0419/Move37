import { z } from "zod";

// Game type definitions (shared across client and server)
export const gameTypes = ["MINI_CHESS", "GAME_2", "GAME_3", "GAME_4", "GAME_5"] as const;
export type GameType = (typeof gameTypes)[number];

// Game schema using Zod for validation
export const gameSchema = z.object({
  id: z.number(),
  gameType: z.enum(gameTypes).default("MINI_CHESS"),
  board: z.any(),
  turn: z.string().default("player"),
  history: z.array(z.string()).default([]),
  boardHistory: z.array(z.string()).default([]),
  winner: z.string().nullable().default(null),
  aiLog: z.string().nullable().default(null),
  turnCount: z.number().default(0),
  difficulty: z.string().default("NEXUS-7"),
  playerTimeRemaining: z.number().nullable().default(180),
  aiTimeRemaining: z.number().nullable().default(180),
  timePerMove: z.number().nullable().default(5),
  lastMoveTimestamp: z.date().nullable().default(null),
  createdAt: z.date().default(() => new Date()),
});

export const insertGameSchema = gameSchema.omit({ id: true, createdAt: true });

export type Game = z.infer<typeof gameSchema>;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type CreateGameRequest = {
  gameType?: GameType;
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
};

export type MoveRequest = {
  from: { r: number; c: number };
  to: { r: number; c: number };
  destroy?: { r: number; c: number };
  moveTimeSeconds?: number;
  hoverCount?: number;
};

export type GameResponse = Game;
