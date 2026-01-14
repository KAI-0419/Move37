import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Cpu, Skull, Brain, Zap, Lock, Languages, Check, Trophy, Activity, Clock, Gamepad2, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TutorialModal } from "@/components/TutorialModal";
import { TutorialPreview } from "@/components/TutorialPreview";
import { PlayerStatsModal } from "@/components/PlayerStatsModal";
import { SettingsModal } from "@/components/SettingsModal";
import { DifficultySelector } from "@/components/DifficultySelector";
import { GameModeCarousel } from "@/components/GameModeCarousel";
import { isDifficultyUnlocked, getUnlockedDifficulties } from "@/lib/storage";
import { useResponsive, getCardsToShow } from "@/hooks/use-responsive";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GameType, loadGameType, saveGameType, getGameInfo } from "@/lib/gameTypes";
import { buildGameRoomUrl } from "@/lib/routing";
import { Capacitor } from "@capacitor/core";
import { admobService } from "@/lib/admob";

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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
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
          <motion.div
            className="flex flex-col font-display leading-none items-start"
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <span className="font-black tracking-tighter text-white uppercase text-2xl">
              MOVE
              <span className="text-blue-500 ml-1">37</span>
            </span>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <span className="w-2 h-2 bg-primary animate-pulse rounded-full flex-shrink-0" />
            <span className="text-primary font-mono text-[10px] sm:text-xs tracking-widest uppercase hidden sm:inline">
              {t("lobby.systemOnline")}
            </span>
            
            {/* Test Ad Button (Native only) */}
            {Capacitor.isNativePlatform() && (
              <button
                onClick={() => admobService.showInterstitial()}
                className="p-2 border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group rounded"
                title="Test Ad"
              >
                <Zap className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="p-2 border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group rounded"
              aria-label={t("lobby.accessibility.settings", "Settings")}
            >
              <Settings className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

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
                  <div className="h-[450px] sm:h-[500px] md:h-[550px] lg:h-full border-2 border-white/20 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(0,243,255,0.1)] bg-black/40 backdrop-blur-sm">
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
                  <DifficultySelector
                    selectedDifficulty={selectedDifficulty}
                    selectedGameType={selectedGameType}
                    onDifficultyChange={handleDifficultyChange}
                  />
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
}
