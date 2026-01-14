/**
 * SVG Chess Piece Components
 *
 * Custom SVG icons for chess pieces that render consistently across all platforms.
 * Uses currentColor for CSS color inheritance, avoiding Android emoji rendering issues.
 */

import { cn } from "@/lib/utils";

interface ChessPieceProps {
  className?: string;
}

/**
 * King piece (♚)
 * Simple crown-like design with cross on top
 */
export function KingPiece({ className }: ChessPieceProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      fill="currentColor"
      className={cn("w-full h-full", className)}
      style={{ filter: "inherit" }}
    >
      {/* Cross on top */}
      <path
        d="M22.5 11.63V6M20 8h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Crown body */}
      <path
        d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base crown */}
      <path
        d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Base */}
      <path
        d="M12.5 30c5.5-3 14.5-3 20 0M12.5 33.5c5.5-3 14.5-3 20 0M12.5 37c5.5-3 14.5-3 20 0"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Knight piece (♞)
 * Horse head silhouette
 */
export function KnightPiece({ className }: ChessPieceProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      fill="currentColor"
      className={cn("w-full h-full", className)}
      style={{ filter: "inherit" }}
    >
      {/* Horse head and neck */}
      <path
        d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eye */}
      <circle cx="17" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
      {/* Mane detail */}
      <path
        d="M30 15.5c2.5-2.5 5.5-1.5 6 0 .5 1.5-1 2-2 1.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Pawn piece (♟)
 * Simple pawn silhouette
 */
export function PawnPiece({ className }: ChessPieceProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      fill="currentColor"
      className={cn("w-full h-full", className)}
      style={{ filter: "inherit" }}
    >
      {/* Head */}
      <circle cx="22.5" cy="12" r="6" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
      {/* Neck and body */}
      <path
        d="M22.5 18c-5 3-7.5 6-7.5 10h15c0-4-2.5-7-7.5-10z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base */}
      <path
        d="M12 36c0-3 2-4 3-5.5 1-1.5 2-2.5 2-5.5h11c0 3 1 4 2 5.5 1 1.5 3 2.5 3 5.5H12z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Base line */}
      <path
        d="M12 36h21"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Queen piece (♛)
 * Crown with multiple points
 */
export function QueenPiece({ className }: ChessPieceProps) {
  return (
    <svg
      viewBox="0 0 45 45"
      fill="currentColor"
      className={cn("w-full h-full", className)}
      style={{ filter: "inherit" }}
    >
      {/* Crown points with balls */}
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      <circle cx="14" cy="9" r="2.5" fill="currentColor" />
      <circle cx="22.5" cy="8" r="2.5" fill="currentColor" />
      <circle cx="31" cy="9" r="2.5" fill="currentColor" />
      <circle cx="39" cy="12" r="2.5" fill="currentColor" />
      {/* Crown body */}
      <path
        d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-8.5-14.5-8.5 14.5-7.5-13.5L9 26z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Base */}
      <path
        d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Base lines */}
      <path
        d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}

/**
 * Generic piece selector component
 */
export function ChessPiece({ type, className }: { type: string; className?: string }) {
  switch (type.toLowerCase()) {
    case 'k':
      return <KingPiece className={className} />;
    case 'n':
      return <KnightPiece className={className} />;
    case 'p':
      return <PawnPiece className={className} />;
    case 'q':
      return <QueenPiece className={className} />;
    default:
      return null;
  }
}
