/**
 * ENTROPY (Hex) Tutorial Data
 * 
 * Tutorial steps and data specific to ENTROPY (Hex) game.
 */

import type { TutorialStep } from "../TutorialTypes";
import { generateBoardString, getInitialBoard } from "./boardUtils";

// Create a fixed initial board state for tutorial (empty board)
const tutorialInitialBoard = getInitialBoard();
const initialBoardState = generateBoardString(tutorialInitialBoard);

// Create a board state showing a complex player win
const playerWinBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Winning Path (Left to Right)
      if (
        (r === 5 && c === 0) || (r === 5 && c === 1) ||
        (r === 4 && c === 2) || (r === 4 && c === 3) ||
        (r === 5 && c === 3) || (r === 6 && c === 3) || (r === 7 && c === 3) ||
        (r === 7 && c === 4) ||
        (r === 6 && c === 5) || (r === 6 && c === 6) ||
        (r === 5 && c === 7) || (r === 5 && c === 8) ||
        (r === 4 && c === 9) || (r === 4 && c === 10)
      ) {
        return 'PLAYER';
      }

      // AI Blocking attempts / scattered pieces
      if (
        (r === 4 && c === 1) || (r === 6 && c === 1) ||
        (r === 3 && c === 2) || (r === 5 && c === 2) ||
        (r === 8 && c === 2) || (r === 8 && c === 4) ||
        (r === 5 && c === 5) || (r === 7 && c === 5) ||
        (r === 4 && c === 8) || (r === 6 && c === 8) ||
        (r === 3 && c === 10) || (r === 5 && c === 10) ||
        (r === 2 && c === 5) || (r === 8 && c === 7) ||
        (r === 1 && c === 4) || (r === 9 && c === 6)
      ) {
        return 'AI';
      }

      // Extra random pieces for complexity
      if ((r === 2 && c === 2) || (r === 9 && c === 9)) return 'PLAYER';
      if ((r === 1 && c === 8) || (r === 8 && c === 1)) return 'AI';

      return cell;
    })
  ),
  turnCount: 45, // Simulate late game
};

// Create a board state showing player's goal (left-right connection)
const playerGoalBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Show a path from left to right
      if (r === 5 && c <= 5) return 'PLAYER';
      return cell;
    })
  ),
  turnCount: 0,
};

// Create a board state showing a winding player path (left-right)
const windingPathBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Create a winding path:
      // (5,0), (5,1) -> (4,2), (4,3) -> (5,4) -> (6,5), (6,6) -> (5,7), (5,8) -> (4,9) -> (5,10)
      if ((r === 5 && (c === 0 || c === 1 || c === 4 || c === 7 || c === 8 || c === 10)) ||
        (r === 4 && (c === 2 || c === 3 || c === 9)) ||
        (r === 6 && (c === 5 || c === 6))) {
        return 'PLAYER';
      }
      return cell;
    })
  ),
  turnCount: 0,
};

// Create a board state showing AI blocking (topology/invisible wall)
const blockedBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Player trying to connect from left and right
      if (r === 5 && c < 4) return 'PLAYER';
      if (r === 5 && c > 6) return 'PLAYER';

      // AI blocking wall in the middle
      if (c === 5 && r >= 2 && r <= 8) return 'AI';

      return cell;
    })
  ),
  turnCount: 0,
};

// Create a board state showing AI's goal (top-bottom winding connection)
const aiGoalBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Show a winding path from top to bottom
      // (0,5), (1,5) -> (2,6), (3,6) -> (4,5) -> (5,4), (6,4) -> (7,5), (8,5) -> (9,6), (10,6)
      if ((c === 5 && (r === 0 || r === 1 || r === 4 || r === 7 || r === 8)) ||
        (c === 6 && (r === 2 || r === 3 || r === 9 || r === 10)) ||
        (c === 4 && (r === 5 || r === 6))) {
        return 'AI';
      }
      return cell;
    })
  ),
  turnCount: 0,
};

// Create a board state showing a move example
const moveExampleBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Empty board for step 5 to show placement animation
      return cell;
    })
  ),
  turnCount: 0,
};

// Create a board state showing the hexagonal grid structure and 6-neighbor connectivity
const hexGridBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) =>
    row.map((cell, c) => {
      // Center piece to demonstrate neighbors
      if (r === 5 && c === 5) return 'PLAYER';

      // Some neighbors filled to show interaction
      if (r === 4 && c === 5) return 'PLAYER'; // Top-left neighbor
      if (r === 6 && c === 6) return 'AI';     // Bottom-right neighbor
      if (r === 5 && c === 4) return 'PLAYER'; // Left neighbor

      // Decorative pieces to show the grid pattern elsewhere
      if ((r === 2 && c === 3) || (r === 8 && c === 8)) return 'AI';
      if ((r === 3 && c === 7) || (r === 7 && c === 2)) return 'PLAYER';

      return cell;
    })
  ),
  turnCount: 12,
};

