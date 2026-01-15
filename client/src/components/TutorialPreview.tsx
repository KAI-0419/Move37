/**
 * Tutorial Preview Component
 * 
 * Inline tutorial preview that shows animated board demonstrations
 * without requiring a modal. Displays the first tutorial step with
 * automatic animation cycling.
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Play, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameType } from "@shared/schema";
import { GameUIFactory } from "@/lib/games/GameUIFactory";
import { GameEngineFactory } from "@/lib/games/GameEngineFactory";
import { getTutorialSteps, getTutorialInitialBoard, type TutorialStep } from "@/lib/games/TutorialDataFactory";
import { getGameUIConfig } from "@/lib/games/GameUIConfig";
import { EntropyGameplayPreview } from "./EntropyGameplayPreview";
import { MiniChessGameplayPreview } from "./MiniChessGameplayPreview";
import { IsolationGameplayPreview } from "./IsolationGameplayPreview";

interface TutorialPreviewProps {
  gameType: GameType;
  className?: string;
  onOpenTutorial?: () => void;
  onOpenStats?: () => void;
}

function DefaultTutorialPreview({ gameType, className, onOpenTutorial, onOpenStats }: TutorialPreviewProps) {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [animatedBoard, setAnimatedBoard] = useState<string>("");
  const [showAnimation, setShowAnimation] = useState(false);
  const [engine, setEngine] = useState<any>(null);
  const [BoardComponent, setBoardComponent] = useState<any>(null);

  // Get game-specific tutorial data
  const tutorialSteps = useMemo(() => getTutorialSteps(gameType), [gameType]);
  const initialBoard = useMemo(() => getTutorialInitialBoard(gameType), [gameType]);
  const uiConfig = useMemo(() => getGameUIConfig(gameType), [gameType]);
  const boardSize = uiConfig.boardSize || { rows: 5, cols: 5 };

  // Load engine and board component asynchronously
  useEffect(() => {
    let isMounted = true;

    async function loadGameComponents() {
      try {
        const [loadedEngine, loadedBoard] = await Promise.all([
          GameEngineFactory.getEngine(gameType),
          GameUIFactory.getBoardComponent(gameType)
        ]);

        if (isMounted) {
          setEngine(loadedEngine);
          setBoardComponent(() => loadedBoard);
        }
      } catch (error) {
        console.error('Failed to load game components:', error);
      }
    }

    loadGameComponents();

    return () => {
      isMounted = false;
    };
  }, [gameType]);

  // Initialize board
  useEffect(() => {
    if (tutorialSteps.length > 0) {
      const firstStep = tutorialSteps[0];
      setAnimatedBoard(firstStep.boardState || initialBoard);
    } else {
      setAnimatedBoard(initialBoard);
    }
  }, [tutorialSteps, initialBoard]);

  // Auto-cycle through tutorial steps (simplified - just show different board states)
  useEffect(() => {
    if (!isPlaying || tutorialSteps.length === 0 || !engine) return;

    const currentStep = tutorialSteps[currentStepIndex];
    if (!currentStep) return;

    // Reset animation state
    setShowAnimation(false);
    setAnimatedBoard(currentStep.boardState || initialBoard);

    // If step has animation, trigger it after delay
    if (currentStep.animation) {
      const animationTimer = setTimeout(() => {
        setShowAnimation(true);

        // Apply animation move using game engine
        const currentBoardState = currentStep.boardState || initialBoard;
        const newBoardState = engine.makeMove(currentBoardState, {
          from: currentStep.animation!.from,
          to: currentStep.animation!.to
        });
        setAnimatedBoard(newBoardState);
      }, currentStep.animation.delay || 2400);

      // Move to next step after animation completes
      const nextStepTimer = setTimeout(() => {
        setCurrentStepIndex((prev) => (prev + 1) % tutorialSteps.length);
      }, (currentStep.animation.delay || 2400) + 4800);

      return () => {
        clearTimeout(animationTimer);
        clearTimeout(nextStepTimer);
      };
    } else {
      // No animation, just wait and move to next step
      const timer = setTimeout(() => {
        setCurrentStepIndex((prev) => (prev + 1) % tutorialSteps.length);
      }, 7200);

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, isPlaying, tutorialSteps, gameType, initialBoard, engine]);

  const currentStep = tutorialSteps[currentStepIndex] || tutorialSteps[0];
  const displayBoard = showAnimation && currentStep?.animation ? animatedBoard : (currentStep?.boardState || initialBoard);

  // Show loading state while components are loading
  if (!engine || !BoardComponent) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-black/40 border border-white/10 rounded-lg p-8", className)}>
        <p className="text-sm text-muted-foreground font-mono">
          {t("common.loading", "Loading...")}
        </p>
      </div>
    );
  }

  if (tutorialSteps.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-black/40 border border-white/10 rounded-lg p-8", className)}>
        <p className="text-sm text-muted-foreground font-mono">
          {t("tutorial.notAvailable")}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-transparent overflow-hidden", className)}>
      {/* Header with Tutorial and Stats Buttons */}
      <div className="flex items-center justify-between p-4 border-b-2 border-white/20 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded border border-primary/30">
            PREVIEW
          </span>
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

      {/* Board Preview - Visual Only */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <div className="w-[240px] h-[240px] flex items-center justify-center relative">
            <BoardComponent
              boardString={displayBoard}
              turn="player"
              selectedSquare={null}
              lastMove={currentStep?.animation && showAnimation ? {
                from: currentStep.animation.from,
                to: currentStep.animation.to
              } : null}
              validMoves={[]}
              onSquareClick={() => {}}
              isProcessing={false}
              size="small"
              difficulty="NEXUS-7"
              isTutorialMode={true}
            />

            {/* Highlight squares overlay */}
            {currentStep?.highlightSquares && (
              <div className="absolute inset-0 pointer-events-none" style={{ top: '6px', left: '6px', right: '6px', bottom: '6px' }}>
                <div
                  className="grid gap-1 h-full w-full"
                  style={{
                    gridTemplateColumns: `repeat(${boardSize.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${boardSize.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: boardSize.rows * boardSize.cols }).map((_, idx) => {
                    const r = Math.floor(idx / boardSize.cols);
                    const c = idx % boardSize.cols;
                    const isHighlighted = currentStep.highlightSquares?.some(
                      sq => sq.r === r && sq.c === c
                    );

                    if (!isHighlighted) return <div key={idx} />;

                    return (
                      <motion.div
                        key={idx}
                        className="w-full h-full"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.6, 0] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: currentStep.highlightSquares!.findIndex(sq => sq.r === r && sq.c === c) * 0.15
                        }}
                      >
                        <div className="w-full h-full border-2 border-primary/70 bg-primary/20 rounded-sm shadow-[0_0_10px_rgba(0,243,255,0.2)]" />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TutorialPreview({ gameType, className, onOpenTutorial, onOpenStats }: TutorialPreviewProps) {
  // Use cinematic gameplay previews for games with gameplay sequences
  if (gameType === "MINI_CHESS") {
    return (
      <MiniChessGameplayPreview
        gameType={gameType}
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (gameType === "GAME_2") {
    return (
      <IsolationGameplayPreview
        gameType={gameType}
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (gameType === "GAME_3") {
    return (
      <EntropyGameplayPreview
        gameType={gameType}
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  return (
    <DefaultTutorialPreview
      gameType={gameType}
      className={className}
      onOpenTutorial={onOpenTutorial}
      onOpenStats={onOpenStats}
    />
  );
}
