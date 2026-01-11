/**
 * Game UI Configuration
 * 
 * Defines game-specific UI feature flags and customization options.
 * Each game can enable/disable features and customize appearance based on its needs.
 */

import type { GameType } from "@shared/schema";

/**
 * Difficulty color configuration
 * Defines CSS classes for different difficulty levels
 */
export interface DifficultyColorConfig {
  text: string;
  border: string;
  bg: string;
  bgHover: string;
  shadow: string;
  borderOpacity: string;
  textOpacity: string;
  textOpacity90: string;
  bgOpacity: string;
  borderOpacity30: string;
  icon: string;
  bgPulse: string;
}

/**
 * Interaction pattern for game input handling
 * - 'select-then-move': Click to select piece, then click destination (e.g., chess)
 * - 'direct-move': Click directly on piece to move it (future games)
 * - 'drag-drop': Drag and drop pieces (future games)
 */
export type InteractionPattern = 'select-then-move' | 'direct-move' | 'drag-drop';

/**
 * Layout type for game room
 * - 'standard': Standard 3-panel layout (left sidebar, center board, right terminal)
 * - 'minimal': Minimal layout with only board (no sidebars)
 * - 'custom': Custom layout defined by game-specific implementation
 */
export type LayoutType = 'standard' | 'minimal' | 'custom';

/**
 * Turn system type for game
 * - 'player-ai': Standard turn-based system with player and AI turns
 * - 'none': No turn system (player can always act)
 * - 'custom': Custom turn system (game-specific implementation)
 */
export type TurnSystemType = 'player-ai' | 'none' | 'custom';

/**
 * Game UI Configuration Interface
 * 
 * Controls which UI features are enabled/disabled for each game type
 */
export interface GameUIConfig {
  // Timer system
  enableTimer: boolean;
  initialTime?: number; // Initial time in seconds (default: 180)
  timePerMove?: number; // Time added per move in seconds (default: 5)
  
  // Turn system
  enableTurnSystem: boolean;
  turnSystemType?: TurnSystemType; // Type of turn system (default: 'player-ai')
  
  // UI component visibility
  showPlayerCard: boolean;
  showAICard: boolean;
  showTurnBanner: boolean;
  showTerminalLog: boolean;
  showWinnerOverlay?: boolean; // Show winner overlay when game ends (default: true)
  
  // Interaction pattern for game input
  interactionPattern: InteractionPattern;
  
  // Layout configuration
  layoutType?: LayoutType; // Default: 'standard'
  
  // Board dimensions (for tutorial and UI rendering)
  boardSize?: {
    rows: number;
    cols: number;
  };
  
  // Difficulty color customization (optional - uses default if not provided)
  difficultyColors?: {
    "NEXUS-3": DifficultyColorConfig;
    "NEXUS-5": DifficultyColorConfig;
    "NEXUS-7": DifficultyColorConfig;
  };
  
  // Initial log messages (optional - uses default if not provided)
  initialLogMessages?: string[];
}

/**
 * Default difficulty colors (used when game doesn't provide custom colors)
 */
