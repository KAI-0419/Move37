/**
 * ISOLATION Tutorial Data
 * 
 * Tutorial steps and data specific to ISOLATION game.
 */

import type { TutorialStep } from "../TutorialTypes";
import { generateBoardString } from "./boardUtils";

// Create a fixed initial board state for tutorial (consistent positioning)
// Player at center-left, AI at center-right for better visualization
const tutorialInitialBoard = {
  boardSize: { rows: 7, cols: 7 },
  playerPos: { r: 3, c: 2 },
  aiPos: { r: 3, c: 4 },
  destroyed: [],
};

const initialBoardState = generateBoardString(tutorialInitialBoard);

export const isolationTutorialSteps: TutorialStep[] = [
  {
    titleKey: "tutorial.steps.isolation.goal.title",
    descriptionKey: "tutorial.steps.isolation.goal.description",
    boardState: initialBoardState,
  },
  {
    titleKey: "tutorial.steps.isolation.movement.title",
    descriptionKey: "tutorial.steps.isolation.movement.description",
    boardState: initialBoardState,
    highlightSquares: [
      { r: tutorialInitialBoard.playerPos.r, c: tutorialInitialBoard.playerPos.c }, // Player position
    ],
    animation: {
      from: tutorialInitialBoard.playerPos,
      to: {
        r: Math.max(0, tutorialInitialBoard.playerPos.r - 1),
        c: tutorialInitialBoard.playerPos.c,
      },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.isolation.destroy.title",
    descriptionKey: "tutorial.steps.isolation.destroy.description",
    boardState: initialBoardState,
    highlightSquares: [
      { r: tutorialInitialBoard.playerPos.r, c: tutorialInitialBoard.playerPos.c }, // Player position
    ],
  },
  {
    titleKey: "tutorial.steps.isolation.victory.title",
    descriptionKey: "tutorial.steps.isolation.victory.description",
    boardState: initialBoardState,
  },
  {
    titleKey: "tutorial.steps.isolation.start.title",
    descriptionKey: "tutorial.steps.isolation.start.description",
    boardState: initialBoardState,
  },
];

export const isolationTutorialStepKeys = [
  { titleKey: "tutorial.steps.isolation.goal.title", descriptionKey: "tutorial.steps.isolation.goal.description" },
  { titleKey: "tutorial.steps.isolation.movement.title", descriptionKey: "tutorial.steps.isolation.movement.description" },
  { titleKey: "tutorial.steps.isolation.destroy.title", descriptionKey: "tutorial.steps.isolation.destroy.description" },
  { titleKey: "tutorial.steps.isolation.victory.title", descriptionKey: "tutorial.steps.isolation.victory.description" },
  { titleKey: "tutorial.steps.isolation.start.title", descriptionKey: "tutorial.steps.isolation.start.description" },
];
