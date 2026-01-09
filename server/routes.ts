import type { Express } from "express";
import type { Server } from "http";

// All game logic is now client-side using localStorage
// Server only serves static files via Vite

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // All game logic is now client-side using localStorage
  // Server only serves static files via Vite middleware
  // No API routes needed
  
  return httpServer;
}