const DEFAULT_DIFFICULTY_COLORS = {
  "NEXUS-3": {
    text: "text-primary",
    border: "border-primary",
    bg: "bg-primary/5",
    bgHover: "hover:bg-primary/10",
    shadow: "shadow-[0_0_15px_rgba(0,243,255,0.1)]",
    borderOpacity: "border-primary/50",
    textOpacity: "text-primary/80",
    textOpacity90: "text-primary/90",
    bgOpacity: "bg-primary/5",
    borderOpacity30: "border-primary/30",
    icon: "text-primary",
    bgPulse: "bg-primary",
  } as DifficultyColorConfig,
  "NEXUS-5": {
    text: "text-secondary",
    border: "border-secondary",
    bg: "bg-secondary/5",
    bgHover: "hover:bg-secondary/10",
    shadow: "shadow-[0_0_15px_rgba(255,200,0,0.1)]",
    borderOpacity: "border-secondary/50",
    textOpacity: "text-secondary/80",
    textOpacity90: "text-secondary/90",
    bgOpacity: "bg-secondary/5",
    borderOpacity30: "border-secondary/30",
    icon: "text-secondary",
    bgPulse: "bg-secondary",
  } as DifficultyColorConfig,
  "NEXUS-7": {
    text: "text-destructive",
    border: "border-destructive",
    bg: "bg-destructive/5",
    bgHover: "hover:bg-destructive/10",
    shadow: "shadow-[0_0_15px_rgba(255,0,60,0.1)]",
    borderOpacity: "border-destructive/50",
    textOpacity: "text-destructive/80",
    textOpacity90: "text-destructive/90",
    bgOpacity: "bg-destructive/5",
    borderOpacity30: "border-destructive/30",
    icon: "text-destructive",
    bgPulse: "bg-destructive",
  } as DifficultyColorConfig,
};

/**
 * Game-specific UI configurations
 * 
 * Each game can customize which features are enabled and how they appear.
 * 
 * Configuration Guidelines:
 * - If enableTimer is false, showPlayerCard and showAICard should typically be false
 *   (cards are primarily for displaying timer and turn status)
 * - If enableTurnSystem is false, showTurnBanner should typically be false
 *   (banner is for displaying turn status)
 * - If layoutType is 'minimal', showPlayerCard, showAICard, and showTerminalLog
 *   should typically be false (minimal layout has no sidebars)
 * - showWinnerOverlay defaults to true (can be disabled for games with custom end screens)
 * - All games use NEXUS-3/5/7 difficulty system (unified across all games)
 */
const GAME_UI_CONFIGS: Record<GameType, GameUIConfig> = {
  MINI_CHESS: {
    // Mini Chess: Full-featured game with timer, turn system, and all UI components
    enableTimer: true,
    initialTime: 180,
    timePerMove: 5,
    enableTurnSystem: true,
    turnSystemType: 'player-ai', // Standard player-AI turn system
    showPlayerCard: true,
    showAICard: true,
    showTurnBanner: true,
    showTerminalLog: true,
    showWinnerOverlay: true, // Default winner overlay
    interactionPattern: 'select-then-move', // Click to select, then click destination
    layoutType: 'standard', // Standard 3-panel layout
    boardSize: { rows: 5, cols: 5 }, // 5x5 board for Mini Chess
    // Use default difficulty colors
    difficultyColors: DEFAULT_DIFFICULTY_COLORS,
    // Initial log messages for terminal
    initialLogMessages: [
      "gameRoom.log.monitoring",
      "gameRoom.log.connectionEstablished",
      "gameRoom.log.accessLevel",
    ],
  },
  GAME_2: {
    // ISOLATION: Full-featured game with timer, turn system, and all UI components
    enableTimer: true,
    initialTime: 180,
    timePerMove: 5,
    enableTurnSystem: true,
    turnSystemType: 'player-ai', // Standard player-AI turn system
    showPlayerCard: true,
    showAICard: true,
    showTurnBanner: true,
    showTerminalLog: true,
    showWinnerOverlay: true,
    interactionPattern: 'direct-move', // Direct-move pattern for ISOLATION
    layoutType: 'standard', // Standard 3-panel layout
    boardSize: { rows: 7, cols: 7 }, // 7x7 board for ISOLATION
    difficultyColors: DEFAULT_DIFFICULTY_COLORS,
    // Initial log messages for terminal
    initialLogMessages: [
      "gameRoom.log.monitoring",
      "gameRoom.log.connectionEstablished",
      "gameRoom.log.isolation.initializing",
    ],
  },
  GAME_3: {
    // ENTROPY (Hex): Full-featured game with timer, turn system, and all UI components
    enableTimer: true,
    initialTime: 180,
    timePerMove: 5,
    enableTurnSystem: true,
    turnSystemType: 'player-ai', // Standard player-AI turn system
    showPlayerCard: true,
    showAICard: true,
    showTurnBanner: true,
    showTerminalLog: true,
    showWinnerOverlay: true,
    interactionPattern: 'direct-move', // Direct-move pattern for Hex
    layoutType: 'standard',
    boardSize: { rows: 11, cols: 11 }, // 11x11 hexagonal board
    difficultyColors: DEFAULT_DIFFICULTY_COLORS,
    // Initial log messages for terminal
    initialLogMessages: [
      "gameRoom.log.monitoring",
      "gameRoom.log.connectionEstablished",
      "gameRoom.log.entropy.initializing",
    ],
  },
  GAME_4: {
    // Full-featured game: All UI components enabled
    enableTimer: true,
    initialTime: 180,
    timePerMove: 5,
    enableTurnSystem: true,
    turnSystemType: 'player-ai', // Standard player-AI turn system
    showPlayerCard: true,
    showAICard: true,
    showTurnBanner: true,
    showTerminalLog: true,
    showWinnerOverlay: true,
    interactionPattern: 'select-then-move', // Default pattern, can be customized
    layoutType: 'standard',
    difficultyColors: DEFAULT_DIFFICULTY_COLORS,
  },
  GAME_5: {
    // Full-featured game: All UI components enabled
    enableTimer: true,
    initialTime: 180,
    timePerMove: 5,
    enableTurnSystem: true,
    turnSystemType: 'player-ai', // Standard player-AI turn system
    showPlayerCard: true,
    showAICard: true,
    showTurnBanner: true,
    showTerminalLog: true,
    showWinnerOverlay: true,
    interactionPattern: 'select-then-move', // Default pattern, can be customized
    layoutType: 'standard',
    difficultyColors: DEFAULT_DIFFICULTY_COLORS,
  },
};

