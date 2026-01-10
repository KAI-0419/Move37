import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Cpu, Skull, Brain, Zap, Lock, Languages, Check, Trophy, Activity, Clock, Gamepad2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TutorialModal } from "@/components/TutorialModal";
import { TutorialPreview } from "@/components/TutorialPreview";
import { PlayerStatsModal } from "@/components/PlayerStatsModal";
import { isDifficultyUnlocked, getUnlockedDifficulties } from "@/lib/storage";
import { useResponsive, getCardsToShow } from "@/hooks/use-responsive";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GameType, AVAILABLE_GAMES, loadGameType, saveGameType, getGameInfo } from "@/lib/gameTypes";
import { buildGameRoomUrl } from "@/lib/routing";

// LocalStorage key prefix for selected difficulty (game-specific)
const DIFFICULTY_STORAGE_KEY_PREFIX = "move37_selected_difficulty_";
const GLOBAL_DIFFICULTY_STORAGE_KEY = "move37_selected_difficulty"; // For backward compatibility

// Get storage key for selected difficulty, specific to gameType
function getDifficultyStorageKey(gameType: GameType): string {
  return `${DIFFICULTY_STORAGE_KEY_PREFIX}${gameType}`;
}

// Load difficulty from localStorage (game-specific)
function loadDifficulty(gameType: GameType): "NEXUS-3" | "NEXUS-5" | "NEXUS-7" {
  try {
    // Try game-specific key first
    const gameSpecificKey = getDifficultyStorageKey(gameType);
    const saved = localStorage.getItem(gameSpecificKey);
    if (saved === "NEXUS-3" || saved === "NEXUS-5" || saved === "NEXUS-7") {
      return saved;
    }
    
    // Fallback to global key for backward compatibility
    const globalSaved = localStorage.getItem(GLOBAL_DIFFICULTY_STORAGE_KEY);
    if (globalSaved === "NEXUS-3" || globalSaved === "NEXUS-5" || globalSaved === "NEXUS-7") {
      // Migrate to game-specific key
      localStorage.setItem(gameSpecificKey, globalSaved);
      return globalSaved;
    }
  } catch (error) {
    console.error("Failed to load difficulty from localStorage:", error);
  }
  return "NEXUS-7"; // Default
}

// Save difficulty to localStorage (game-specific)
function saveDifficulty(difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7", gameType: GameType): void {
  try {
    const gameSpecificKey = getDifficultyStorageKey(gameType);
    localStorage.setItem(gameSpecificKey, difficulty);
  } catch (error) {
    console.error("Failed to save difficulty to localStorage:", error);
  }
}

