/**
 * Terminal Log Component
 * 
 * Displays game system logs in a terminal-style interface
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Terminal as TerminalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DifficultyColorConfig } from "@/lib/games/GameUIConfig";

export interface LogEntry {
  message: string;
  timestamp: Date;
}

export interface TerminalLogProps {
  logHistory: LogEntry[];
  difficultyColors: DifficultyColorConfig;
}

export function TerminalLog({ logHistory, difficultyColors }: TerminalLogProps) {
  const { t } = useTranslation();
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logHistory]);

  return (
    <aside className="w-full lg:w-1/4 h-32 sm:h-48 lg:h-auto border-t lg:border-t-0 lg:border-l border-border bg-black/80 flex flex-col z-10 shrink-0">
      <div className="p-2 lg:p-3 border-b border-border bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3 h-3 lg:w-4 lg:h-4 text-accent" />
          <span className="text-[10px] lg:text-xs font-bold tracking-widest text-accent">
            {t("gameRoom.systemLog")}
          </span>
        </div>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-red-500/20" />
          <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-yellow-500/20" />
          <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-green-500/20" />
        </div>
      </div>

      <div className="flex-1 p-2 lg:p-4 overflow-y-auto font-mono text-[10px] lg:text-xs space-y-2 lg:space-y-3 custom-scrollbar">
        {logHistory.map((log, i) => {
          const isAILog = log.message.startsWith(">") || log.message.startsWith("---");
          const isSystemLog = log.message.startsWith("//");
          return (
            <div
              key={i}
              className={cn(
                "border-l-2 pl-3 py-1 transition-all",
                isAILog
                  ? `${difficultyColors.borderOpacity30} ${difficultyColors.bgOpacity}`
                  : "border-accent/20"
              )}
            >
              {!isSystemLog && (
                <span className="text-accent/50 mr-2 text-[10px]">
                  [{log.timestamp.toLocaleTimeString()}]
                </span>
              )}
              <span
                className={cn(
                  "text-xs font-mono",
                  isAILog
                    ? difficultyColors.textOpacity90
                    : isSystemLog
                    ? "text-muted-foreground opacity-50"
                    : "text-foreground"
                )}
              >
                {log.message.startsWith("gameRoom.") ||
                log.message.startsWith("lobby.") ||
                log.message.startsWith("tutorial.")
                  ? t(log.message as any)
                  : log.message}
              </span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>
    </aside>
  );
}
