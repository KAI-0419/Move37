import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Crown, Component, Circle, Target, Zap } from "lucide-react";
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
  title: string;
  description: string;
  boardState?: string;
  highlightSquares?: { r: number; c: number }[];
  animation?: {
    from: { r: number; c: number };
    to: { r: number; c: number };
    delay?: number;
  };
};

const tutorialSteps: TutorialStep[] = [
  {
    title: "게임 목표",
    description: "5x5 보드에서 AI와 대결하는 전략 게임입니다. 적의 킹을 잡거나, 당신의 킹을 상대 진영 끝(맨 위 줄)으로 보내면 승리합니다.",
    boardState: INITIAL_BOARD_FEN,
  },
  {
    title: "기물 종류",
    description: "각 진영은 5개의 기물을 가지고 있습니다:\n• 킹(K): 가장 중요한 기물. 잡히면 패배합니다.\n• 나이트(N): L자 형태로 이동합니다.\n• 폰(P): 앞으로만 이동하며, 대각선으로 공격합니다.",
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
    title: "킹의 이동",
    description: "킹은 상하좌우 및 대각선으로 1칸씩 이동할 수 있습니다. 킹을 상대 진영 끝(맨 위 줄)으로 보내면 승리합니다!",
    boardState: INITIAL_BOARD_FEN,
    animation: {
      from: { r: 4, c: 2 },
      to: { r: 3, c: 2 },
      delay: 1000,
    },
  },
  {
    title: "나이트의 이동",
    description: "나이트는 L자 형태로 이동합니다. 다른 기물을 뛰어넘을 수 있어 전략적으로 유용합니다.",
    boardState: "NPKPN/5/5/5/npkpn",
    animation: {
      from: { r: 4, c: 1 },
      to: { r: 2, c: 2 },
      delay: 1000,
    },
  },
  {
    title: "폰의 이동",
    description: "폰은 앞으로만 1칸 이동합니다. 하지만 공격할 때는 대각선으로만 공격할 수 있습니다.",
    boardState: "NPKPN/5/5/5/npkpn",
    animation: {
      from: { r: 4, c: 0 },
      to: { r: 3, c: 0 },
      delay: 1000,
    },
  },
  {
    title: "승리 조건",
    description: "승리하는 방법은 두 가지입니다:\n1. 적의 킹을 잡기\n2. 당신의 킹을 맨 위 줄(행 0)로 보내기\n\n30턴 안에 승부가 나지 않으면 무승부입니다.",
    boardState: INITIAL_BOARD_FEN,
  },
  {
    title: "게임 시작",
    description: "기물을 클릭하여 선택하고, 이동할 칸을 클릭하세요. 유효한 이동 가능한 칸은 파란색으로 표시됩니다. 이제 AI와 대결할 준비가 되었습니다!",
    boardState: INITIAL_BOARD_FEN,
  },
];

export function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
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
      
      const timer = setTimeout(() => {
        setShowAnimation(true);
        // Simulate move
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
            TUTORIAL // SYSTEM TRAINING
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
            <span>STEP {currentStep + 1} / {tutorialSteps.length}</span>
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
              
              {/* Animation indicator */}
              {step.animation && !showAnimation && (
                <motion.div
                  className="mt-2 text-[10px] font-mono text-primary/70 flex items-center gap-1.5"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  이동 시뮬레이션 준비 중...
                </motion.div>
              )}
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
                  {currentStep === 5 && <Zap className="w-4 h-4" />}
                  {currentStep === 6 && <Target className="w-4 h-4" />}
                  {step.title}
                </h3>
                <div className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-line">
                  {step.description}
                </div>
              </div>

              {/* Piece Legend */}
              {currentStep === 1 && (
                <div className="border border-white/10 p-3 space-y-2 bg-white/5">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">킹 (King)</div>
                      <div className="text-[10px] text-muted-foreground">상하좌우 대각선 1칸</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Component className="w-5 h-5 text-primary rotate-45 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">나이트 (Knight)</div>
                      <div className="text-[10px] text-muted-foreground">L자 형태 이동</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-primary">폰 (Pawn)</div>
                      <div className="text-[10px] text-muted-foreground">앞으로 1칸, 대각선 공격</div>
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
              이전
            </GlitchButton>

            <div className="text-[10px] font-mono text-muted-foreground">
              {currentStep + 1} / {tutorialSteps.length}
            </div>

            <GlitchButton
              onClick={handleNext}
              className="flex items-center gap-1.5 text-xs py-2 px-3"
            >
              {currentStep === tutorialSteps.length - 1 ? "완료" : "다음"}
              {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </GlitchButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
