/**
 * Player Stats Modal Component
 * 
 * Modal wrapper for PlayerStatsPanel with beautiful design
 */

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlayerStatsPanel } from "@/components/PlayerStatsPanel";
import type { GameType } from "@shared/schema";

interface PlayerStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameType?: GameType;
}

export function PlayerStatsModal({ open, onOpenChange, gameType }: PlayerStatsModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[90dvh] bg-black/95 border-2 border-primary/30 backdrop-blur-xl p-0 overflow-hidden" style={{ maxHeight: 'calc(90dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))' }}>
        {/* Custom Header with Close Button */}
        <div className="relative p-4 sm:p-5 md:p-6 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  opacity: [0.7, 1, 0.7]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_rgba(0,243,255,0.8)]"
              />
              <h2 className="text-xl font-black font-display text-primary tracking-tighter">
                {t("lobby.stats.title")}
              </h2>
            </div>
          </motion.div>
        </div>

        {/* Stats Content */}
        <div className="overflow-y-auto max-h-[calc(90dvh-120px)]" style={{ maxHeight: 'calc(90dvh - 120px - env(safe-area-inset-top) - env(safe-area-inset-bottom))' }}>
          <PlayerStatsPanel gameType={gameType} className="border-0 rounded-none bg-transparent" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
