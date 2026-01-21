import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Target, Zap, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlitchButton } from "@/components/GlitchButton";
import { KingPiece, KnightPiece, PawnPiece } from "@/components/ChessPieces";
import { cn } from "@/lib/utils";
import type { GameType } from "@shared/schema";
import { GameUIFactory } from "@/lib/games/GameUIFactory";
import { GameEngineFactory } from "@/lib/games/GameEngineFactory";
import { getTutorialSteps, getTutorialStepKeys, getTutorialInitialBoard, type TutorialStep } from "@/lib/games/TutorialDataFactory";
import { DEFAULT_GAME_TYPE } from "@shared/gameConfig";
import { getGameUIConfig } from "@/lib/games/GameUIConfig";

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameType?: GameType;
}

export function TutorialModal({ open, onOpenChange, gameType = DEFAULT_GAME_TYPE }: TutorialModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [engine, setEngine] = useState<any>(null);
  const [BoardComponent, setBoardComponent] = useState<any>(null);

  // Get game-specific tutorial data (re-compute when gameType changes)
  const tutorialSteps = useMemo(() => getTutorialSteps(gameType), [gameType]);
  const tutorialStepKeys = useMemo(() => getTutorialStepKeys(gameType), [gameType]);
  const initialBoard = useMemo(() => getTutorialInitialBoard(gameType), [gameType]);
  const uiConfig = useMemo(() => getGameUIConfig(gameType), [gameType]);
  const boardSize = uiConfig.boardSize || { rows: 5, cols: 5 };

  const [animatedBoard, setAnimatedBoard] = useState<string>(initialBoard);
  const [showAnimation, setShowAnimation] = useState(false);

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

  // Reset to first step when game type changes
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setAnimatedBoard(initialBoard);
      setShowAnimation(false);
    }
  }, [gameType, open, initialBoard]);

  // Handle animation - only when tutorial steps exist
  useEffect(() => {
    if (tutorialSteps.length === 0 || !engine) return;

    const currentStepData = tutorialSteps[currentStep];
    if (!currentStepData) return;

    if (currentStepData.animation) {
      setShowAnimation(false);
      setAnimatedBoard(currentStepData.boardState || initialBoard);

      // Start animation after delay
      const timer = setTimeout(() => {
        setShowAnimation(true);
        // Simulate move with smooth transition using game engine
        const currentBoardState = currentStepData.boardState || initialBoard;
        const newBoardState = engine.makeMove(currentBoardState, {
          from: currentStepData.animation!.from,
          to: currentStepData.animation!.to
        });
        setAnimatedBoard(newBoardState);
      }, currentStepData.animation.delay || 1000);

      return () => clearTimeout(timer);
    } else {
      setAnimatedBoard(currentStepData.boardState || initialBoard);
      setShowAnimation(false);
    }
  }, [currentStep, tutorialSteps, initialBoard, gameType, engine]);

  const handleNext = useCallback(() => {
    if (tutorialSteps.length === 0) return;
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setShowAnimation(false);
    } else {
      onOpenChange(false);
    }
  }, [currentStep, tutorialSteps, onOpenChange]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setShowAnimation(false);
    }
  }, [currentStep]);

  // Reset when modal closes or game type changes
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setShowAnimation(false);
      setAnimatedBoard(initialBoard);
    }
  }, [open, initialBoard]);

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    if (!open || tutorialSteps.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior only for arrow keys
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, tutorialSteps.length, handlePrev, handleNext]);

  // Validate tutorial steps exist - move conditional rendering to JSX
  // Show loading state while components are loading
  if (!engine || !BoardComponent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-black/95 border-2 border-primary/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-black text-primary">
              {t("tutorial.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{t("common.loading", "Loading...")}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (tutorialSteps.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-black/95 border-2 border-primary/30">
          <DialogHeader>
            <DialogTitle className="text-lg font-display font-black text-primary">
              {t("tutorial.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">{t("tutorial.notAvailable")}</p>
            <p className="text-xs mt-2">{t("tutorial.notAvailableDescription")}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const step = tutorialSteps[currentStep] || tutorialSteps[0];

  const displayBoard = showAnimation && step.animation ? animatedBoard : (step.boardState || initialBoard);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCurrentStep(0);
        setShowAnimation(false);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className={cn(
        "max-w-3xl max-h-[85vh] bg-black/95 border-2 border-primary/30 backdrop-blur-sm shadow-[0_0_30px_rgba(0,243,255,0.2)]",
        // 모바일에서는 항상 스크롤 허용, 데스크톱(lg 이상)에서만 6번째 페이지 스크롤 숨김
        currentStep === 5 ? "overflow-y-auto lg:overflow-y-hidden" : "overflow-y-auto"
      )}>
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-display font-black text-primary tracking-wider flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {t("tutorial.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
            <span>{t("tutorial.step", { current: currentStep + 1, total: tutorialSteps.length })}</span>
            <div className="flex gap-1">
              {tutorialSteps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === currentStep ? "bg-primary w-6" : "bg-white/20 w-1.5"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Board */}
            <div className="flex flex-col items-center justify-center p-2 min-w-0 overflow-hidden">
              <div className="relative w-full flex items-center justify-center">
                {/* Game Board wrapper - using grid overlay for precise positioning */}
                <div className="relative inline-block mx-auto">
                  <BoardComponent
                    boardString={displayBoard}
                    turn="player"
                    selectedSquare={step.selectedSquare || null}
                    lastMove={step.animation && showAnimation ? {
                      from: step.animation.from,
                      to: step.animation.to
                    } : null}
                    validMoves={step.validMoves || []}
                    onSquareClick={() => {}}
                    isProcessing={false}
                    size="small"
                    difficulty="NEXUS-7"
                    isTutorialMode={true}
                    highlightSquares={step.highlightSquares || []}
                  />
                  
                  {/* Highlight squares overlay - using matching grid structure */}
                  {step.highlightSquares && gameType !== "GAME_3" && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        // Match board structure exactly:
                        // p-2 (8px) + frame padding (3px) + p-3 (12px) = 23px
                        top: (gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3") ? '23px' : '6px',
                        left: (gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3") ? '23px' : '6px',
                        right: (gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3") ? '23px' : '6px',
                        bottom: (gameType === "MINI_CHESS" || gameType === "GAME_2" || gameType === "GAME_3") ? '23px' : '6px',
                      }}
                    >
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
                          const isHighlighted = step.highlightSquares?.some(
                            (sq: { r: number; c: number }) => sq.r === r && sq.c === c
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
                                delay: step.highlightSquares!.findIndex((sq: { r: number; c: number }) => sq.r === r && sq.c === c) * 0.15
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

            {/* Right: Description */}
            <div className="space-y-3 flex flex-col justify-center">
              <div>
                <h3 className="text-base font-bold text-primary mb-2 flex items-center gap-2">
                  {currentStep === 0 && <Target className="w-4 h-4" />}
                  {currentStep === 1 && <Target className="w-4 h-4" />}
                  {currentStep === 2 && <span className="w-5 h-5 text-primary"><KingPiece /></span>}
                  {currentStep === 3 && <span className="w-5 h-5 text-primary"><PawnPiece /></span>}
                  {currentStep === 4 && <span className="w-5 h-5 text-primary"><KnightPiece /></span>}
                  {currentStep === 5 && <Clock className="w-4 h-4" />}
                  {currentStep === 6 && <Target className="w-4 h-4" />}
                  {t(step.titleKey)}
                </h3>
                <div className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-line">
                  {t(step.descriptionKey)}
                </div>
              </div>

              {/* Piece Legend */}
              <AnimatePresence>
                {currentStep === 1 && gameType === "MINI_CHESS" && (
                  <motion.div
                    className="border border-white/10 p-3 space-y-2 bg-white/5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 text-primary flex-shrink-0"><KingPiece /></span>
                      <div>
                        <div className="text-xs font-bold text-primary">{t("tutorial.legend.king.name")}</div>
                        <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.king.move")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 text-primary flex-shrink-0"><KnightPiece /></span>
                      <div>
                        <div className="text-xs font-bold text-primary">{t("tutorial.legend.knight.name")}</div>
                        <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.knight.move")}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 text-primary flex-shrink-0"><PawnPiece /></span>
                      <div>
                        <div className="text-xs font-bold text-primary">{t("tutorial.legend.pawn.name")}</div>
                        <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.pawn.move")}</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <GlitchButton
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="flex items-center gap-1.5 text-xs py-2 px-3"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {t("tutorial.prev")}
            </GlitchButton>

            <div className="text-[10px] font-mono text-muted-foreground">
              {currentStep + 1} / {tutorialSteps.length}
            </div>

            <GlitchButton
              onClick={handleNext}
              className="flex items-center gap-1.5 text-xs py-2 px-3"
            >
              {currentStep === tutorialSteps.length - 1 ? t("tutorial.complete") : t("tutorial.next")}
              {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </GlitchButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
