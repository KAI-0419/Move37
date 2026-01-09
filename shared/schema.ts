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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({ id: true, createdAt: true });

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export type CreateGameRequest = {}; // No input needed to start
export type MoveRequest = {
  from: { r: number; c: number };
  to: { r: number; c: number };
};

export type GameResponse = Game;