/**
 * Default initial log messages (used when game doesn't provide custom messages)
 */
const DEFAULT_INITIAL_LOG_MESSAGES = [
  "gameRoom.log.monitoring",
  "gameRoom.log.connectionEstablished",
  "gameRoom.log.accessLevel",
];

/**
 * Get UI configuration for a specific game type
 * 
 * @param gameType - Type of game
 * @returns UI configuration for the game
 */
export function getGameUIConfig(gameType: GameType): GameUIConfig {
  const config = GAME_UI_CONFIGS[gameType] || GAME_UI_CONFIGS.MINI_CHESS;
  // Ensure layoutType has a default value
  return {
    ...config,
    layoutType: config.layoutType || 'standard',
    // Ensure turnSystemType has a default value (based on enableTurnSystem for backward compatibility)
    turnSystemType: config.turnSystemType || (config.enableTurnSystem ? 'player-ai' : 'none'),
    // Ensure boardSize has a default value (fallback to 5x5 for backward compatibility)
    boardSize: config.boardSize || { rows: 5, cols: 5 },
    // Ensure initialLogMessages has a default value
    initialLogMessages: config.initialLogMessages || DEFAULT_INITIAL_LOG_MESSAGES,
    // Ensure showWinnerOverlay has a default value (default: true)
    showWinnerOverlay: config.showWinnerOverlay !== undefined ? config.showWinnerOverlay : true,
  };
}

/**
 * Get difficulty color configuration for a game
 * Returns game-specific colors if available, otherwise defaults
 * 
 * @param gameType - Type of game
 * @param difficulty - Difficulty level
 * @returns Color configuration for the difficulty level
 */
export function getDifficultyColorConfig(
  gameType: GameType,
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): DifficultyColorConfig {
  const config = getGameUIConfig(gameType);
  if (config.difficultyColors) {
    return config.difficultyColors[difficulty];
  }
  return DEFAULT_DIFFICULTY_COLORS[difficulty];
}
