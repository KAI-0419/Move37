/**
 * Difficulty Selector Component
 * 
 * Displays and manages AI difficulty selection with unlock status
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Cpu, Skull, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDifficultyUnlocked } from "@/lib/storage";
import type { GameType } from "@shared/schema";

export interface DifficultySelectorProps {
  selectedDifficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7";
  selectedGameType: GameType;
  onDifficultyChange: (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => void;
}

export function DifficultySelector({
  selectedDifficulty,
  selectedGameType,
  onDifficultyChange,
}: DifficultySelectorProps) {
  const { t } = useTranslation();

  // Get difficulty configuration
  const getDifficultyConfig = (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
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

  // Get color classes based on difficulty
  const getColorClasses = (difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7") => {
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

  return (
    <div className="space-y-2 sm:space-y-3">
      {(["NEXUS-3", "NEXUS-5", "NEXUS-7"] as const).map((difficulty) => {
        const isUnlocked = isDifficultyUnlocked(difficulty, selectedGameType);
        const isSelected = selectedDifficulty === difficulty;
        const level = difficulty.split('-')[1];

        const config = getDifficultyConfig(difficulty);
        const Icon = config.icon;
        const colors = getColorClasses(difficulty);

        return (
          <motion.button
            key={difficulty}
            onClick={() => onDifficultyChange(difficulty)}
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
                <span className="text-[8px] text-primary/70 font-mono uppercase tracking-wider">
                  {t("lobby.difficulty.locked")}
                </span>
              </div>
            )}
            <div className={cn("flex items-center gap-2 sm:gap-3", !isUnlocked && "opacity-100")}>
              <Icon
                className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0",
                  isUnlocked
                    ? isSelected
                      ? colors.text
                      : "text-muted-foreground"
                    : colors.textLocked
                )}
              />
              <div className="flex-1 min-w-0">
                <h4
                  className={cn(
                    "text-[10px] sm:text-xs font-bold mb-0.5 truncate",
                    isUnlocked ? "text-foreground" : colors.textLabel
                  )}
                >
                  {difficulty}
                </h4>
                <p
                  className={cn(
                    "text-[9px] sm:text-[10px] line-clamp-1",
                    isUnlocked ? "text-muted-foreground" : colors.textLocked
                  )}
                >
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
  );
}
