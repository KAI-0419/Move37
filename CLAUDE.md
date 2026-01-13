# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Move 37 is a multi-game AI strategy platform featuring multiple board games with AI opponents. The project is built as a full-stack TypeScript application with React frontend and Express backend, designed for both web and mobile (Capacitor).

**Current Games:**
- MINI_CHESS (5x5 chess variant) - Fully implemented
- GAME_2 (Isolation) - Implemented
- GAME_3 (Entropy) - Implemented with MCTS AI using Web Workers
- GAME_4, GAME_5 - Placeholder slots for future games

## Build & Development Commands

```bash
# Development (runs dev server with Vite HMR)
npm run dev

# Production build (builds both client and server)
npm run build

# Start production server
npm start

# Type checking
npm run check
```

**Build Process:** The build script (`script/build.ts`) uses Vite for client bundling and esbuild for server bundling. Server dependencies in `BUNDLE_ALLOWLIST` (date-fns, express, zod, zod-validation-error) are bundled to reduce cold start time; others are marked as external.

**Mobile Build:** Uses Capacitor. Build output goes to `dist/public` (configured in `capacitor.config.ts`). Android and iOS platforms are in respective directories.

## Architecture

### Directory Structure

```
client/src/          # React frontend
  ├── components/    # Reusable UI components
  ├── pages/         # Lobby.tsx, GameRoom.tsx
  ├── lib/
  │   ├── games/     # Game-specific implementations (factory pattern)
  │   │   ├── miniChess/    # Mini chess game engine, board, AI
  │   │   ├── isolation/    # Isolation game implementation
  │   │   ├── entropy/      # Entropy game with MCTS AI + Web Worker
  │   │   ├── GameEngineFactory.ts   # Creates game engines by type
  │   │   ├── GameUIFactory.tsx      # Creates UI components by type
  │   │   └── GameBoardInterface.tsx # Common board component interface
  │   ├── gameEngine.ts   # Unified game engine API wrapper
  │   ├── storage.ts      # LocalStorage game persistence + difficulty unlocking
  │   └── locales/        # i18n translation files
  │
server/              # Express backend
  ├── index.ts       # Main entry, initializes routes and Vite/static serving
  ├── routes.ts      # API routes registration
  └── static.ts      # Static file serving (production)

shared/              # Code shared between client and server
  ├── schema.ts                  # Zod schemas for Game, GameType
  ├── gameEngineInterface.ts     # IGameEngine interface definition
  └── gameConfig.ts              # Game configuration types and defaults
```

### Game Architecture (Multi-Game Support)

The codebase uses a **factory pattern** to support multiple game types:

1. **Game Engine Interface** (`shared/gameEngineInterface.ts`):
   - Defines `IGameEngine` interface that all games must implement
   - Methods: `getInitialBoard()`, `isValidMove()`, `makeMove()`, `checkWinner()`, `calculateAIMove()`, etc.
   - Each game implements its own engine (e.g., `MiniChessEngine`, `IsolationEngine`, `EntropyEngine`)

2. **Game Engine Factory** (`client/src/lib/games/GameEngineFactory.ts`):
   - `GameEngineFactory.getEngine(gameType)` returns the appropriate engine
   - Engines are cached for performance
   - Centralized game type switching logic

3. **Game UI Factory** (`client/src/lib/games/GameUIFactory.tsx`):
   - `GameUIFactory.getBoardComponent(gameType)` returns the appropriate board component
   - Each game has its own board component (e.g., `MiniChessBoard`, `IsolationBoard`, `EntropyBoard`)

4. **Game Storage** (`client/src/lib/storage.ts`):
   - LocalStorage-based game persistence
   - Difficulty progression system (unlock NEXUS-5 after winning NEXUS-3, etc.)
   - Statistics tracking per game type

### Game Types and Schema