export const entropyTutorialSteps: TutorialStep[] = [
  {
    titleKey: "tutorial.steps.entropy.goal.title",
    descriptionKey: "tutorial.steps.entropy.goal.description",
    boardState: generateBoardString(playerWinBoard),
  },
  {
    titleKey: "tutorial.steps.entropy.hexGrid.title",
    descriptionKey: "tutorial.steps.entropy.hexGrid.description",
    boardState: initialBoardState,
    highlightSquares: Array.from({ length: 11 }, (_, r) =>
      Array.from({ length: 11 }, (_, c) => ({ r, c }))
    ).flat(),
  },
  {
    titleKey: "tutorial.steps.entropy.playerGoal.title",
    descriptionKey: "tutorial.steps.entropy.playerGoal.description",
    boardState: generateBoardString(windingPathBoard),
    highlightSquares: [
      // Highlight the winding connection path
      { r: 5, c: 0 }, { r: 5, c: 1 },
      { r: 4, c: 2 }, { r: 4, c: 3 },
      { r: 5, c: 4 },
      { r: 6, c: 5 }, { r: 6, c: 6 },
      { r: 5, c: 7 }, { r: 5, c: 8 },
      { r: 4, c: 9 },
      { r: 5, c: 10 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.aiGoal.title",
    descriptionKey: "tutorial.steps.entropy.aiGoal.description",
    boardState: generateBoardString(aiGoalBoard),
    highlightSquares: [
      // Highlight the AI winding connection path
      { r: 0, c: 5 }, { r: 1, c: 5 },
      { r: 2, c: 6 }, { r: 3, c: 6 },
      { r: 4, c: 5 },
      { r: 5, c: 4 }, { r: 6, c: 4 },
      { r: 7, c: 5 }, { r: 8, c: 5 },
      { r: 9, c: 6 }, { r: 10, c: 6 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.makingMoves.title",
    descriptionKey: "tutorial.steps.entropy.makingMoves.description",
    boardState: initialBoardState,
    highlightSquares: [
      { r: 5, c: 5 }, // Highlight target square
    ],
    animation: {
      from: { r: -1, c: -1 }, // Placement animation
      to: { r: 5, c: 5 },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.entropy.connection.title",
    descriptionKey: "tutorial.steps.entropy.connection.description",
    boardState: generateBoardString(windingPathBoard),
    highlightSquares: [
      // Highlight connected pieces
      { r: 5, c: 0 }, { r: 5, c: 1 },
      { r: 4, c: 2 }, { r: 4, c: 3 },
      { r: 5, c: 4 },
      { r: 6, c: 5 }, { r: 6, c: 6 },
      { r: 5, c: 7 }, { r: 5, c: 8 },
      { r: 4, c: 9 },
      { r: 5, c: 10 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.topology.title",
    descriptionKey: "tutorial.steps.entropy.topology.description",
    boardState: generateBoardString(blockedBoard),
    highlightSquares: [
      // Highlight the AI wall
      { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 4, c: 5 }, { r: 5, c: 5 }, { r: 6, c: 5 }, { r: 7, c: 5 }, { r: 8, c: 5 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.start.title",
    descriptionKey: "tutorial.steps.entropy.start.description",
    boardState: initialBoardState,
  },
];

export const entropyTutorialStepKeys = [
  { titleKey: "tutorial.steps.entropy.goal.title", descriptionKey: "tutorial.steps.entropy.goal.description" },
  { titleKey: "tutorial.steps.entropy.hexGrid.title", descriptionKey: "tutorial.steps.entropy.hexGrid.description" },
  { titleKey: "tutorial.steps.entropy.playerGoal.title", descriptionKey: "tutorial.steps.entropy.playerGoal.description" },
  { titleKey: "tutorial.steps.entropy.aiGoal.title", descriptionKey: "tutorial.steps.entropy.aiGoal.description" },
  { titleKey: "tutorial.steps.entropy.makingMoves.title", descriptionKey: "tutorial.steps.entropy.makingMoves.description" },
  { titleKey: "tutorial.steps.entropy.connection.title", descriptionKey: "tutorial.steps.entropy.connection.description" },
  { titleKey: "tutorial.steps.entropy.topology.title", descriptionKey: "tutorial.steps.entropy.topology.description" },
  { titleKey: "tutorial.steps.entropy.start.title", descriptionKey: "tutorial.steps.entropy.start.description" },
];
