/**
 * Game Loading State Component
 * 
 * Displays loading state while game is being loaded
 */

import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { TerminalText } from "@/components/TerminalText";
import { Scanlines } from "@/components/Scanlines";

export function GameLoadingState() {
  const { t } = useTranslation();

  return (
    <div className="h-screen w-full bg-background flex items-center justify-center text-primary font-mono">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <TerminalText text={t("gameRoom.connecting")} />
      </div>
      <Scanlines />
    </div>
  );
}
