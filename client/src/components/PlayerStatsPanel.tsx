/**
 * Player Stats Panel Component
 * 
 * Enhanced player statistics display with recent game history
 * and visual performance indicators.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Trophy, Activity, Zap, Clock, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/StatCard";
import { getAllGames } from "@/lib/storage";
import type { GameType } from "@shared/schema";

interface PlayerStatsPanelProps {
  gameType?: GameType;
  className?: string;
}

interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  avgTurns: number;
  endgameWinRate: number;
  avgGameDuration: number;
}

function calculatePlayerStats(gameType?: GameType): PlayerStats {
  const games = getAllGames();
  
  // Filter by gameType if provided
  const filteredGames = gameType ? games.filter(g => g.gameType === gameType) : games;
  
  // Filter completed games (winner is not null)
  const completedGames = filteredGames.filter(g => g.winner !== null);
  
  // Sort by createdAt (most recent first)
  const sortedCompletedGames = [...completedGames].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
  
  const totalGames = sortedCompletedGames.length;
  const wins = sortedCompletedGames.filter(g => g.winner === 'player').length;
  const losses = sortedCompletedGames.filter(g => g.winner === 'ai').length;
  const draws = sortedCompletedGames.filter(g => g.winner === 'draw').length;
  
  const sumCheck = wins + losses + draws;
  const validTotalGames = sumCheck;
  const winRate = validTotalGames > 0 ? (wins / validTotalGames) * 100 : 0;
  
  // Calculate current win streak
  let currentStreak = 0;
  for (let i = 0; i < sortedCompletedGames.length; i++) {
    if (sortedCompletedGames[i].winner === 'player') {
      currentStreak++;
    } else {
      break;
    }
  }
  
  // Calculate average turns
  const gamesWithValidTurns = sortedCompletedGames.map(g => ({
    ...g,
    turnCount: Math.max(1, g.turnCount ?? 1)
  }));
  
  const avgTurns = gamesWithValidTurns.length > 0
    ? gamesWithValidTurns.reduce((sum, g) => sum + g.turnCount, 0) / gamesWithValidTurns.length
    : 0;
  
  // Calculate endgame win rate
  const endgameGames = sortedCompletedGames.filter(g => {
    const turnCount = g.turnCount ?? 0;
    return turnCount >= 20;
  });
  const endgameWinRate = endgameGames.length > 0
    ? (endgameGames.filter(g => g.winner === 'player').length / endgameGames.length) * 100
    : 0;
  
  // Calculate average game duration
  const avgGameDuration = avgTurns * 5;
  
  return {
    totalGames: validTotalGames,
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

export function PlayerStatsPanel({ gameType, className }: PlayerStatsPanelProps) {
  const { t } = useTranslation();
  const stats = useMemo(() => calculatePlayerStats(gameType), [gameType]);
  
  // Get recent games (last 5)
  const recentGames = useMemo(() => {
    const games = getAllGames();
    const filteredGames = gameType ? games.filter(g => g.gameType === gameType) : games;
    const completedGames = filteredGames.filter(g => g.winner !== null);
    
    return completedGames
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map(g => g.winner);
  }, [gameType]);

  return (
    <div className={cn("flex flex-col h-full bg-black/40 border border-white/10 rounded-lg overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            {t("lobby.stats.title")}
          </h2>
          <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
            {stats.totalGames > 0 ? t("lobby.stats.verified") : t("lobby.stats.unverified")}
          </span>
        </div>
      </div>

      {/* Stats Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {stats.totalGames > 0 ? (
          <>
            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={t("lobby.stats.winRate")}
                value={stats.winRate.toFixed(1)}
                icon={<Trophy className="w-3 h-3 lg:w-4 lg:h-4" />}
                delay={0.1}
                isPercentage={true}
              />
              <StatCard
                label={t("lobby.stats.totalGames")}
                value={stats.totalGames}
                icon={<Activity className="w-3 h-3 lg:w-4 lg:h-4" />}
                delay={0.2}
              />
              <StatCard
                label={t("lobby.stats.streak")}
                value={stats.currentStreak}
                icon={<Zap className="w-3 h-3 lg:w-4 lg:h-4" />}
                delay={0.3}
              />
              <StatCard
                label={t("lobby.stats.avgTurns")}
                value={stats.avgTurns.toFixed(1)}
                icon={<Clock className="w-3 h-3 lg:w-4 lg:h-4" />}
                delay={0.4}
              />
            </div>

            {/* Recent Performance */}
            {recentGames.length > 0 && (
              <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                    {t("lobby.stats.recentPerformance")}
                  </span>
                </div>
                <div className="flex gap-2 justify-center">
                  {recentGames.map((winner, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className={cn(
                        "w-3 h-3 rounded-sm",
                        winner === 'player' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
                        winner === 'ai' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                        "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                      )}
                      title={
                        winner === 'player' ? t("lobby.stats.win") :
                        winner === 'ai' ? t("lobby.stats.loss") :
                        t("lobby.stats.draw")
                      }
                    />
                  ))}
                  {recentGames.length < 5 && (
                    Array.from({ length: 5 - recentGames.length }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="w-3 h-3 rounded-sm bg-white/10 border border-white/20"
                      />
                    ))
                  )}
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-[9px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-green-500" />
                    <span>{t("lobby.stats.win")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-red-500" />
                    <span>{t("lobby.stats.loss")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm bg-yellow-500" />
                    <span>{t("lobby.stats.draw")}</span>
                  </div>
                </div>
              </div>
            )}

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="mb-4 opacity-30">
              <Activity className="w-12 h-12 text-white/20 mx-auto" />
            </div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
              {t("lobby.stats.noData")}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/50">
              {t("lobby.stats.noDataDescription")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
