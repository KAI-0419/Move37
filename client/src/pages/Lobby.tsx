import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { motion } from "framer-motion";
import { Cpu, Skull, Brain, Zap, Lock, Languages, Check, Trophy, Activity, Clock } from "lucide-react";
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

// LocalStorage key for selected difficulty
const DIFFICULTY_STORAGE_KEY = "move37_selected_difficulty";

// Load difficulty from localStorage
function loadDifficulty(): "NEXUS-3" | "NEXUS-5" | "NEXUS-7" {
  try {
    const saved = localStorage.getItem(DIFFICULTY_STORAGE_KEY);
    if (saved === "NEXUS-3" || saved === "NEXUS-5" || saved === "NEXUS-7") {
      return saved;
    }
  } catch (error) {
    console.error("Failed to load difficulty from localStorage:", error);
  }
  return "NEXUS-7"; // Default
}

// Save difficulty to localStorage
function saveDifficulty(difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"): void {
  try {
    localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty);
  } catch (error) {
    console.error("Failed to save difficulty to localStorage:", error);
  }
}

// Calculate player statistics from game history
function calculatePlayerStats() {
  const games = getAllGames();
  
  // Filter completed games (winner is not null)
  const completedGames = games.filter(g => g.winner !== null);
  
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

// Generate radar chart data based on actual player statistics
function getRealStatsData(t: (key: string) => string, stats: ReturnType<typeof calculatePlayerStats>) {
  const { totalGames, winRate, avgTurns, endgameWinRate } = stats;
  
  // If no games played, return default values
  if (totalGames === 0) {
    return [
      { subject: t("lobby.chart.tactics"), A: 0, fullMark: 150 },
      { subject: t("lobby.chart.aggression"), A: 0, fullMark: 150 },
      { subject: t("lobby.chart.speed"), A: 0, fullMark: 150 },
      { subject: t("lobby.chart.sacrifice"), A: 0, fullMark: 150 },
      { subject: t("lobby.chart.defense"), A: 0, fullMark: 150 },
      { subject: t("lobby.chart.endgame"), A: 0, fullMark: 150 },
    ];
  }
  
  // Tactics: Based on win rate (0-150 scale)
  const tactics = Math.min(150, winRate * 1.5);
  
  // Aggression: Lower average turns = more aggressive (30 turns is baseline)
  // Inverse relationship: fewer turns = higher aggression
  const aggression = Math.min(150, Math.max(0, (30 - avgTurns) * 5));
  
  // Speed: Based on average game duration (faster = higher)
  // Assuming 180 seconds (3 min) is baseline, faster games get higher score
  const speed = Math.min(150, Math.max(0, (180 - stats.avgGameDuration) / 180 * 150));
  
  // Sacrifice: Estimated based on win rate and aggression
  // Higher win rate with lower turns suggests willingness to sacrifice
  const sacrifice = Math.min(150, (winRate * 0.6 + aggression * 0.4));
  
  // Defense: Inverse of aggression, but also consider win rate
  // Higher win rate with more turns suggests defensive play
  const defense = Math.min(150, Math.max(0, (avgTurns - 10) * 3 + (winRate * 0.3)));
  
  // Endgame: Based on endgame win rate
  const endgame = Math.min(150, endgameWinRate * 1.5);
  
  return [
    { subject: t("lobby.chart.tactics"), A: Math.round(tactics), fullMark: 150 },
    { subject: t("lobby.chart.aggression"), A: Math.round(aggression), fullMark: 150 },
    { subject: t("lobby.chart.speed"), A: Math.round(speed), fullMark: 150 },
    { subject: t("lobby.chart.sacrifice"), A: Math.round(sacrifice), fullMark: 150 },
    { subject: t("lobby.chart.defense"), A: Math.round(defense), fullMark: 150 },
    { subject: t("lobby.chart.endgame"), A: Math.round(endgame), fullMark: 150 },
  ];
}

export default function Lobby() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const { toast } = useToast();
  const [selectedDifficulty, setSelectedDifficulty] = useState<"NEXUS-3" | "NEXUS-5" | "NEXUS-7">(() => {
    // Only select unlocked difficulty
    const unlocked = getUnlockedDifficulties();
    const saved = loadDifficulty();
    // If saved difficulty is unlocked, use it; otherwise use first unlocked
    if (unlocked.has(saved)) {
      return saved;
    }
    // Default to first unlocked difficulty (should be NEXUS-3)
    return Array.from(unlocked)[0] || "NEXUS-3";
  });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [unlockedDifficulties, setUnlockedDifficulties] = useState<Set<"NEXUS-3" | "NEXUS-5" | "NEXUS-7">>(() => getUnlockedDifficulties());
  const [selectedLanguage, setSelectedLanguage] = useState<"ko" | "en">(() => {
    try {
      const stored = localStorage.getItem('move37_language');
      return stored === 'en' ? 'en' : 'ko';
    } catch {
      return 'ko';
    }
  });
  
  // Calculate player statistics with state for reactivity
  const [statsUpdateTrigger, setStatsUpdateTrigger] = useState(0);
  const playerStats = calculatePlayerStats();
  
  // Update stats when storage changes (game completed)
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
      const savedDifficulty = loadDifficulty();
      const unlocked = getUnlockedDifficulties();
      setUnlockedDifficulties(unlocked);
      
      // Only set selected difficulty if it's unlocked
      if (unlocked.has(savedDifficulty)) {
        setSelectedDifficulty(savedDifficulty);
      } else {
        // Default to first unlocked difficulty
        const firstUnlocked = Array.from(unlocked)[0] || "NEXUS-3";
        setSelectedDifficulty(firstUnlocked);
        saveDifficulty(firstUnlocked);
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
  }, [i18n]);

  // Save difficulty whenever it changes (only if unlocked)
  const handleDifficultyChange = (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
    if (!isDifficultyUnlocked(difficulty)) {
      const level = difficulty.split('-')[1];
      toast({
        title: t("lobby.toast.locked"),
        description: t("lobby.toast.lockedDescription", { level }),
        variant: "default",
      });
      return;
    }
    setSelectedDifficulty(difficulty);
    saveDifficulty(difficulty);
  };

  const handleStart = async () => {
    try {
      const game = await createGame.mutateAsync(selectedDifficulty);
      setLocation("/game");
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

  const chartConfig = {
    A: {
      label: t("lobby.chart.player"),
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

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

          <div className="order-4 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <GlitchButton 
              onClick={handleStart} 
              disabled={createGame.isPending}
              className="w-full sm:w-auto text-base lg:text-lg py-4 lg:py-6"
            >
              {createGame.isPending ? t("lobby.initializing") : t("lobby.initiateSystem")}
            </GlitchButton>
            
            <GlitchButton 
              variant="outline" 
              className="w-full sm:w-auto py-4 lg:py-6"
              onClick={handleTutorial}
            >
              {t("lobby.tutorial")}
            </GlitchButton>
          </div>

          {/* Difficulty Selection */}
          <div className="order-3 space-y-3 mt-6 lg:mt-8">
            <h3 className="text-[10px] lg:text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("lobby.selectAIDifficulty")}</h3>
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <button
                onClick={() => handleDifficultyChange("NEXUS-3")}
                disabled={!isDifficultyUnlocked("NEXUS-3")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-3")
                    ? "border-primary/20 bg-primary/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-3"
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-3") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-primary/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Cpu className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-3") ? "text-primary" : "text-primary/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-3") ? "text-muted-foreground" : "text-primary/40"
                )}>NEXUS-3</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-3") ? "text-muted-foreground" : "text-primary/30"
                )}>{t("lobby.difficulty.easy")}</p>
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-5")}
                disabled={!isDifficultyUnlocked("NEXUS-5")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-5")
                    ? "border-secondary/20 bg-secondary/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-5"
                    ? "border-secondary bg-secondary/10 shadow-[0_0_15px_rgba(255,200,0,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-5") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-secondary/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Cpu className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-5") ? "text-secondary" : "text-secondary/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-5") ? "text-muted-foreground" : "text-secondary/40"
                )}>NEXUS-5</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-5") ? "text-muted-foreground" : "text-secondary/30"
                )}>{t("lobby.difficulty.medium")}</p>
                {!isDifficultyUnlocked("NEXUS-5") && (
                  <p className="hidden sm:block text-[7px] lg:text-[8px] text-secondary/30 mt-0.5">{t("lobby.difficulty.completePrevious", { level: "3" })}</p>
                )}
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-7")}
                disabled={!isDifficultyUnlocked("NEXUS-7")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left relative",
                  !isDifficultyUnlocked("NEXUS-7")
                    ? "border-destructive/20 bg-destructive/5 opacity-75 cursor-not-allowed"
                    : selectedDifficulty === "NEXUS-7"
                    ? "border-destructive bg-destructive/10 shadow-[0_0_15px_rgba(255,0,60,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                {!isDifficultyUnlocked("NEXUS-7") && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px] z-10">
                    <Lock className="w-5 h-5 lg:w-6 lg:h-6 text-muted-foreground/80 mb-1" />
                    <span className="text-[7px] lg:text-[8px] text-destructive/30 font-mono">{t("lobby.difficulty.locked")}</span>
                  </div>
                )}
                <Skull className={cn(
                  "w-4 h-4 lg:w-5 lg:h-5 mb-1 lg:mb-2",
                  isDifficultyUnlocked("NEXUS-7") ? "text-destructive" : "text-destructive/30"
                )} />
                <h4 className={cn(
                  "text-[8px] lg:text-xs font-bold mb-0.5 lg:mb-1",
                  isDifficultyUnlocked("NEXUS-7") ? "text-muted-foreground" : "text-destructive/40"
                )}>NEXUS-7</h4>
                <p className={cn(
                  "hidden sm:block text-[8px] lg:text-xs",
                  isDifficultyUnlocked("NEXUS-7") ? "text-muted-foreground" : "text-destructive/30"
                )}>{t("lobby.difficulty.hard")}</p>
                {!isDifficultyUnlocked("NEXUS-7") && (
                  <p className="hidden sm:block text-[7px] lg:text-[8px] text-destructive/30 mt-0.5">{t("lobby.difficulty.completePrevious", { level: "5" })}</p>
                )}
              </button>
            </div>
          </div>
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

              {/* Radar Chart */}
              <div className="flex-1 min-h-0">
                <ChartContainer config={chartConfig} className="w-full h-full aspect-auto">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRealStatsData(t, playerStats)}>
                    <PolarGrid stroke="#333" strokeWidth={1} />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: '#999', fontSize: 8, fontFamily: 'monospace' }} 
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 150]} 
                      tick={{ fill: '#444', fontSize: 7, fontFamily: 'monospace' }} 
                      axisLine={false} 
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Radar
                      name={t("lobby.chart.player")}
                      dataKey="A"
                      stroke="var(--color-A)"
                      strokeWidth={2}
                      fill="var(--color-A)"
                      fillOpacity={0.2}
                      dot={{ fill: 'var(--color-A)', r: 3 }}
                    />
                  </RadarChart>
                </ChartContainer>
              </div>

              {/* Glitch overlays on chart */}
              <div className="absolute bottom-3 right-3 flex gap-2 opacity-30">
                <Brain className="w-3 h-3 lg:w-4 lg:h-4 text-white/20" />
                <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-white/20" />
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
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
}