// Game Mode Carousel Component
function GameModeCarousel({
  games,
  selectedGameType,
  onGameTypeChange,
  t,
  disabled = false,
}: {
  games: typeof AVAILABLE_GAMES;
  selectedGameType: GameType;
  onGameTypeChange: (gameType: GameType) => void;
  t: (key: string) => string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const { width } = useResponsive();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate how many cards to show based on screen width (responsive)
  // Mobile (< 640px): 1 card, Small Tablet (640-767px): 1.5 cards, Tablet (768-1023px): 2 cards, Desktop (>= 1024px): 3 cards
  const cardsToShow = useMemo(() => getCardsToShow(width), [width]);
  
  // Calculate card dimensions based on responsive cardsToShow
  // For fractional cards (1.5), we show 1 full card + peek of next
  const effectiveCardsToShow = Math.ceil(cardsToShow);
  
  // Width of each card relative to the visible container (accounts for padding)
  // Each card should take up (100% / cardsToShow) of the visible area
  const cardWidthInParent = 100 / cardsToShow;
  
  // Total width of the moving container to hold all cards
  // We need enough space for all games, each taking up cardWidthInParent
  const totalWidth = games.length * cardWidthInParent;
  
  // Width of each card relative to the moving container (for animation)
  const itemWidth = 100 / games.length;
  
  // Maximum index we can scroll to
  const maxIndex = Math.max(0, games.length - cardsToShow);
  
  // Calculate the actual percentage offset for smooth animation
  // Offset is calculated as a percentage of the moving container's own width
  const getOffset = (index: number) => {
    return -index * itemWidth;
  };
  
  // Snap to card positions
  const snapToIndex = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    setCurrentIndex(clampedIndex);
  };
  
  // Get the game at the center of the visible cards (for Enter key selection)
  const getCenterGameIndex = () => {
    // Return the middle card of the visible cards, or first if only one visible
    const centerOffset = Math.floor(effectiveCardsToShow / 2);
    return Math.min(currentIndex + centerOffset, games.length - 1);
  };
  
  // Reset currentIndex when cardsToShow changes to prevent out-of-bounds
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(Math.max(0, maxIndex));
    }
  }, [maxIndex, currentIndex]);
  
  // Keyboard navigation
  useEffect(() => {
    if (disabled) return; // Disable keyboard navigation when tutorial is open
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex > 0) {
            snapToIndex(currentIndex - 1);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex < maxIndex) {
            snapToIndex(currentIndex + 1);
          }
          break;
        case "Enter":
          e.preventDefault();
          const centerIndex = getCenterGameIndex();
          const game = games[centerIndex];
          if (game && game.available) {
            onGameTypeChange(game.id);
          }
          break;
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex, maxIndex, games, onGameTypeChange, effectiveCardsToShow, disabled]);
  
  // Handle drag end
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50; // Minimum drag distance to trigger slide
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    
    // Use velocity to determine direction if drag distance is ambiguous
    if (Math.abs(velocity) > 500) {
      // High velocity - snap in direction of velocity
      if (velocity > 0 && currentIndex > 0) {
        snapToIndex(currentIndex - 1);
      } else if (velocity < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1);
      } else {
        snapToIndex(currentIndex);
      }
    } else if (Math.abs(offset) > threshold) {
      // Significant drag - snap in direction of drag
      if (offset > 0 && currentIndex > 0) {
        snapToIndex(currentIndex - 1);
      } else if (offset < 0 && currentIndex < maxIndex) {
        snapToIndex(currentIndex + 1);
      } else {
        snapToIndex(currentIndex); // Snap back
      }
    } else {
      snapToIndex(currentIndex); // Snap back if not enough drag
    }
  };
  
  // Navigation handlers
  const handlePrev = () => {
    if (disabled) return;
    if (currentIndex > 0) {
      snapToIndex(currentIndex - 1);
    }
  };
  
  const handleNext = () => {
    if (disabled) return;
    if (currentIndex < maxIndex) {
      snapToIndex(currentIndex + 1);
    }
  };
  
  const canScrollPrev = currentIndex > 0;
  const canScrollNext = currentIndex < maxIndex;
  
  return (
    <div className="relative">
      {/* Carousel Container */}
      <div 
        ref={containerRef}
        className="overflow-hidden relative"
      >
        <motion.div
          className="flex"
          style={{ width: `${totalWidth}%` }}
          drag={disabled ? false : "x"}
          dragConstraints={containerRef}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={{ x: getOffset(currentIndex) + "%" }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 40,
            mass: 0.8
          }}
        >
          {games.map((game) => {
            const isSelected = selectedGameType === game.id;
            const isAvailable = game.available;
            
            return (
              <motion.div
                key={game.id}
                className="flex-shrink-0 px-1 sm:px-2"
                style={{ width: `${itemWidth}%` }}
              >
                <motion.button
                  onClick={() => {
                    if (disabled) return;
                    if (!isAvailable) {
                      if (game.comingSoon) {
                        toast({
                          title: t("lobby.toast.comingSoon"),
                          description: t("lobby.toast.comingSoonDescription"),
                          variant: "default",
                        });
                      }
                      return;
                    }
                    onGameTypeChange(game.id);
                  }}
                  disabled={disabled}
                  whileHover={!isAvailable && !disabled ? { scale: 1.02 } : {}}
                  whileTap={isAvailable && !disabled ? { scale: 0.98 } : {}}
                  className={cn(
                    "w-full p-3 sm:p-4 border transition-all duration-300 text-left relative group rounded-lg h-full",
                    "backdrop-blur-sm touch-manipulation",
                    !isAvailable
                      ? "border-white/30 bg-white/10 cursor-pointer hover:border-primary/40 hover:bg-primary/10"
                      : isSelected
                      ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-[0_0_20px_rgba(0,243,255,0.3)]"
                      : "border-white/10 bg-white/5 hover:border-primary/50 hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                  )}
                >
                  {!isAvailable && game.comingSoon && (
                    <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex items-center gap-1 sm:gap-1.5 bg-black/60 border border-white/20 rounded px-1.5 sm:px-2 py-0.5 sm:py-1 z-10 backdrop-blur-sm">
                      <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary/70 flex-shrink-0" />
                      <span className="text-[7px] sm:text-[8px] text-primary/70 font-mono uppercase tracking-wider">{t("lobby.game.comingSoon")}</span>
                    </div>
                  )}
                  <div className={cn(
                    "text-2xl sm:text-2.5xl lg:text-3xl mb-1.5 sm:mb-2",
                    isAvailable ? "opacity-100" : "opacity-70"
                  )}>
                    {game.icon}
                  </div>
                  <h4 className={cn(
                    "text-[10px] sm:text-xs font-bold mb-0.5 sm:mb-1 line-clamp-1",
                    isAvailable ? "text-foreground" : "text-foreground/80"
                  )}>
                    {t(game.nameKey)}
                  </h4>
                  <p className={cn(
                    "text-[9px] sm:text-[10px] line-clamp-2",
                    isAvailable ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}>
                    {t(game.descriptionKey)}
                  </p>
                  {isSelected && isAvailable && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2"
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
      
      {/* Navigation Controls: Dots Indicator with Navigation Buttons */}
      {maxIndex > 0 && (
        <div className="flex items-center justify-center gap-2 sm:gap-3 mt-3 sm:mt-4">
          {/* Previous Button - Fixed width placeholder to prevent layout shift */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
            {canScrollPrev && !disabled && (
              <motion.button
                onClick={handlePrev}
                className="w-full h-full p-0 flex items-center justify-center bg-black/70 sm:bg-black/60 border border-white/20 rounded-full backdrop-blur-sm hover:bg-black/80 hover:border-primary/50 transition-all touch-manipulation"
                aria-label="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </motion.button>
            )}
          </div>
          
          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: Math.ceil(maxIndex) + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!disabled) {
                    snapToIndex(i);
                  }
                }}
                disabled={disabled}
                className={cn(
                  "h-1.5 rounded-full transition-all touch-manipulation",
                  Math.round(currentIndex) === i ? "bg-primary w-5 sm:w-6" : "bg-white/20 w-1.5 hover:bg-white/40",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
          
          {/* Next Button - Fixed width placeholder to prevent layout shift */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
            {canScrollNext && !disabled && (
              <motion.button
                onClick={handleNext}
                className="w-full h-full p-0 flex items-center justify-center bg-black/70 sm:bg-black/60 border border-white/20 rounded-full backdrop-blur-sm hover:bg-black/80 hover:border-primary/50 transition-all touch-manipulation"
                aria-label="Next"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </motion.button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Lobby() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const { toast } = useToast();
  const [selectedGameType, setSelectedGameType] = useState<GameType>(() => loadGameType());
  const [selectedDifficulty, setSelectedDifficulty] = useState<"NEXUS-3" | "NEXUS-5" | "NEXUS-7">(() => {
    // Only select unlocked difficulty for the selected game type
    const unlocked = getUnlockedDifficulties(selectedGameType);
    const saved = loadDifficulty(selectedGameType); // Pass gameType
    // If saved difficulty is unlocked, use it; otherwise use first unlocked
    if (unlocked.has(saved)) {
      return saved;
    }
    // Default to first unlocked difficulty (should be NEXUS-3)
    return Array.from(unlocked)[0] || "NEXUS-3";
  });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  // Get unlocked difficulties for the selected game type (update when game type changes)
  const unlockedDifficulties = useMemo(() => getUnlockedDifficulties(selectedGameType), [selectedGameType]);
  const [selectedLanguage, setSelectedLanguage] = useState<"ko" | "en">(() => {
    try {
      const stored = localStorage.getItem('move37_language');
      return stored === 'en' ? 'en' : 'ko';
    } catch {
      return 'ko';
    }
  });

  const currentGameInfo = getGameInfo(selectedGameType);

  // Load saved difficulty and unlock status on mount
  useEffect(() => {
    const loadUnlockStatus = () => {
      const savedDifficulty = loadDifficulty(selectedGameType); // Pass gameType
      const unlocked = getUnlockedDifficulties(selectedGameType);
      // unlockedDifficulties is now computed via useMemo, no need to set state
      
      // Only set selected difficulty if it's unlocked
      if (unlocked.has(savedDifficulty)) {
        setSelectedDifficulty(savedDifficulty);
      } else {
        // Default to first unlocked difficulty
        const firstUnlocked = Array.from(unlocked)[0] || "NEXUS-3";
        setSelectedDifficulty(firstUnlocked);
        saveDifficulty(firstUnlocked, selectedGameType); // Pass gameType
      }
    };

    // Load language preference
    try {
      const stored = localStorage.getItem('move37_language');
      if (stored === 'en' || stored === 'ko') {
        setSelectedLanguage(stored);
        i18n.changeLanguage(stored);
      }
    } catch (error) {
      console.error("Failed to load language preference:", error);
    }

    loadUnlockStatus();

    // Listen for storage changes (when unlock status is updated from GameRoom)
    const handleStorageChange = () => {
      loadUnlockStatus();
    };
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event (for same-window updates)
    window.addEventListener('unlock-updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('unlock-updated', handleStorageChange);
    };
  }, [i18n, selectedGameType]);

  // Save difficulty whenever it changes (only if unlocked)
  const handleDifficultyChange = (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
    if (!isDifficultyUnlocked(difficulty, selectedGameType)) {
      const level = difficulty.split('-')[1];
      const previousLevel = level === "5" ? "3" : "5";
      toast({
        title: t("lobby.difficulty.lockedTitle"),
        description: t("lobby.difficulty.lockedMessage", { level: previousLevel }),
        variant: "default",
      });
      return;
    }
    setSelectedDifficulty(difficulty);
    saveDifficulty(difficulty, selectedGameType); // Pass gameType
  };

  const handleGameTypeChange = (gameType: GameType) => {
    const gameInfo = getGameInfo(gameType);
    if (!gameInfo || !gameInfo.available) {
      if (gameInfo?.comingSoon) {
        toast({
          title: t("lobby.toast.comingSoon"),
          description: t("lobby.toast.comingSoonDescription"),
          variant: "default",
        });
      }
      return;
    }
    setSelectedGameType(gameType);
    saveGameType(gameType);
    
    // Update unlocked difficulties when game type changes
    // unlockedDifficulties is now computed via useMemo, automatically updates
    const unlocked = getUnlockedDifficulties(gameType);
    
    // Load saved difficulty for the new game type
    const savedDifficulty = loadDifficulty(gameType);
    
    // Update selected difficulty if current one is not unlocked for new game type
    if (unlocked.has(savedDifficulty)) {
      // Use saved difficulty for this game type
      setSelectedDifficulty(savedDifficulty);
    } else {
      // Default to first unlocked difficulty
      const firstUnlocked = Array.from(unlocked)[0] || "NEXUS-3";
      setSelectedDifficulty(firstUnlocked);
      saveDifficulty(firstUnlocked, gameType);
    }
  };

  const handleStart = async () => {
    try {
      // Ensure game is available before starting
      if (!currentGameInfo?.available) {
        toast({
          title: t("lobby.toast.systemError"),
          description: t("lobby.toast.gameNotAvailable"),
          variant: "destructive",
        });
        return;
      }
      
      // Create game with selected gameType and difficulty
      const game = await createGame.mutateAsync({
        gameType: selectedGameType,
        difficulty: selectedDifficulty,
      });
      // Include gameType in URL for proper routing
      setLocation(buildGameRoomUrl(selectedGameType));
    } catch (error: any) {
      console.error("Failed to create game:", error);
      toast({
        title: t("lobby.toast.systemError"),
        description: error?.message || t("lobby.toast.systemErrorDescription"),
        variant: "destructive",
      });
    }
  };

  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  const handleLanguageChange = (language: "ko" | "en") => {
    setSelectedLanguage(language);
    i18n.changeLanguage(language);
    try {
      localStorage.setItem('move37_language', language);
    } catch (error) {
      console.error("Failed to save language preference:", error);
    }
  };


  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col relative overflow-hidden">
      <Scanlines />
      
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      {/* Header */}
      <header className="z-10 w-full p-4 sm:p-5 lg:p-6 border-b-2 border-white/20 bg-black/60 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <motion.h1 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black font-display tracking-tighter"
          >
            MOVE
            <span className="text-primary ml-1 sm:ml-2 inline-block transform -skew-x-12">37</span>
          </motion.h1>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <span className="w-2 h-2 bg-primary animate-pulse rounded-full flex-shrink-0" />
            <span className="text-primary font-mono text-[10px] sm:text-xs tracking-widest uppercase hidden sm:inline">
              {t("lobby.systemOnline")}
            </span>
            
            {/* Language Settings Button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group rounded"
                  aria-label={t("lobby.accessibility.languageSettings")}
                >
                  <Languages className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="min-w-[140px] bg-black/95 border-white/10 backdrop-blur-sm"
              >
                <DropdownMenuRadioGroup 
                  value={selectedLanguage} 
                  onValueChange={(value) => handleLanguageChange(value as "ko" | "en")}
                >
                  <DropdownMenuRadioItem 
                    value="ko"
                    className="font-mono text-xs cursor-pointer focus:bg-primary/10 focus:text-primary data-[state=checked]:text-primary"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{t("lobby.language.korean")}</span>
                      {selectedLanguage === "ko" && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem 
                    value="en"
                    className="font-mono text-xs cursor-pointer focus:bg-primary/10 focus:text-primary data-[state=checked]:text-primary"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{t("lobby.language.english")}</span>
                      {selectedLanguage === "en" && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </div>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        </div>
      </header>

      {/* Main Content - Reorganized Layout: Mission Configuration Hub */}
      <main className="z-10 flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 min-h-0">
        
        {/* Main Area: Mission Configuration Hub (Action) */}
        <section className="lg:col-span-12 flex flex-col gap-8 h-full min-h-0">
          
          {/* Top Section: Game Mode Selection (Primary Decision) */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-black/60 border-2 border-white/20 rounded-lg p-4 sm:p-5 lg:p-6 backdrop-blur-sm relative shadow-[0_0_30px_rgba(0,243,255,0.1)]"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-5 lg:mb-6 pb-3 sm:pb-4 border-b border-white/20">
              <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                <span className="truncate">{t("lobby.selectGameMode")}</span>
              </h3>
              <div className="h-px flex-1 mx-2 sm:mx-4 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            </div>
            
            <GameModeCarousel
              games={AVAILABLE_GAMES}
              selectedGameType={selectedGameType}
              onGameTypeChange={handleGameTypeChange}
              t={t}
              disabled={tutorialOpen}
            />
          </motion.div>

          {/* Bottom Section: Simulation & Launch Parameters */}
          {currentGameInfo?.available && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8 min-h-0">
              
              {/* Bottom Left: Tutorial Preview / Board Simulation (3/5) */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-3 flex flex-col h-full min-h-0"
              >
                  <div className="h-full min-h-[300px] sm:min-h-[400px] lg:min-h-0 border-2 border-white/20 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,243,255,0.1)] bg-black/40 backdrop-blur-sm">
                  <TutorialPreview 
                    gameType={selectedGameType} 
                    className="h-full border-0 rounded-none bg-transparent"
                    onOpenTutorial={handleTutorial}
                    onOpenStats={() => setStatsModalOpen(true)}
                  />
                </div>
              </motion.div>

              {/* Bottom Right: AI Difficulty & Launch (2/5) */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="lg:col-span-2 flex flex-col gap-4 sm:gap-5 lg:gap-6 h-full min-h-0"
              >
                {/* AI Difficulty Selection */}
                <div className="bg-black/60 border-2 border-white/20 rounded-lg p-4 sm:p-5 backdrop-blur-sm flex-1 overflow-y-auto min-h-0 shadow-[0_0_30px_rgba(0,243,255,0.1)]">
                  <div className="flex items-center justify-between mb-4 sm:mb-5 lg:mb-6 pb-3 sm:pb-4 border-b border-white/20">
                    <h3 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 sm:gap-2">
                      <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
                      <span className="truncate">{t("lobby.selectAIDifficulty")}</span>
                    </h3>
                    <div className="h-px flex-1 mx-2 sm:mx-4 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    {(["NEXUS-3", "NEXUS-5", "NEXUS-7"] as const).map((difficulty) => {
                      const isUnlocked = isDifficultyUnlocked(difficulty, selectedGameType);
                      const isSelected = selectedDifficulty === difficulty;
                      const level = difficulty.split('-')[1];
                      
                      const getDifficultyConfig = () => {
                        switch (difficulty) {
                          case "NEXUS-3":
                            return {
                              icon: Cpu,
                              color: "primary",
                              label: t("lobby.difficulty.easy"),
                            };
                          case "NEXUS-5":
                            return {
                              icon: Cpu,
                              color: "secondary",
                              label: t("lobby.difficulty.medium"),
                            };
                          case "NEXUS-7":
                            return {
                              icon: Skull,
                              color: "destructive",
                              label: t("lobby.difficulty.hard"),
                            };
                        }
                      };
                      
                      const config = getDifficultyConfig();
                      const Icon = config.icon;
                      
                      // Get color classes based on difficulty
                      const getColorClasses = () => {
                        switch (difficulty) {
                          case "NEXUS-3":
                            return {
                              border: "border-primary",
                              borderLocked: "border-primary/40",
                              bg: "bg-primary/10",
                              bgGradient: "bg-gradient-to-br from-primary/20 to-primary/5",
                              bgLocked: "bg-primary/10",
                              hoverBorder: "hover:border-primary/50",
                              hoverBg: "hover:bg-primary/10",
                              text: "text-primary",
                              textLocked: "text-primary/70",
                              textLabel: "text-primary/80",
                              shadow: "shadow-[0_0_15px_rgba(0,243,255,0.3)]",
                            };
                          case "NEXUS-5":
                            return {
                              border: "border-secondary",
                              borderLocked: "border-secondary/40",
                              bg: "bg-secondary/10",
                              bgGradient: "bg-gradient-to-br from-secondary/20 to-secondary/5",
                              bgLocked: "bg-secondary/10",
                              hoverBorder: "hover:border-secondary/50",
                              hoverBg: "hover:bg-secondary/10",
                              text: "text-secondary",
                              textLocked: "text-secondary/70",
                              textLabel: "text-secondary/80",
                              shadow: "shadow-[0_0_15px_rgba(255,200,0,0.3)]",
                            };
                          case "NEXUS-7":
                            return {
                              border: "border-destructive",
                              borderLocked: "border-destructive/40",
                              bg: "bg-destructive/10",
                              bgGradient: "bg-gradient-to-br from-destructive/20 to-destructive/5",
                              bgLocked: "bg-destructive/10",
                              hoverBorder: "hover:border-destructive/50",
                              hoverBg: "hover:bg-destructive/10",
                              text: "text-destructive",
                              textLocked: "text-destructive/70",
                              textLabel: "text-destructive/80",
                              shadow: "shadow-[0_0_15px_rgba(255,0,60,0.3)]",
                            };
                        }
                      };
                      
                      const colors = getColorClasses();
                      
                      return (
                        <motion.button
                          key={difficulty}
                          onClick={() => handleDifficultyChange(difficulty)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={isUnlocked ? { scale: 0.98 } : {}}
                          className={cn(
                            "w-full p-2.5 sm:p-3 border transition-all duration-300 text-left relative rounded-lg",
                            "backdrop-blur-sm",
                            !isUnlocked
                              ? cn(colors.borderLocked, colors.bgLocked, "cursor-pointer hover:border-primary/50 hover:bg-primary/15")
                              : isSelected
                              ? cn(colors.border, colors.bgGradient, colors.shadow)
                              : cn("border-white/10 bg-white/5", colors.hoverBorder, colors.hoverBg)
                          )}
                        >
                          {!isUnlocked && (
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 border border-white/20 rounded px-2 py-1 z-10 backdrop-blur-sm">
                              <Lock className="w-3 h-3 text-primary/70" />
                              <span className="text-[8px] text-primary/70 font-mono uppercase tracking-wider">{t("lobby.difficulty.locked")}</span>
                            </div>
                          )}
                          <div className={cn("flex items-center gap-2 sm:gap-3", !isUnlocked && "opacity-100")}>
                            <Icon className={cn(
                              "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0",
                              isUnlocked 
                                ? isSelected 
                                  ? colors.text
                                  : "text-muted-foreground"
                                : colors.textLocked
                            )} />
                            <div className="flex-1 min-w-0">
                              <h4 className={cn(
                                "text-[10px] sm:text-xs font-bold mb-0.5 truncate",
                                isUnlocked ? "text-foreground" : colors.textLabel
                              )}>
                                {difficulty}
                              </h4>
                              <p className={cn(
                                "text-[9px] sm:text-[10px] line-clamp-1",
                                isUnlocked ? "text-muted-foreground" : colors.textLocked
                              )}>
                                {config.label}
                              </p>
                            </div>
                            {isSelected && isUnlocked && (
                              <Check className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0", colors.text)} />
                            )}
                          </div>
                          {!isUnlocked && (
                            <p className={cn("text-[8px] sm:text-[9px] mt-1.5 sm:mt-2 line-clamp-2", colors.textLocked)}>
                              {t("lobby.difficulty.completePrevious", { level: level === "5" ? "3" : "5" })}
                            </p>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Game Button - Positioned below difficulty selection */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-auto border-2 border-primary/30 rounded-lg p-0.5 sm:p-1 bg-gradient-to-br from-primary/10 to-primary/5 shadow-[0_0_30px_rgba(0,243,255,0.2)]"
                >
                  <GlitchButton 
                    onClick={handleStart} 
                    disabled={createGame.isPending || !currentGameInfo.available}
                    className="w-full h-16 sm:h-18 lg:h-20 text-base sm:text-lg lg:text-xl font-black py-4 sm:py-5 lg:py-6 relative overflow-hidden group"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary via-blue-400 to-primary opacity-0 group-hover:opacity-20 transition-opacity"
                      animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      style={{
                        backgroundSize: "200% 100%",
                      }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {createGame.isPending ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                          />
                          {t("lobby.initializing")}
                        </>
                      ) : (
                        <>
                          {t("lobby.initiateSystem")}
                          <motion.span
                            animate={{ x: [0, 4, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            →
                          </motion.span>
                        </>
                      )}
                    </span>
                  </GlitchButton>
                </motion.div>
              </motion.div>
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-4 sm:py-5 lg:py-6 text-[10px] sm:text-xs font-mono text-white/20 text-center z-10 relative px-4">
        <div className="max-w-7xl mx-auto">
          {t("lobby.footer")}
        </div>
      </footer>

      {/* Tutorial Modal (for full tutorial access) */}
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} gameType={selectedGameType} />
      
      {/* Player Stats Modal */}
      <PlayerStatsModal 
        open={statsModalOpen} 
        onOpenChange={setStatsModalOpen} 
        gameType={selectedGameType} 
      />
    </div>
  );
}
