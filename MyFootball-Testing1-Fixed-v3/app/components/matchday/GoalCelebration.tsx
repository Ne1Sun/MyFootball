"use client";

import { useEffect } from "react";
import { Flame, X } from "lucide-react";

interface GoalCelebrationProps {
  scorerName: string;
  scorerJersey?: number;
  assistName?: string;
  teamName: string;
  goalType?: string;
  minute: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  onDismiss: () => void;
}

export function GoalCelebration({
  scorerName,
  scorerJersey,
  assistName,
  teamName,
  goalType = "goal",
  minute,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  onDismiss,
}: GoalCelebrationProps) {
  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#ec4899", "#8b5cf6", "#fbbf24"];
  const particles = Array.from({ length: 18 }, (_, id) => ({
    id,
    left: (id * 37 + 11) % 100,
    color: colors[(id * 5 + 2) % colors.length],
    delay: ((id * 13) % 35) / 100,
    duration: 1.6 + ((id * 17) % 12) / 10,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 overflow-hidden animate-in fade-in duration-150">
      {/* Confetti Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* Main Celebration Card */}
      <div className="relative z-10 max-w-lg w-full p-8 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 border-2 border-amber-400/60 shadow-2xl text-center space-y-6 animate-goal-zoom">
        {/* Dismiss Icon */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X size={18} />
        </button>

        {/* Goal Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest shadow-lg">
          <Flame size={16} />
          {goalType === "penalty_goal" ? "PENALTY GOAL!" : goalType === "own_goal" ? "OWN GOAL" : "GOALLLLL!"}
        </div>

        {/* Huge Animated Headline */}
        <div className="space-y-1">
          <h2 className="text-5xl sm:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 drop-shadow-md">
            ⚽ GOAL!
          </h2>
          <span className="font-mono text-sm text-slate-300 font-bold tracking-widest">{minute}&apos; MINUTE</span>
        </div>

        {/* Player & Team Info */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-700/80 space-y-2">
          <div className="flex items-center justify-center gap-2 text-2xl font-black text-white">
            {scorerJersey !== undefined && <span className="font-mono text-amber-400">#{scorerJersey}</span>}
            <span>{scorerName}</span>
          </div>
          <p className="text-emerald-400 font-bold text-sm uppercase tracking-wider">{teamName}</p>
          {assistName && (
            <p className="text-xs text-slate-400 font-medium">🎯 Assist provided by <strong className="text-slate-200">{assistName}</strong></p>
          )}
        </div>

        {/* Updated Score Display */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-white">
          <div className="flex-1 text-center font-bold text-sm truncate px-2">{homeTeam}</div>
          <div className="font-mono font-black text-3xl sm:text-4xl text-amber-400 px-3">
            {homeScore} : {awayScore}
          </div>
          <div className="flex-1 text-center font-bold text-sm truncate px-2">{awayTeam}</div>
        </div>

        {/* Continue Button */}
        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl transition"
        >
          Resume Match
        </button>
      </div>
    </div>
  );
}
