/**
 * Mini Chess Tutorial Data
 * 
 * Tutorial steps and data specific to Mini Chess game.
 * This allows each game to have its own tutorial content.
 */

import { INITIAL_BOARD_FEN } from "./types";
import type { TutorialStep } from "../TutorialTypes";

export const miniChessTutorialSteps: TutorialStep[] = [
  {
    titleKey: "tutorial.steps.goal.title",
    descriptionKey: "tutorial.steps.goal.description",
    boardState: INITIAL_BOARD_FEN,
  },
  {
    titleKey: "tutorial.steps.pieces.title",
    descriptionKey: "tutorial.steps.pieces.description",
    boardState: INITIAL_BOARD_FEN,
    highlightSquares: [
      { r: 0, c: 2 }, // AI King
      { r: 0, c: 1 }, { r: 0, c: 3 }, // AI Knights
      { r: 0, c: 0 }, { r: 0, c: 4 }, // AI Pawns
      { r: 4, c: 2 }, // Player King
      { r: 4, c: 1 }, { r: 4, c: 3 }, // Player Knights
      { r: 4, c: 0 }, { r: 4, c: 4 }, // Player Pawns
    ],
  },
  {
    titleKey: "tutorial.steps.king.title",
    descriptionKey: "tutorial.steps.king.description",
    boardState: INITIAL_BOARD_FEN,
    animation: {
      from: { r: 4, c: 2 },
      to: { r: 3, c: 2 },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.knight.title",
    descriptionKey: "tutorial.steps.knight.description",
    boardState: "NPKPN/5/5/5/npkpn",
    animation: {
      from: { r: 4, c: 1 },
      to: { r: 2, c: 2 },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.pawn.title",
    descriptionKey: "tutorial.steps.pawn.description",
    boardState: "NPKPN/5/5/5/npkpn",
    animation: {
      from: { r: 4, c: 0 },
      to: { r: 3, c: 0 },
      delay: 1000,
    },
  },
  {
    titleKey: "tutorial.steps.victory.title",
    descriptionKey: "tutorial.steps.victory.description",
    boardState: INITIAL_BOARD_FEN,
  },
  {
    titleKey: "tutorial.steps.start.title",
    descriptionKey: "tutorial.steps.start.description",
    boardState: INITIAL_BOARD_FEN,
  },
];

export const miniChessTutorialStepKeys = [
  { titleKey: "tutorial.steps.goal.title", descriptionKey: "tutorial.steps.goal.description" },
  { titleKey: "tutorial.steps.pieces.title", descriptionKey: "tutorial.steps.pieces.description" },
  { titleKey: "tutorial.steps.king.title", descriptionKey: "tutorial.steps.king.description" },
  { titleKey: "tutorial.steps.knight.title", descriptionKey: "tutorial.steps.knight.description" },
  { titleKey: "tutorial.steps.pawn.title", descriptionKey: "tutorial.steps.pawn.description" },
  { titleKey: "tutorial.steps.victory.title", descriptionKey: "tutorial.steps.victory.description" },
  { titleKey: "tutorial.steps.start.title", descriptionKey: "tutorial.steps.start.description" },
];
