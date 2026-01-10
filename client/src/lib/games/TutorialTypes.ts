/**
 * Tutorial Types
 * 
 * Common type definitions for tutorial system.
 * All games should use these types for their tutorial data.
 */

/**
 * Tutorial step interface
 * All games should use this interface for their tutorial steps
 */
export type TutorialStep = {
  titleKey: string;
  descriptionKey: string;
  boardState?: string;
  highlightSquares?: { r: number; c: number }[];
  animation?: {
    from: { r: number; c: number };
    to: { r: number; c: number };
    delay?: number;
  };
};