All games share a common schema (`shared/schema.ts`) with these fields:
- `gameType`: "MINI_CHESS" | "GAME_2" | "GAME_3" | "GAME_4" | "GAME_5"
- `board`: Game-specific board state (string format varies by game)
- `turn`: "player" | "ai"
- `history`: Array of move strings (format varies by game)
- `boardHistory`: Array of board states for repetition detection
- `winner`, `turnCount`, `difficulty`, time tracking fields

### Adding a New Game

To add a new game type (e.g., GAME_4):

1. Create game directory: `client/src/lib/games/game4/`
2. Implement `IGameEngine` interface in `Game4Engine.ts`
3. Create board component `Game4Board.tsx` matching `GameBoardComponent` interface
4. Update `GameEngineFactory.ts` to return your engine for "GAME_4"
5. Update `GameUIFactory.tsx` to return your board component for "GAME_4"
6. Add tutorial data in `game4/tutorialData.ts`
7. Update `DEFAULT_GAME_CONFIGS` in `shared/gameConfig.ts`

### AI Implementation

**Mini Chess & Isolation:** Use minimax algorithm with alpha-beta pruning and position evaluation.

**Entropy:** Uses **Monte Carlo Tree Search (MCTS)** with Web Workers for parallelization:
- `entropy/mcts.ts`: Main MCTS implementation
- `entropy/mcts.worker.ts`: Web Worker for parallel simulations
- Uses bitboards and optimized path analysis for performance
- Object pooling (`nodePool.ts`) to reduce GC pressure

### Path Aliases

Defined in `vite.config.ts` and `tsconfig.json`:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### State Management

- **React Query** (@tanstack/react-query) for server state (configured in `lib/queryClient.ts`)
- **LocalStorage** for game persistence and difficulty unlocking (`lib/storage.ts`)
- No global state management library (using React hooks + context)

### Routing

- **Wouter** for client-side routing (`client/src/App.tsx`)
- Routes: `/` (Lobby), `/game` (GameRoom), catch-all (404)
- Game type is stored in game object, not in URL

### Internationalization

- **i18next** + react-i18next
- Translation files in `client/src/lib/locales/` (en, ko, ja, zh, etc.)
- Configured in `lib/i18n.ts`

## Mobile (Capacitor)

- AppId: `com.move37.app`
- Web directory: `dist/public`
- AdMob integration configured (test IDs in config)
- Splash screen: 3s duration, black background
- Platform-specific code in `android/` and `ios/` directories

## Important Implementation Notes

1. **Board State Format**: Each game type uses its own string format for board state:
   - Mini Chess: FEN-like format (e.g., "NPKPN/5/5/5/npkpn")
   - Isolation: Custom format with piece positions and blocked cells
   - Entropy: Bitboard-based representation

2. **Difficulty System**: Unified NEXUS-3/5/7 system across all games
   - NEXUS-3: Unlocked by default
   - NEXUS-5: Unlocked after winning NEXUS-3
   - NEXUS-7: Unlocked after winning NEXUS-5

3. **Time Control**:
   - Initial time: 180 seconds per player
   - Time per move: +5 seconds (Fischer increment)
   - Timeout = loss

4. **AI Logging**: AI provides "psychological insights" and reasoning that displays in the game room

5. **Performance**: Entropy game uses Web Workers to avoid blocking UI during MCTS calculations

## Common Development Patterns

- Use `GameEngineFactory.getEngine(gameType)` to get game-specific logic
- Use `GameUIFactory.getBoardComponent(gameType)` to render game-specific UI
- Always validate moves through the engine's `isValidMove()` method
- Store games via `gameStorage` methods in `lib/storage.ts`
- Use translation keys for all user-facing text (e.g., `t("lobby.title")`)

## Known Architecture Decisions

From `ARCHITECTURE_ANALYSIS.md`, the codebase was refactored from a chess-only implementation to support multiple games. Key decisions:

- Board state remains string-based for easy serialization (each game defines its own format)
- Game engines are instantiated once and cached
- Tutorial system is game-specific (each game provides its own tutorial data)
- Statistics are tracked per game type but stored in unified LocalStorage structure
