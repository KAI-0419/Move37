/**
 * Tutorial Preview Component
 * 
 * Inline tutorial preview that shows gameplay videos for the selected game mode.
 */

import { useTranslation } from "react-i18next";
import type { GameType } from "@shared/schema";
import { EntropyGameplayPreview } from "./EntropyGameplayPreview";
import { MiniChessGameplayPreview } from "./MiniChessGameplayPreview";
import { IsolationGameplayPreview } from "./IsolationGameplayPreview";
import { cn } from "@/lib/utils";

interface TutorialPreviewProps {
  gameType: GameType;
  className?: string;
  onOpenTutorial?: () => void;
  onOpenStats?: () => void;
}

export function TutorialPreview({ gameType, className, onOpenTutorial, onOpenStats }: TutorialPreviewProps) {
  const { t } = useTranslation();

  // Use video previews for supported games
  if (gameType === "MINI_CHESS") {
    return (
      <MiniChessGameplayPreview
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (gameType === "GAME_2") {
    return (
      <IsolationGameplayPreview
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (gameType === "GAME_3") {
    return (
      <EntropyGameplayPreview
        className={className}
        onOpenTutorial={onOpenTutorial}
        onOpenStats={onOpenStats}
      />
    );
  }

  // Fallback for unknown games
  return (
    <div className={cn("flex items-center justify-center h-full bg-black/40 border border-white/10 rounded-lg p-8", className)}>
      <p className="text-sm text-muted-foreground font-mono">
        {t("tutorial.notAvailable")}
      </p>
    </div>
  );
}
