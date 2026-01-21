/**
 * Entropy Gameplay Preview Component
 *
 * High-quality cinematic gameplay preview showing automated Hex game.
 * Plays through a predefined sequence at fast speed to showcase the game.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Play, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameType } from "@shared/schema";
import { EntropyBoard } from "@/lib/games/entropy/EntropyBoard";
import { getInitialBoard, generateBoardString, setCellState, cloneBoard } from "@/lib/games/entropy/boardUtils";
import { quickGameplaySequence } from "@/lib/games/entropy/gameplaySequence";
import type { BoardState, Player, Move } from "@/lib/games/entropy/types";

interface EntropyGameplayPreviewProps {
  gameType: GameType;
  className?: string;
  onOpenTutorial?: () => void;
  onOpenStats?: () => void;
}

export function EntropyGameplayPreview({
  gameType,
  className,
  onOpenTutorial,
  onOpenStats,
}: EntropyGameplayPreviewProps) {
  const { t } = useTranslation();
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [boardState, setBoardState] = useState<BoardState>(() => getInitialBoard());
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fast-paced move delay (1680ms for cinematic feel)
  const MOVE_DELAY = 1680;

  // Reset game to initial state (first frame)
  const resetGame = useCallback(() => {
    setCurrentMoveIndex(0);
    setBoardState(getInitialBoard());
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
    setBoardState(getInitialBoard());
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
        setBoardState(getInitialBoard());
        setLastMove(null);
      }, 1000);

      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(() => {
      const move = quickGameplaySequence[currentMoveIndex];

      // Apply move to board
      const newBoard = cloneBoard(boardState);
      const player: Player = currentMoveIndex % 2 === 0 ? 'PLAYER' : 'AI';
      setCellState(newBoard, move, player);
      newBoard.turnCount++;

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
          <div className="w-[280px] h-[280px] flex items-center justify-center">
            <div style={{ transform: 'scale(0.9)', transformOrigin: 'center' }}>
              <EntropyBoard
                boardString={boardString}
                turn={currentMoveIndex % 2 === 0 ? "player" : "ai"}
                selectedSquare={null}
                lastMove={
                  lastMove
                    ? {
                        from: { r: -1, c: -1 },
                        to: lastMove,
                      }
                    : null
                }
                validMoves={[]}
                onSquareClick={() => {}}
                isProcessing={false}
                size="small"
                difficulty="NEXUS-7"
                isPreviewMode={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
