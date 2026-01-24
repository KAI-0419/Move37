/**
 * Entropy Gameplay Preview Component
 *
 * High-quality cinematic gameplay preview using a pre-rendered video.
 * Replaces the CPU-intensive real-time simulation.
 */

import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Play, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";


interface EntropyGameplayPreviewProps {
  className?: string;
  onOpenTutorial?: () => void;
  onOpenStats?: () => void;
}

export function EntropyGameplayPreview({
  className,
  onOpenTutorial,
  onOpenStats,
}: EntropyGameplayPreviewProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Ensure video plays when component mounts/updates
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => {
        console.log("Autoplay prevented:", e);
      });
    }
  }, []);

  return (
    <div className={cn("flex flex-col h-full bg-transparent overflow-hidden", className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b-2 border-white/20 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-[10px] font-mono text-primary uppercase tracking-widest bg-primary/10 px-2 py-1 rounded border border-primary/30 cursor-pointer select-none"
            animate={{
              boxShadow: [
                "0 0 10px rgba(0, 243, 255, 0.2)",
                "0 0 20px rgba(0, 243, 255, 0.4)",
                "0 0 10px rgba(0, 243, 255, 0.2)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            PREVIEW
          </motion.span>
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

      {/* Board with cinematic effects */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-black/60 via-black/40 to-black/60">
        {/* Ambient glow effect */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              "radial-gradient(circle at 30% 30%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 70% 70%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
              "radial-gradient(circle at 30% 30%, rgba(0, 243, 255, 0.1) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative z-10 w-[300px] h-[300px] flex items-center justify-center">
          <video
            ref={videoRef}
            src="/videos/Entropy.mp4"
            className="w-full h-full object-contain opacity-90"
            autoPlay
            loop
            muted
            playsInline
          />
        </div>
      </div>
    </div>
  );
}
