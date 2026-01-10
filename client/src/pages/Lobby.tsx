import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { motion } from "framer-motion";
import { Cpu, Skull, Brain, Zap, Lock, Languages, Check, Trophy, Activity, Clock, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TutorialModal } from "@/components/TutorialModal";
import { isDifficultyUnlocked, getUnlockedDifficulties, getAllGames } from "@/lib/storage";
import { StatCard } from "@/components/StatCard";
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

// Calculate player statistics from game history
// Now supports gameType filtering for game-specific statistics
function calculatePlayerStats(gameType?: "MINI_CHESS" | "GAME_2" | "GAME_3" | "GAME_4" | "GAME_5") {
  const games = getAllGames();
  
  // Filter by gameType if provided
  const filteredGames = gameType ? games.filter(g => g.gameType === gameType) : games;
  
  // Filter completed games (winner is not null)
  const completedGames = filteredGames.filter(g => g.winner !== null);
  
  // CRITICAL: Sort by createdAt (most recent first) for accurate streak calculation
  // This ensures we calculate streak from the most recent game backwards
  const sortedCompletedGames = [...completedGames].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA; // Descending order (newest first)
  });
  
  // Calculate total games
  const totalGames = sortedCompletedGames.length;
  
  // Calculate wins, losses, draws with validation
  const wins = sortedCompletedGames.filter(g => g.winner === 'player').length;
  const losses = sortedCompletedGames.filter(g => g.winner === 'ai').length;
  const draws = sortedCompletedGames.filter(g => g.winner === 'draw').length;
  
  // Data integrity check: wins + losses + draws should equal totalGames
  // If not, there might be invalid data (winner with unexpected value)
  const sumCheck = wins + losses + draws;
  if (sumCheck !== totalGames && totalGames > 0) {
    console.warn(`Statistics data inconsistency: wins(${wins}) + losses(${losses}) + draws(${draws}) = ${sumCheck}, but totalGames = ${totalGames}`);
  }
  
  // Calculate win rate (only count valid completed games)
  const validTotalGames = sumCheck; // Use sumCheck for accuracy
  const winRate = validTotalGames > 0 ? (wins / validTotalGames) * 100 : 0;
  
  // Calculate current win streak (from most recent game backwards)
  // Since games are sorted newest first, we iterate from index 0
  let currentStreak = 0;
  for (let i = 0; i < sortedCompletedGames.length; i++) {
    if (sortedCompletedGames[i].winner === 'player') {
      currentStreak++;
    } else {
      break; // Streak broken
    }
  }
  
  // Calculate average turns
  // For completed games, turnCount should be >= 1, but handle edge cases
  // Use all completed games, but ensure turnCount is at least 1 (default to 1 if 0 or missing)
  const gamesWithValidTurns = sortedCompletedGames.map(g => ({
    ...g,
    turnCount: Math.max(1, g.turnCount ?? 1) // Ensure minimum 1 turn for completed games
  }));
  
  const avgTurns = gamesWithValidTurns.length > 0
    ? gamesWithValidTurns.reduce((sum, g) => sum + g.turnCount, 0) / gamesWithValidTurns.length
    : 0;
  
  // Calculate games that went to endgame (20+ turns)
  // Use original turnCount for this calculation (not the adjusted one)
  const endgameGames = sortedCompletedGames.filter(g => {
    const turnCount = g.turnCount ?? 0;
    return turnCount >= 20; // Only count games that actually reached 20+ turns
  });
  const endgameWinRate = endgameGames.length > 0
    ? (endgameGames.filter(g => g.winner === 'player').length / endgameGames.length) * 100
    : 0;
  
  // Calculate average game duration (estimate based on turn count)
  // Assuming average 5 seconds per turn
  const avgGameDuration = avgTurns * 5;
  
  return {
    totalGames: validTotalGames, // Use validated total
    wins,
    losses,
    draws,
    winRate,
    currentStreak,
    avgTurns,
    endgameWinRate,
    avgGameDuration,
  };
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
  
  // Calculate player statistics with state for reactivity
  // Statistics are now filtered by selected game type and update automatically when game type changes
  const [statsUpdateTrigger, setStatsUpdateTrigger] = useState(0);
  const playerStats = useMemo(() => calculatePlayerStats(selectedGameType), [selectedGameType, statsUpdateTrigger]);
  
  // Update stats when storage changes (game completed) or game type changes
  useEffect(() => {
    const handleStorageChange = () => {
      // Force re-render by updating trigger
      setStatsUpdateTrigger(prev => prev + 1);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('unlock-updated', handleStorageChange);
    
    // Also listen for custom stats update event
    window.addEventListener('stats-updated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('unlock-updated', handleStorageChange);
      window.removeEventListener('stats-updated', handleStorageChange);
    };
  }, []);

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
      toast({
        title: t("lobby.toast.locked"),
        description: t("lobby.toast.lockedDescription", { level }),
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
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Scanlines />
      
      {/* Language Settings Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute top-4 right-4 z-20 p-2 border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group"
            aria-label={t("lobby.accessibility.languageSettings")}
          >
            <Languages className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
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
      
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      <main className="z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center p-4">
        
        {/* Left Column: Title & Actions */}
        <div className="contents lg:flex lg:flex-col lg:space-y-8 text-center lg:text-left">
          <div className="order-1 space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-primary font-mono text-xs lg:text-sm tracking-widest uppercase mb-2 flex items-center justify-center lg:justify-start gap-2"
            >
              <span className="w-2 h-2 bg-primary animate-pulse" />
              {t("lobby.systemOnline")}
            </motion.div>
            
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 relative">
              MOVE
              <span className="text-primary ml-2 lg:ml-4 inline-block transform -skew-x-12 text-shadow-glow">37</span>
            </h1>
            
            <div className="h-12 lg:h-16 max-w-md mx-auto lg:mx-0">
              <TerminalText 
                text={t("lobby.initializingText")}
                className="text-muted-foreground font-mono text-[10px] sm:text-sm md:text-base leading-relaxed"
                speed={20}
              />
            </div>
          </div>

          {/* Game Type Selection */}
          <div className="order-2 space-y-3 mt-6 lg:mt-8">
            <h3 className="text-[10px] lg:text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("lobby.selectGameMode")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 lg:gap-3">
              {AVAILABLE_GAMES.map((game) => {
                const isSelected = selectedGameType === game.id;
                const isAvailable = game.available;
                
                return (
                  <button
                    key={game.id}
                    onClick={() => handleGameTypeChange(game.id)}
                    disabled={!isAvailable}
                    className={cn(
                      "p-3 lg:p-4 border transition-all duration-300 text-left relative group",
                      !isAvailable
                        ? "border-white/10 bg-white/5 opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    )}
                  >
                    {!isAvailable && game.comingSoon && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                        <Lock className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground/80 mb-1" />
                        <span className="text-[7px] lg:text-[8px] text-primary/30 font-mono">{t("lobby.game.comingSoon")}</span>
                      </div>
                    )}
                    <div className={cn(
                      "text-2xl lg:text-3xl mb-2",
                      isAvailable ? "opacity-100" : "opacity-30"
                    )}>
                      {game.icon}
                    </div>
                    <h4 className={cn(
                      "text-[9px] lg:text-xs font-bold mb-1",
                      isAvailable ? "text-foreground" : "text-muted-foreground/50"
                    )}>
                      {t(game.nameKey)}
                    </h4>
                    <p className={cn(
                      "hidden sm:block text-[8px] lg:text-[10px] line-clamp-2",
                      isAvailable ? "text-muted-foreground" : "text-muted-foreground/30"
                    )}>
                      {t(game.descriptionKey)}
                    </p>
                    {isSelected && isAvailable && (
                      <div className="absolute top-2 right-2">
                        <Check className="w-3 h-3 lg:w-4 lg:h-4 text-primary" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons - Only show if game is available */}
          {currentGameInfo?.available && (
          <div className="order-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <GlitchButton 
              onClick={handleStart} 
              disabled={createGame.isPending || !currentGameInfo.available}
              className="w-full sm:w-auto text-base lg:text-lg py-4 lg:py-6"
            >
              {createGame.isPending ? t("lobby.initializing") : t("lobby.initiateSystem")}
            </GlitchButton>
            
            <GlitchButton 
              variant="outline" 
              className="w-full sm:w-auto py-4 lg:py-6"
              onClick={handleTutorial}
              disabled={!currentGameInfo.available}
            >
              {t("lobby.tutorial")}
            </GlitchButton>
          </div>
          )}

          {/* Difficulty Selection - Only show if game is available */}
          {currentGameInfo?.available && (
          <div className="order-3 space-y-3 mt-6 lg:mt-8">
            <h3 className="text-[10px] lg:text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("lobby.selectAIDifficulty")}</h3>
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <button
                onClick={() => handleDifficultyChange("NEXUS-3")}
                disabled={!isDifficultyUnlocked("NEXUS-3", selectedGameType)}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-3", selectedGameType)
                    ? "border-primary/20 bg-primary/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-3"
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-3", selectedGameType) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-primary/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Cpu className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-3", selectedGameType) ? "text-primary" : "text-primary/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-3", selectedGameType) ? "text-muted-foreground" : "text-primary/40"
                )}>NEXUS-3</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-3", selectedGameType) ? "text-muted-foreground" : "text-primary/30"
                )}>{t("lobby.difficulty.easy")}</p>
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-5")}
                disabled={!isDifficultyUnlocked("NEXUS-5", selectedGameType)}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-5", selectedGameType)
                    ? "border-secondary/20 bg-secondary/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-5"
                    ? "border-secondary bg-secondary/10 shadow-[0_0_15px_rgba(255,200,0,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-5", selectedGameType) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-secondary/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Cpu className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-5", selectedGameType) ? "text-secondary" : "text-secondary/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-5", selectedGameType) ? "text-muted-foreground" : "text-secondary/40"
                )}>NEXUS-5</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-5", selectedGameType) ? "text-muted-foreground" : "text-secondary/30"
                )}>{t("lobby.difficulty.medium")}</p>
                {!isDifficultyUnlocked("NEXUS-5", selectedGameType) && (
                  <p className="hidden sm:block text-[7px] lg:text-[8px] text-secondary/30 mt-0.5">{t("lobby.difficulty.completePrevious", { level: "3" })}</p>
                )}
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-7")}
                disabled={!isDifficultyUnlocked("NEXUS-7", selectedGameType)}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-7", selectedGameType)
                    ? "border-destructive/20 bg-destructive/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-7"
                    ? "border-destructive bg-destructive/10 shadow-[0_0_15px_rgba(255,0,60,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-7", selectedGameType) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-destructive/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Skull className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-7", selectedGameType) ? "text-destructive" : "text-destructive/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-7", selectedGameType) ? "text-muted-foreground" : "text-destructive/40"
                )}>NEXUS-7</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-7", selectedGameType) ? "text-muted-foreground" : "text-destructive/30"
                )}>{t("lobby.difficulty.hard")}</p>
                {!isDifficultyUnlocked("NEXUS-7", selectedGameType) && (
                  <p className="hidden sm:block text-[7px] lg:text-[8px] text-destructive/30 mt-0.5">{t("lobby.difficulty.completePrevious", { level: "5" })}</p>
                )}
              </button>
            </div>
          </div>
          )}
        </div>

        {/* Right Column: Visuals/Stats */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="order-2 relative h-[280px] sm:h-[350px] lg:h-[450px] w-full bg-black/40 border border-white/10 p-3 lg:p-4 backdrop-blur-sm overflow-hidden flex flex-col"
        >
          {/* Decorative header for stats box */}
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-[8px] lg:text-xs font-mono text-muted-foreground uppercase tracking-widest">
                {t("lobby.stats.title")}
              </span>
              <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
            </div>
            <span className="text-[8px] lg:text-xs font-mono text-muted-foreground/50 uppercase">
              {playerStats.totalGames > 0 ? t("lobby.stats.verified") : t("lobby.stats.unverified")}
            </span>
          </div>

          {/* Statistics Header with Game Type */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t("lobby.stats.title")}
            </h3>
            {currentGameInfo && (
              <div className="flex items-center gap-1.5 text-[9px] lg:text-[10px] text-primary/70">
                <span className="opacity-70">{currentGameInfo.icon}</span>
                <span className="font-mono">{t(currentGameInfo.nameKey)}</span>
              </div>
            )}
          </div>

          {/* Statistics Cards Grid */}
          {playerStats.totalGames > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3 flex-shrink-0">
                <StatCard
                  label={t("lobby.stats.winRate")}
                  value={playerStats.winRate}
                  icon={<Trophy className="w-3 h-3 lg:w-4 lg:h-4" />}
                  delay={0.6}
                  isPercentage={true}
                />
                <StatCard
                  label={t("lobby.stats.totalGames")}
                  value={playerStats.totalGames}
                  icon={<Activity className="w-3 h-3 lg:w-4 lg:h-4" />}
                  delay={0.7}
                />
                <StatCard
                  label={t("lobby.stats.streak")}
                  value={playerStats.currentStreak}
                  icon={<Zap className="w-3 h-3 lg:w-4 lg:h-4" />}
                  delay={0.8}
                />
                <StatCard
                  label={t("lobby.stats.avgTurns")}
                  value={playerStats.avgTurns.toFixed(1)}
                  icon={<Clock className="w-3 h-3 lg:w-4 lg:h-4" />}
                  delay={0.9}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="mb-4 opacity-30">
                <Brain className="w-12 h-12 lg:w-16 lg:h-16 text-white/20 mx-auto" />
              </div>
              <p className="text-[10px] lg:text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
                {t("lobby.stats.noData")}
              </p>
              <p className="text-[8px] lg:text-[10px] font-mono text-muted-foreground/50">
                {t("lobby.stats.noDataDescription")}
              </p>
            </div>
          )}
        </motion.div>
      </main>

      <footer className="absolute bottom-4 text-xs font-mono text-white/20 text-center w-full">
        {t("lobby.footer")}
      </footer>

      {/* Tutorial Modal */}
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} gameType={selectedGameType} />
    </div>
  );
}
