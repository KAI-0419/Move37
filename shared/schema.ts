import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  board: text("board").notNull(), // FEN-like string: "rnbqk/ppppp/....." but 5x5
  turn: text("turn").notNull().default("player"), // "player" or "ai"
  history: jsonb("history").$type<string[]>().default([]),
  winner: text("winner"), // "player", "ai", "draw"
  aiLog: text("ai_log"), // Last AI thought/reasoning
  turnCount: integer("turn_count").default(0), // Track number of turns for draw condition
  difficulty: text("difficulty").notNull().default("NEXUS-7"), // AI difficulty: "NEXUS-3", "NEXUS-5", "NEXUS-7"
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true });

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type CreateGameRequest = {
  difficulty?: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"; // Optional difficulty selection
};
export type MoveRequest = {
  from: { r: number; c: number };
  to: { r: number; c: number };
};

export type GameResponse = Game;
