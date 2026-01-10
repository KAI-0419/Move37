/**
 * Game Error State Component
 * 
 * Displays error state when game fails to load or encounters an error
 */

import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { Scanlines } from "@/components/Scanlines";

export interface GameErrorStateProps {
  errorTitle: string;
  errorMessage: string;
  onAbort: () => void;
}

export function GameErrorState({
  errorTitle,
  errorMessage,
  onAbort,
}: GameErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-full bg-background flex flex-col items-center justify-center text-destructive font-mono gap-4">
      <AlertTriangle className="w-12 h-12" />
      <h2 className="text-xl">{errorTitle}</h2>
      <p>{errorMessage}</p>
      <GlitchButton onClick={onAbort} variant="outline">
        {t("gameRoom.abort")}
      </GlitchButton>
      <Scanlines />
    </div>
  );
}
