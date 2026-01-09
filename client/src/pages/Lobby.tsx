import { useState, useEffect } from "react";
import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Cpu, Skull, Brain, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TutorialModal } from "@/components/TutorialModal";

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

// Mock data for radar chart
const statsData = [
  { subject: 'Tactics', A: 120, fullMark: 150 },
  { subject: 'Aggression', A: 98, fullMark: 150 },
  { subject: 'Speed', A: 86, fullMark: 150 },
  { subject: 'Sacrifice', A: 99, fullMark: 150 },
  { subject: 'Defense', A: 65, fullMark: 150 },
  { subject: 'Endgame', A: 85, fullMark: 150 },
];

export default function Lobby() {
  const [, setLocation] = useLocation();
  const createGame = useCreateGame();
  const { toast } = useToast();
  const [selectedDifficulty, setSelectedDifficulty] = useState<"NEXUS-3" | "NEXUS-5" | "NEXUS-7">(() => loadDifficulty());
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Load saved difficulty on mount
  useEffect(() => {
    const savedDifficulty = loadDifficulty();
    setSelectedDifficulty(savedDifficulty);
  }, []);

  // Save difficulty whenever it changes
  const handleDifficultyChange = (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
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
        title: "System Error",
        description: error?.message || "Failed to initialize game. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTutorial = () => {
    setTutorialOpen(true);
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Scanlines />
      
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      <main className="z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center p-4">
        
        {/* Left Column: Title & Actions */}
        <div className="space-y-6 lg:space-y-8 text-center lg:text-left">
          <div className="space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-primary font-mono text-xs lg:text-sm tracking-widest uppercase mb-2 flex items-center justify-center lg:justify-start gap-2"
            >
              <span className="w-2 h-2 bg-primary animate-pulse" />
              System Online
            </motion.div>
            
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 relative">
              MOVE
              <span className="text-primary ml-2 lg:ml-4 inline-block transform -skew-x-12 text-shadow-glow">37</span>
            </h1>
            
            <div className="h-12 lg:h-16 max-w-md mx-auto lg:mx-0">
              <TerminalText 
                text="INITIALIZING STRATEGIC ENGINE... SACRIFICE PROTOCOLS ENGAGED. LOGIC IS COLD. VICTORY REQUIRES LOSS."
                className="text-muted-foreground font-mono text-[10px] sm:text-sm md:text-base leading-relaxed"
                speed={20}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <GlitchButton 
              onClick={handleStart} 
              disabled={createGame.isPending}
              className="w-full sm:w-auto text-base lg:text-lg py-4 lg:py-6"
            >
              {createGame.isPending ? "INITIALIZING..." : "INITIATE SYSTEM"}
            </GlitchButton>
            
            <GlitchButton 
              variant="outline" 
              className="w-full sm:w-auto py-4 lg:py-6"
              onClick={handleTutorial}
            >
              TUTORIAL
            </GlitchButton>
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-3 mt-6 lg:mt-8">
            <h3 className="text-[10px] lg:text-sm font-bold text-muted-foreground uppercase tracking-widest">Select AI Difficulty</h3>
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <button
                onClick={() => handleDifficultyChange("NEXUS-3")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left",
                  selectedDifficulty === "NEXUS-3"
                    ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <Cpu className="w-4 h-4 lg:w-5 lg:h-5 text-primary mb-1 lg:mb-2" />
                <h4 className="text-[8px] lg:text-xs font-bold text-muted-foreground mb-0.5 lg:mb-1">NEXUS-3</h4>
                <p className="hidden sm:block text-[8px] lg:text-xs text-muted-foreground">쉬움</p>
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-5")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left",
                  selectedDifficulty === "NEXUS-5"
                    ? "border-secondary bg-secondary/10 shadow-[0_0_15px_rgba(255,200,0,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <Cpu className="w-4 h-4 lg:w-5 lg:h-5 text-secondary mb-1 lg:mb-2" />
                <h4 className="text-[8px] lg:text-xs font-bold text-muted-foreground mb-0.5 lg:mb-1">NEXUS-5</h4>
                <p className="hidden sm:block text-[8px] lg:text-xs text-muted-foreground">보통</p>
              </button>
              <button
                onClick={() => handleDifficultyChange("NEXUS-7")}
                className={cn(
                  "p-2 lg:p-4 border transition-all duration-300 text-left",
                  selectedDifficulty === "NEXUS-7"
                    ? "border-destructive bg-destructive/10 shadow-[0_0_15px_rgba(255,0,60,0.2)]"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <Skull className="w-4 h-4 lg:w-5 lg:h-5 text-destructive mb-1 lg:mb-2" />
                <h4 className="text-[8px] lg:text-xs font-bold text-muted-foreground mb-0.5 lg:mb-1">NEXUS-7</h4>
                <p className="hidden sm:block text-[8px] lg:text-xs text-muted-foreground">어려움</p>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Visuals/Stats */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="relative h-[280px] sm:h-[350px] lg:h-[450px] w-full bg-black/40 border border-white/10 p-4 backdrop-blur-sm overflow-hidden"
        >
          {/* Decorative header for chart box */}
          <div className="absolute top-0 left-0 w-full flex justify-between p-2 border-b border-white/10 text-[8px] lg:text-xs font-mono text-muted-foreground uppercase">
            <span>Subject: Player 1</span>
            <span>Status: Untested</span>
          </div>

          <div className="h-full w-full pt-6 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={statsData}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 8, fontFamily: 'Space Mono' }} />
                <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                <Radar
                  name="Player"
                  dataKey="A"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="var(--primary)"
                  fillOpacity={0.2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Glitch overlays on chart */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <Brain className="w-4 h-4 text-white/20" />
            <Zap className="w-4 h-4 text-white/20" />
          </div>
        </motion.div>
      </main>

      <footer className="absolute bottom-4 text-xs font-mono text-white/20 text-center w-full">
        MOVE 37 © 2026 // SYSTEM VERSION 0.9.1 BETA
      </footer>

      {/* Tutorial Modal */}
      <TutorialModal open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
}
