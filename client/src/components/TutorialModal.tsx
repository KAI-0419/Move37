import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Crown, Component, Circle, Target, Zap, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlitchButton } from "@/components/GlitchButton";
import { ChessBoard } from "@/components/ChessBoard";
import { parseFen, INITIAL_BOARD_FEN, generateFen, makeMove } from "@shared/gameLogic";
import { cn } from "@/lib/utils";

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TutorialStep = {
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

const tutorialStepKeys = [
  { titleKey: "tutorial.steps.goal.title", descriptionKey: "tutorial.steps.goal.description" },
  { titleKey: "tutorial.steps.pieces.title", descriptionKey: "tutorial.steps.pieces.description" },
  { titleKey: "tutorial.steps.king.title", descriptionKey: "tutorial.steps.king.description" },
  { titleKey: "tutorial.steps.knight.title", descriptionKey: "tutorial.steps.knight.description" },
  { titleKey: "tutorial.steps.pawn.title", descriptionKey: "tutorial.steps.pawn.description" },
  { titleKey: "tutorial.steps.victory.title", descriptionKey: "tutorial.steps.victory.description" },
  { titleKey: "tutorial.steps.start.title", descriptionKey: "tutorial.steps.start.description" },
];

const tutorialSteps: TutorialStep[] = [
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

export function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [animatedBoard, setAnimatedBoard] = useState<string>(INITIAL_BOARD_FEN);
  const [showAnimation, setShowAnimation] = useState(false);

  const step = tutorialSteps[currentStep];
  const board = parseFen(step.boardState || INITIAL_BOARD_FEN);

  // Handle animation
  useEffect(() => {
    const currentStepData = tutorialSteps[currentStep];
    if (currentStepData.animation) {
      setShowAnimation(false);
      setAnimatedBoard(currentStepData.boardState || INITIAL_BOARD_FEN);
      
      // Start animation after delay
      const timer = setTimeout(() => {
        setShowAnimation(true);
        // Simulate move with smooth transition
        const currentBoard = parseFen(currentStepData.boardState || INITIAL_BOARD_FEN);
        const newBoard = makeMove(
          currentBoard,
          currentStepData.animation!.from,
          currentStepData.animation!.to
        );
        setAnimatedBoard(generateFen(newBoard));
      }, currentStepData.animation.delay || 1000);
      
      return () => clearTimeout(timer);
    } else {
      setAnimatedBoard(currentStepData.boardState || INITIAL_BOARD_FEN);
      setShowAnimation(false);
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setShowAnimation(false);
    } else {
      onOpenChange(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setShowAnimation(false);
    }
  };

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setShowAnimation(false);
      setAnimatedBoard(INITIAL_BOARD_FEN);
    }
  }, [open]);

  const displayBoard = showAnimation && step.animation ? animatedBoard : (step.boardState || INITIAL_BOARD_FEN);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setCurrentStep(0);
        setShowAnimation(false);
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-black/95 border-2 border-primary/30 backdrop-blur-sm shadow-[0_0_30px_rgba(0,243,255,0.2)]">
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
                {/* ChessBoard wrapper - using grid overlay for precise positioning */}
                <div className="relative inline-block mx-auto">
                  <ChessBoard
                    boardString={displayBoard}
                    turn="player"
                    selectedSquare={null}
                    lastMove={step.animation && showAnimation ? {
                      from: step.animation.from,
                      to: step.animation.to
                    } : null}
                    validMoves={[]}
                    onSquareClick={() => {}}
                    isProcessing={false}
                    size="small"
                    difficulty="NEXUS-7"
                  />
                  
                  {/* Highlight squares overlay - using matching grid structure */}
                  {step.highlightSquares && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        // Match ChessBoard structure exactly:
                        // For small size: p-1 (4px) + border-2 (2px on each side) = 6px
                        top: '6px',
                        left: '6px',
                        right: '6px',
                        bottom: '6px',
                      }}
                    >
                      <div className="grid grid-cols-5 grid-rows-5 gap-1 h-full w-full">
                        {Array.from({ length: 25 }).map((_, idx) => {
                          const r = Math.floor(idx / 5);
                          const c = idx % 5;
                          const isHighlighted = step.highlightSquares?.some(
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
                                delay: step.highlightSquares!.findIndex(sq => sq.r === r && sq.c === c) * 0.15 
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
                  {currentStep === 1 && <Component className="w-4 h-4" />}
                  {currentStep === 2 && <Crown className="w-4 h-4" />}
                  {currentStep === 3 && <Component className="w-4 h-4" />}
                  {currentStep === 4 && <Circle className="w-4 h-4" />}
                  {currentStep === 5 && <Clock className="w-4 h-4" />}
                  {currentStep === 6 && <Target className="w-4 h-4" />}
                  {t(step.titleKey)}
                </h3>
                <div className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-line">
                  {t(step.descriptionKey)}
                </div>
              </div>

              {/* Piece Legend */}
              {currentStep === 1 && (
                <div className="border border-white/10 p-3 space-y-2 bg-white/5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">{t("tutorial.legend.king.name")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.king.move")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Component className="w-5 h-5 text-primary rotate-45 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">{t("tutorial.legend.knight.name")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.knight.move")}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">{t("tutorial.legend.pawn.name")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("tutorial.legend.pawn.move")}</div>
                    </div>
                  </div>
                </div>
              )}
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
