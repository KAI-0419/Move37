import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Game type definitions (shared across client and server)
export type GameType = "MINI_CHESS" | "GAME_2" | "GAME_3" | "GAME_4" | "GAME_5";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull().default("MINI_CHESS"), // Game type identifier for multi-game support
  board: jsonb("board").$type<any>().notNull(), // Game state representation (string or object)
  turn: text("turn").notNull().default("player"), // "player" or "ai"
  history: jsonb("history").$type<string[]>().default([]),
  boardHistory: jsonb("board_history").$type<string[]>().default([]), // Board state history for repetition detection
  winner: text("winner"), // "player", "ai", "draw"
  aiLog: text("ai_log"), // Last AI thought/reasoning
  turnCount: integer("turn_count").default(0), // Track number of turns for draw condition
  difficulty: text("difficulty").notNull().default("NEXUS-7"), // AI difficulty: "NEXUS-3", "NEXUS-5", "NEXUS-7"
  playerTimeRemaining: integer("player_time_remaining").default(180), // Player's remaining time in seconds
  aiTimeRemaining: integer("ai_time_remaining").default(180), // AI's remaining time in seconds
  timePerMove: integer("time_per_move").default(5), // Time added per move in seconds
  lastMoveTimestamp: timestamp("last_move_timestamp"), // Timestamp of last move
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true });

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type CreateGameRequest = {
  gameType?: GameType; // Game type identifier (defaults to "MINI_CHESS" for backward compatibility)
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"; // Optional difficulty selection
};
export type MoveRequest = {
  from: { r: number; c: number };
  to: { r: number; c: number };
};

export type GameResponse = Game;
