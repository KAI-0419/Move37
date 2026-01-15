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

// Create a dramatic victory board state for STEP 4
// AI completely trapped with many destroyed tiles around
const victoryBoardState = {
  boardSize: { rows: 7, cols: 7 },
  playerPos: { r: 1, c: 1 }, // Player positioned strategically
  aiPos: { r: 3, c: 3 }, // AI trapped in center
  destroyed: [
    // AI 주변 8방향 모두 파괴/막힘
    { r: 2, c: 2 }, { r: 2, c: 3 }, { r: 2, c: 4 },
    { r: 3, c: 2 }, { r: 3, c: 4 },
    { r: 4, c: 2 }, { r: 4, c: 3 }, { r: 4, c: 4 },
    // 추가 파괴 타일로 치열한 전투 표현
    { r: 0, c: 3 }, { r: 0, c: 4 }, { r: 0, c: 5 },
    { r: 1, c: 4 }, { r: 1, c: 5 },
    { r: 2, c: 5 }, { r: 2, c: 6 },
    { r: 3, c: 5 }, { r: 3, c: 6 },
    { r: 4, c: 5 }, { r: 4, c: 6 },
    { r: 5, c: 4 }, { r: 5, c: 5 }, { r: 5, c: 6 },
    { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },
    // 추가 전략적 파괴
    { r: 1, c: 0 }, { r: 2, c: 0 }, { r: 3, c: 0 }, { r: 4, c: 0 },
    { r: 5, c: 2 }, { r: 6, c: 2 },
    { r: 0, c: 1 }, { r: 0, c: 2 },
    { r: 6, c: 0 }, { r: 6, c: 1 },
  ],
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
        r: Math.max(0, tutorialInitialBoard.playerPos.r - 2), // Move 2 squares to show long range
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
    boardState: generateBoardString(victoryBoardState),
  },
  {
    titleKey: "tutorial.steps.isolation.start.title",
    descriptionKey: "tutorial.steps.isolation.start.description",
    boardState: initialBoardState,
    highlightSquares: [
      // No highlights for start tutorial, but we want to show selection
    ],
    // Add selected square to show selection ring and valid moves
    selectedSquare: tutorialInitialBoard.playerPos,
    validMoves: [
      // 7방향으로 이동 가능한 타일 표시 (AI가 있는 방향의 타일 제외)
      // 북쪽 (North)
      { r: 2, c: 2 }, { r: 1, c: 2 }, { r: 0, c: 2 },
      // 북동쪽 (Northeast)
      { r: 2, c: 3 }, { r: 1, c: 4 }, { r: 0, c: 5 },
      // 동쪽 (East) - AI 바로 앞 (3,3)까지는 가능, AI 위치 (3,4)부터 제외
      { r: 3, c: 3 },
      // 남동쪽 (Southeast)
      { r: 4, c: 3 }, { r: 5, c: 4 }, { r: 6, c: 5 },
      // 남쪽 (South)
      { r: 4, c: 2 }, { r: 5, c: 2 }, { r: 6, c: 2 },
      // 남서쪽 (Southwest)
      { r: 4, c: 1 }, { r: 5, c: 0 },
      // 서쪽 (West)
      { r: 3, c: 1 }, { r: 3, c: 0 },
      // 북서쪽 (Northwest)
      { r: 2, c: 1 }, { r: 1, c: 0 },
    ],
  },
];

export const isolationTutorialStepKeys = [
  { titleKey: "tutorial.steps.isolation.goal.title", descriptionKey: "tutorial.steps.isolation.goal.description" },
  { titleKey: "tutorial.steps.isolation.movement.title", descriptionKey: "tutorial.steps.isolation.movement.description" },
  { titleKey: "tutorial.steps.isolation.destroy.title", descriptionKey: "tutorial.steps.isolation.destroy.description" },
  { titleKey: "tutorial.steps.isolation.victory.title", descriptionKey: "tutorial.steps.isolation.victory.description" },
  { titleKey: "tutorial.steps.isolation.start.title", descriptionKey: "tutorial.steps.isolation.start.description" },
];
