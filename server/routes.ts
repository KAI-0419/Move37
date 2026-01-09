import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { parseFen, generateFen, isValidMove, makeMove, checkWinner, getAIMove, INITIAL_BOARD_FEN } from "./gameLogic";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

async function generateAIReasoning(boardFen: string, move: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        { role: "system", content: "You are 'Move 37', a cold, advanced AI logic engine. You are playing a 5x5 chess variant. Speak in short, terminal-log style sentences. Be cryptic, mathematical, and slightly arrogant. Focus on probability and efficiency." },
        { role: "user", content: `I just made move: ${move}. Board state FEN: ${boardFen}. Explain this move.` }
      ],
      max_completion_tokens: 50,
    });
    return response.choices[0]?.message?.content || "Calculating...";
  } catch (e) {
    console.error("AI Generation failed:", e);
    return "Optimization complete. Probability of victory: 99.9%.";
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Create Game
  app.post(api.games.create.path, async (req, res) => {
    const game = await storage.createGame({
      board: INITIAL_BOARD_FEN,
      turn: 'player',
      history: [],
      winner: null,
      aiLog: "System Initialized. Awaiting input...",
    });
    res.status(201).json(game);
  });

  // Get Game
  app.get(api.games.get.path, async (req, res) => {
    const game = await storage.getGame(Number(req.params.id));
    if (!game) return res.status(404).json({ message: 'Game not found' });
    res.json(game);
  });

  // Make Move
  app.post(api.games.move.path, async (req, res) => {
    const gameId = Number(req.params.id);
    const game = await storage.getGame(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    if (game.winner) return res.status(400).json({ message: 'Game over' });
    if (game.turn !== 'player') return res.status(400).json({ message: 'Not your turn' });

    const { from, to } = req.body;
    let board = parseFen(game.board);

    // Validate Player Move
    if (!isValidMove(board, from, to, true)) {
      return res.status(400).json({ message: 'Illegal move' });
    }

    // Apply Player Move
    board = makeMove(board, from, to);
    let winner = checkWinner(board);
    
    let history = [...(game.history || [])];
    history.push(`Player: ${from.r},${from.c} -> ${to.r},${to.c}`);

    if (winner) {
      const updated = await storage.updateGame(gameId, {
        board: generateFen(board),
        winner,
        history,
        aiLog: "Logic Failure. Human Victory."
      });
      return res.json(updated);
    }

    // AI Turn
    const aiMove = getAIMove(board);
    let aiLog = "Processing...";
    
    if (aiMove) {
      board = makeMove(board, aiMove.from, aiMove.to);
      const moveStr = `AI: ${aiMove.from.r},${aiMove.from.c} -> ${aiMove.to.r},${aiMove.to.c}`;
      history.push(moveStr);
      winner = checkWinner(board);
      
      // Generate real AI reasoning
      aiLog = await generateAIReasoning(generateFen(board), moveStr);
    } else {
      winner = 'player';
      aiLog = "Calculation error. No valid moves.";
    }

    const updated = await storage.updateGame(gameId, {
      board: generateFen(board),
      turn: 'player', // Back to player
      winner,
      history,
      aiLog
    });

    res.json(updated);
  });

  // Seed sample data if empty (Optional, but good for testing)
  // const existing = await storage.getGame(1);
  // if (!existing) {
  //   await storage.createGame({ ... });
  // }

  return httpServer;
}

