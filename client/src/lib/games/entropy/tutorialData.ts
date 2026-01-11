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

// Create a board state showing AI's goal (top-bottom connection)
const aiGoalBoard = {
  ...tutorialInitialBoard,
  cells: tutorialInitialBoard.cells.map((row, r) => 
    row.map((cell, c) => {
      // Show a path from top to bottom
      if (c === 5 && r <= 5) return 'AI';
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
      // Place a player piece in the center-left
      if (r === 5 && c === 2) return 'PLAYER';
      return cell;
    })
  ),
  turnCount: 1,
};

export const entropyTutorialSteps: TutorialStep[] = [
  {
    titleKey: "tutorial.steps.entropy.goal.title",
    descriptionKey: "tutorial.steps.entropy.goal.description",
    boardState: initialBoardState,
    highlightSquares: [
      // Highlight left and right edges
      ...Array.from({ length: 11 }, (_, r) => ({ r, c: 0 })),
      ...Array.from({ length: 11 }, (_, r) => ({ r, c: 10 })),
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.hexGrid.title",
    descriptionKey: "tutorial.steps.entropy.hexGrid.description",
    boardState: initialBoardState,
    highlightSquares: [
      { r: 5, c: 5 }, // Center cell
      { r: 4, c: 5 }, { r: 6, c: 5 }, // Top and bottom neighbors
      { r: 5, c: 4 }, { r: 5, c: 6 }, // Left and right neighbors
      { r: 4, c: 6 }, { r: 6, c: 4 }, // Diagonal neighbors (hexagonal)
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.playerGoal.title",
    descriptionKey: "tutorial.steps.entropy.playerGoal.description",
    boardState: generateBoardString(playerGoalBoard),
    highlightSquares: [
      // Highlight the connection path
      { r: 5, c: 0 }, { r: 5, c: 1 }, { r: 5, c: 2 }, { r: 5, c: 3 }, { r: 5, c: 4 }, { r: 5, c: 5 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.aiGoal.title",
    descriptionKey: "tutorial.steps.entropy.aiGoal.description",
    boardState: generateBoardString(aiGoalBoard),
    highlightSquares: [
      // Highlight the connection path
      { r: 0, c: 5 }, { r: 1, c: 5 }, { r: 2, c: 5 }, { r: 3, c: 5 }, { r: 4, c: 5 }, { r: 5, c: 5 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.makingMoves.title",
    descriptionKey: "tutorial.steps.entropy.makingMoves.description",
    boardState: generateBoardString(moveExampleBoard),
    highlightSquares: [
      { r: 5, c: 2 }, // Player piece
    ],
    animation: {
      from: { r: 5, c: 2 },
      to: { r: 5, c: 3 },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.entropy.connection.title",
    descriptionKey: "tutorial.steps.entropy.connection.description",
    boardState: generateBoardString(playerGoalBoard),
    highlightSquares: [
      // Highlight connected pieces
      { r: 5, c: 0 }, { r: 5, c: 1 }, { r: 5, c: 2 }, { r: 5, c: 3 }, { r: 5, c: 4 }, { r: 5, c: 5 },
    ],
  },
  {
    titleKey: "tutorial.steps.entropy.topology.title",
    descriptionKey: "tutorial.steps.entropy.topology.description",
    boardState: initialBoardState,
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
