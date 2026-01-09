import { useCreateGame } from "@/hooks/use-game";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";
import { useLocation } from "wouter";
import { TerminalText } from "@/components/TerminalText";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Cpu, Skull, Brain, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const handleStart = async () => {
    try {
      const game = await createGame.mutateAsync();
      setLocation(`/game/${game.id}`);
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
    toast({
      title: "Tutorial",
      description: "Select a piece and click a valid move. Capture the enemy King or move your King to row 0 to win!",
    });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Scanlines />
      
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background z-0" />

      <main className="z-10 max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Title & Actions */}
        <div className="space-y-8">
          <div className="space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-primary font-mono text-sm tracking-widest uppercase mb-2 flex items-center gap-2"
            >
              <span className="w-2 h-2 bg-primary animate-pulse" />
              System Online
            </motion.div>
            
            <h1 className="text-6xl md:text-8xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50 relative">
              MOVE
              <span className="text-primary ml-4 inline-block transform -skew-x-12 text-shadow-glow">37</span>
            </h1>
            
            <div className="h-16">
              <TerminalText 
                text="INITIALIZING STRATEGIC ENGINE... SACRIFICE PROTOCOLS ENGAGED. LOGIC IS COLD. VICTORY REQUIRES LOSS."
                className="text-muted-foreground font-mono text-sm md:text-base leading-relaxed"
                speed={20}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <GlitchButton 
              onClick={handleStart} 
              disabled={createGame.isPending}
              className="w-full sm:w-auto text-lg py-6"
            >
              {createGame.isPending ? "INITIALIZING..." : "INITIATE SYSTEM"}
            </GlitchButton>
            
            <GlitchButton 
              variant="outline" 
              className="w-full sm:w-auto py-6"
              onClick={handleTutorial}
            >
              TUTORIAL
            </GlitchButton>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white/5 border border-white/10 p-4 rounded-none">
              <Cpu className="w-6 h-6 text-secondary mb-2" />
              <h3 className="text-sm font-bold text-muted-foreground">AI MODEL</h3>
              <p className="font-mono text-xl">NEXUS-7</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-none">
              <Skull className="w-6 h-6 text-destructive mb-2" />
              <h3 className="text-sm font-bold text-muted-foreground">DIFFICULTY</h3>
              <p className="font-mono text-xl text-destructive animate-pulse">EXTREME</p>
            </div>
          </div>
        </div>

        {/* Right Column: Visuals/Stats */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="relative h-[400px] w-full bg-black/40 border border-white/10 p-4 backdrop-blur-sm"
        >
          {/* Decorative header for chart box */}
          <div className="absolute top-0 left-0 w-full flex justify-between p-2 border-b border-white/10 text-xs font-mono text-muted-foreground uppercase">
            <span>Subject: Player 1</span>
            <span>Status: Untested</span>
          </div>

          <div className="h-full w-full pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={statsData}>
                <PolarGrid stroke="#333" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 10, fontFamily: 'Space Mono' }} />
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
        MOVE 37 © 2025 // SYSTEM VERSION 0.9.1 BETA
      </footer>
    </div>
  );
}
