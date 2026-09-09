"use client";

import React from "react";
import { CircleDot, Clock, PauseCircle, Shield, Sparkles, Trophy } from "lucide-react";
import { getTeamTricode, SafeText } from "../ui/SafeText";
import { usePitchClock, PAUSE_REASONS, type PauseReasonKey } from "../../lib/pitch-clock";

export interface BroadcastScorebugProps {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  matchMinute?: number;
  stoppageTime?: number;
  periodText?: string;
  status: "scheduled" | "in_progress" | "completed" | "postponed" | "cancelled";
  tournamentName?: string;
  stateBadge?: string;
  className?: string;
  clockStartedAt?: string | null;
  clockRunning?: boolean;
  clockElapsedSeconds?: number;
  clockPauseReason?: string | null;
  matchDurationMinutes?: number;
}

export function BroadcastScorebug({
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  homePenaltyScore,
  awayPenaltyScore,
  matchMinute = 0,
  stoppageTime = 0,
  periodText = "1H",
  status,
  tournamentName,
  stateBadge = "🇮🇳",
  className = "",
  clockStartedAt,
  clockRunning,
  clockElapsedSeconds,
  clockPauseReason,
  matchDurationMinutes = 50,
}: BroadcastScorebugProps) {
  const isLive = status === "in_progress";
  const isCompleted = status === "completed";
  const homeTri = getTeamTricode(homeTeamName);
  const awayTri = getTeamTricode(awayTeamName);

  const pitchClock = usePitchClock(
    clockRunning !== undefined
      ? {
          status,
          period: periodText.toLowerCase().includes("2nd") || periodText.toLowerCase().includes("second") ? "second_half" : "first_half",
          matchClockMinute: matchMinute,
          clockStartedAt,
          clockRunning,
          clockElapsedSeconds,
          stoppageMinutes: stoppageTime,
          clockPauseReason,
        }
      : null,
    Math.ceil(matchDurationMinutes / 2)
  );

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-slate-800/80 shadow-2xl ${className}`}
    >
      {/* Top Heritage Broadcast Banner */}
      <div className="bg-gradient-to-r from-amber-600/30 via-emerald-600/30 to-slate-900 px-4 py-1.5 flex items-center justify-between border-b border-slate-800 text-[11px] font-bold text-slate-300">
        <div className="flex items-center gap-2">
          <span>{stateBadge}</span>
          <span className="truncate max-w-[200px] text-amber-400 font-extrabold uppercase tracking-wider">
            {tournamentName || "All India Championship"}
          </span>
        </div>

        {isLive && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE IST
          </span>
        )}

        {isCompleted && (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider">
            FULL TIME
          </span>
        )}
      </div>

      {/* Main Television Score Grid */}
      <div className="p-4 sm:p-6 flex items-center justify-between gap-2 sm:gap-6">
        {/* Home Team Side */}
        <div className="flex-1 flex items-center gap-3 justify-end text-right min-w-0">
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-black text-white truncate max-w-[140px] sm:max-w-[200px]">
              <SafeText text={homeTeamName} maxGraphemes={18} />
            </h4>
            <span className="text-[10px] font-mono font-bold text-amber-400/80 uppercase tracking-widest hidden sm:inline-block">
              {homeTri}
            </span>
          </div>

          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-500/20 to-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-xs sm:text-sm shadow-inner shrink-0 -skew-x-6">
            <span className="skew-x-6">{homeTri.slice(0, 2)}</span>
          </div>
        </div>

        {/* Center Television Scoreboard & Clock HUD */}
        <div className="shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 min-w-[110px] sm:min-w-[140px] shadow-lg">
          <div className="flex items-center gap-2 text-2xl sm:text-4xl font-black font-mono text-white tracking-tight">
            <span>{isCompleted || isLive ? homeScore : "-"}</span>
            <span className="text-slate-600 text-lg sm:text-2xl font-light">:</span>
            <span>{isCompleted || isLive ? awayScore : "-"}</span>
          </div>

          {/* Penalty Shootout Score Pill */}
          {(homePenaltyScore !== undefined || awayPenaltyScore !== undefined) && (
            <div className="text-[10px] font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30 mt-0.5">
              PEN {homePenaltyScore || 0} - {awayPenaltyScore || 0}
            </div>
          )}

          {/* Match Clock / Period Indicator */}
          <div className="flex flex-col items-center gap-0.5 mt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300">
              {isLive ? (
                <>
                  <Clock size={11} className={`text-amber-400 ${pitchClock.isRunning ? "animate-spin" : ""}`} />
                  <span className="text-emerald-400">
                    {clockRunning !== undefined ? pitchClock.formattedClock : `${matchMinute}'`}
                  </span>
                  {clockRunning === undefined && stoppageTime > 0 && (
                    <strong className="text-amber-400">+{stoppageTime}</strong>
                  )}
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">{periodText}</span>
                </>
              ) : isCompleted ? (
                <span className="text-slate-400 font-sans uppercase text-[10px] font-extrabold tracking-wider">
                  Official Result
                </span>
              ) : (
                <span className="text-amber-400/80 font-sans uppercase text-[10px] font-bold">
                  Upcoming
                </span>
              )}
            </div>

            {/* Pulsing Pause Badge if match play is halted */}
            {isLive && clockRunning !== undefined && pitchClock.isPaused && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider animate-pulse">
                <PauseCircle size={10} />
                <span>{pitchClock.pauseConfig?.short || "Clock Paused"}</span>
              </span>
            )}
          </div>
        </div>

        {/* Away Team Side */}
        <div className="flex-1 flex items-center gap-3 justify-start text-left min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-black text-emerald-400 text-xs sm:text-sm shadow-inner shrink-0 skew-x-6">
            <span className="-skew-x-6">{awayTri.slice(0, 2)}</span>
          </div>

          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-black text-white truncate max-w-[140px] sm:max-w-[200px]">
              <SafeText text={awayTeamName} maxGraphemes={18} />
            </h4>
            <span className="text-[10px] font-mono font-bold text-emerald-400/80 uppercase tracking-widest hidden sm:inline-block">
              {awayTri}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
