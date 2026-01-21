/**
 * Isolation Gameplay Preview Component
 *
 * High-quality cinematic gameplay preview showing automated Isolation game.
 * Plays through a predefined sequence at fast speed to showcase the game.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Play, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameType } from "@shared/schema";
import { IsolationBoard } from "@/lib/games/isolation/IsolationBoard";
import { generateBoardString } from "@/lib/games/isolation/boardUtils";
import {
  PREVIEW_INITIAL_BOARD,
  quickGameplaySequence,
  type IsolationGameplayMove
} from "@/lib/games/isolation/gameplaySequence";
import type { BoardState } from "@/lib/games/isolation/types";

interface IsolationGameplayPreviewProps {
  gameType: GameType;
  className?: string;
  onOpenTutorial?: () => void;
  onOpenStats?: () => void;
}

export function IsolationGameplayPreview({
  gameType,
  className,
  onOpenTutorial,
  onOpenStats,
}: IsolationGameplayPreviewProps) {
  const { t } = useTranslation();
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [boardState, setBoardState] = useState<BoardState>(() => ({ ...PREVIEW_INITIAL_BOARD }));
  const [lastMove, setLastMove] = useState<IsolationGameplayMove | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fast-paced move delay (1680ms for cinematic feel)
  const MOVE_DELAY = 1680;

  // Reset game to initial state (first frame)
  const resetGame = useCallback(() => {
    setCurrentMoveIndex(0);
    setBoardState({ ...PREVIEW_INITIAL_BOARD });
    setLastMove(null);
    setIsPlaying(false);
  }, []);

  // Intersection Observer: Start playing when 90% visible (only once)
  useEffect(() => {
    if (hasPlayedOnce || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasPlayedOnce) {
            setIsPlaying(true);
          }
        });
      },
      {
        threshold: 0.9, // Trigger when 90% of the preview is visible
        rootMargin: '0px',
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasPlayedOnce]);

  // Reset when gameType changes (component remount or game selection change)
  useEffect(() => {
    setHasPlayedOnce(false);
    setIsPlaying(false);
    setCurrentMoveIndex(0);
    setBoardState({ ...PREVIEW_INITIAL_BOARD });
    setLastMove(null);
  }, [gameType]);

  // Auto-play game sequence (single playthrough only)
  useEffect(() => {
    if (!isPlaying) return;

    // Check if we've reached the end
    if (currentMoveIndex >= quickGameplaySequence.length) {
      // Mark as played and stop
      setHasPlayedOnce(true);
      setIsPlaying(false);

      // Reset to initial state (first frame) after a short delay
      const resetTimer = setTimeout(() => {
        setCurrentMoveIndex(0);
        setBoardState({ ...PREVIEW_INITIAL_BOARD });
        setLastMove(null);
      }, 1000);

      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(() => {
      const move = quickGameplaySequence[currentMoveIndex];

      // Apply move to board
      const newBoard: BoardState = {
        ...boardState,
        // Update player or AI position based on turn
        playerPos: currentMoveIndex % 2 === 0 ? move.to : boardState.playerPos,
        aiPos: currentMoveIndex % 2 === 1 ? move.to : boardState.aiPos,
        // Add destroyed cell
        destroyed: [...boardState.destroyed, move.destroy],
      };

      setBoardState(newBoard);
      setLastMove(move);

      setCurrentMoveIndex(prev => prev + 1);
    }, MOVE_DELAY);

    return () => clearTimeout(timer);
  }, [currentMoveIndex, isPlaying, boardState]);

  const boardString = useMemo(() => generateBoardString(boardState), [boardState]);

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
  };

  return (
    <div ref={containerRef} className={cn("flex flex-col h-full bg-transparent overflow-hidden", className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b-2 border-white/20 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-[10px] font-mono text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded border border-primary/30 cursor-pointer select-none"
            animate={{
              boxShadow: [
                "0 0 10px rgba(0, 243, 255, 0.2)",
                "0 0 20px rgba(0, 243, 255, 0.4)",
                "0 0 10px rgba(0, 243, 255, 0.2)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePlay}
          >
            PREVIEW
          </motion.span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenStats && (
            <motion.button
              onClick={onOpenStats}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 text-xs font-bold text-secondary border border-secondary/50 bg-secondary/10 hover:bg-secondary/20 hover:border-secondary transition-all duration-300 rounded flex items-center gap-2"
            >
              <BarChart3 className="w-3 h-3" />
              {t("lobby.stats.title")}
            </motion.button>
          )}

          {onOpenTutorial && (
            <motion.button
              onClick={onOpenTutorial}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/50 bg-primary/10 hover:bg-primary/20 hover:border-primary transition-all duration-300 rounded flex items-center gap-2"
            >
              <Play className="w-3 h-3" />
              {t("lobby.tutorial")}
            </motion.button>
          )}
        </div>
      </div>

      {/* Board with cinematic effects */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-black/60 via-black/40 to-black/60">
        {/* Ambient glow effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              "radial-gradient(circle at 30% 30%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 70% 70%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 30% 30%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative z-10 max-w-full max-h-full flex items-center justify-center">
          <div className="w-[240px] h-[240px] flex items-center justify-center">
            <IsolationBoard
              boardString={boardString}
              turn={currentMoveIndex % 2 === 0 ? "player" : "ai"}
              selectedSquare={null}
              lastMove={
                lastMove
                  ? {
                      from: lastMove.from,
                      to: lastMove.to,
                    }
                  : null
              }
              validMoves={[]}
              onSquareClick={() => {}}
              isProcessing={false}
              size="small"
              difficulty="NEXUS-7"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
