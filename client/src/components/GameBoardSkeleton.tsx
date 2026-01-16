/**
 * Game Board Skeleton Components
 *
 * Provides loading skeletons for each game type to ensure smooth UX
 * during game engine initialization. Prevents blank screens and loading spinners.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GameType } from "@shared/schema";

/**
 * Mini Chess Board Skeleton (5x5 grid)
 */
function ChessBoardSkeleton() {
  const BOARD_SIZE = 5;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Board container */}
      <div className="relative">
        {/* Board grid */}
        <div className="grid grid-cols-5 gap-1 bg-black p-4 rounded-lg border border-primary/20">
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
            const row = Math.floor(i / BOARD_SIZE);
            const col = i % BOARD_SIZE;
            const isLight = (row + col) % 2 === 0;

            return (
              <div
                key={i}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-sm border",
                  isLight ? "bg-primary/5 border-primary/10" : "bg-primary/10 border-primary/20"
                )}
              >
                <Skeleton className="w-3/4 h-3/4 rounded-full" />
              </div>
            );
          })}
        </div>

        {/* Board coordinates */}
        <div className="absolute -left-6 top-4 flex flex-col gap-1">
          {['5','4','3','2','1'].map(num => (
            <div key={num} className="h-12 flex items-center">
              <span className="text-xs text-primary/60 font-mono">{num}</span>
            </div>
          ))}
        </div>
        <div className="absolute -bottom-6 left-4 flex gap-1">
          {['a','b','c','d','e'].map(letter => (
            <div key={letter} className="w-12 flex justify-center">
              <span className="text-xs text-primary/60 font-mono">{letter}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game info skeleton */}
      <div className="flex gap-4 text-sm">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * Isolation Board Skeleton (7x7 grid with destroyed tiles)
 */
function IsolationBoardSkeleton() {
  const BOARD_SIZE = 7;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Board container */}
      <div className="relative">
        {/* Board grid */}
        <div className="grid grid-cols-7 gap-1 bg-black p-4 rounded-lg border border-primary/20">
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
            const row = Math.floor(i / BOARD_SIZE);
            const col = i % BOARD_SIZE;
            const isLight = (row + col) % 2 === 0;

            // Simulate some destroyed tiles (random pattern)
            const isDestroyed = Math.random() > 0.8;

            return (
              <div
                key={i}
                className={cn(
                  "aspect-square flex items-center justify-center rounded-sm border relative",
                  isDestroyed
                    ? "bg-red-950/30 border-red-500/30"
                    : isLight ? "bg-primary/5 border-primary/10" : "bg-primary/10 border-primary/20"
                )}
              >
                {isDestroyed ? (
                  <div className="w-1/2 h-1/2 bg-red-500/50 rounded-full animate-pulse" />
                ) : (
                  <Skeleton className="w-2/3 h-2/3 rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Board coordinates */}
        <div className="absolute -left-6 top-2 flex flex-col gap-1">
          {['7','6','5','4','3','2','1'].map(num => (
            <div key={num} className="h-10 flex items-center">
              <span className="text-xs text-primary/60 font-mono">{num}</span>
            </div>
          ))}
        </div>
        <div className="absolute -bottom-6 left-2 flex gap-1">
          {['a','b','c','d','e','f','g'].map(letter => (
            <div key={letter} className="w-10 flex justify-center">
              <span className="text-xs text-primary/60 font-mono">{letter}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game info skeleton */}
      <div className="flex gap-4 text-sm">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/**
 * Entropy Board Skeleton (11x11 hexagonal grid)
 */
function EntropyBoardSkeleton() {
  const BOARD_SIZE = 11;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Board container */}
      <div className="relative">
        {/* Hexagonal grid simulation with staggered rows */}
        <div className="bg-black p-6 rounded-lg border border-primary/20">
          {Array.from({ length: BOARD_SIZE }, (_, row) => (
            <div
              key={row}
              className="flex justify-center mb-1"
              style={{ marginLeft: row % 2 === 1 ? '1.5rem' : '0' }}
            >
              {Array.from({ length: BOARD_SIZE - (row % 2) }, (_, col) => {
                // Simulate some filled cells
                const isFilled = Math.random() > 0.7;
                const isEdge = row === 0 || row === BOARD_SIZE - 1 || col === 0 || col === BOARD_SIZE - (row % 2) - 1;

                return (
                  <div
                    key={col}
                    className="relative"
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      margin: '0 0.1rem',
                      clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)'
                    }}
                  >
                    <div
                      className={cn(
                        "w-full h-full border border-primary/20 flex items-center justify-center",
                        isEdge ? "bg-primary/10" : "bg-primary/5",
                        isFilled && "bg-primary/20"
                      )}
                    >
                      {isFilled && (
                        <Skeleton className="w-3/4 h-3/4 rounded-full" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Edge indicators simulation */}
        <div className="absolute -left-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col gap-2">
            <Skeleton className="w-6 h-16 rounded" />
            <span className="text-xs text-primary/60 font-mono">W</span>
          </div>
        </div>
        <div className="absolute -right-8 top-1/2 -translate-y-1/2">
          <div className="flex flex-col gap-2">
            <Skeleton className="w-6 h-16 rounded" />
            <span className="text-xs text-primary/60 font-mono">B</span>
          </div>
        </div>
      </div>

      {/* Game info skeleton */}
      <div className="flex gap-4 text-sm">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/**
 * Game Board Skeleton Component
 *
 * Shows appropriate loading skeleton based on game type
 */
export function GameBoardSkeleton({ gameType }: { gameType: GameType }) {
  switch (gameType) {
    case "MINI_CHESS":
      return <ChessBoardSkeleton />;

    case "GAME_2":
      return <IsolationBoardSkeleton />;

    case "GAME_3":
      return <EntropyBoardSkeleton />;

    default:
      // Fallback for unknown game types
      return (
        <div className="h-screen w-full bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      );
  }
}