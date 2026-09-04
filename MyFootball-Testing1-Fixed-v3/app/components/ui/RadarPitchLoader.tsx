"use client";

import { CircleDot, Sparkles } from "lucide-react";

type RadarPitchLoaderProps = {
  label?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
};

export function RadarPitchLoader({
  label = "Scanning Indian Matchday Telemetry...",
  sublabel = "MyFootball Bharat Live Operations Engine",
  size = "md",
}: RadarPitchLoaderProps) {
  const dimensionClass =
    size === "sm" ? "w-32 h-32" : size === "lg" ? "w-56 h-56" : "w-44 h-44";

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 text-center animate-in fade-in duration-300">
      {/* Circular Football Turf Radar Scanner */}
      <div className={`relative ${dimensionClass} rounded-full bg-emerald-950/80 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10 overflow-hidden flex items-center justify-center`}>
        {/* Pitch Mown Grass Circular Texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.2)_0%,rgba(6,78,59,0.8)_70%,rgba(2,44,34,1)_100%)]" />

        {/* Concentric Pitch Markings */}
        <div className="absolute inset-4 rounded-full border border-emerald-400/25 pointer-events-none" />
        <div className="absolute inset-10 rounded-full border border-emerald-400/35 pointer-events-none" />
        <div className="absolute inset-16 rounded-full border border-emerald-400/45 pointer-events-none" />

        {/* Pitch Crosshair Lines */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-400/20 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-400/20 pointer-events-none" />

        {/* Sweeping Radar Beam */}
        <div className="absolute inset-0 animate-radar-sweep pointer-events-none origin-center">
          <div className="w-1/2 h-1/2 origin-bottom-right bg-gradient-to-tl from-emerald-400/50 via-amber-400/20 to-transparent" />
        </div>

        {/* Pulsing Matchday Telemetry Pings */}
        <div className="absolute top-1/4 left-1/3 w-3 h-3 rounded-full bg-amber-400 animate-radar-ping pointer-events-none" />

        {/* Center Pitch Spot */}
        <div className="relative z-10 w-4 h-4 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-400 shadow-lg shadow-amber-500/50 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
        </div>
      </div>

      {/* Loading Status Text */}
      <div className="space-y-1.5 max-w-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <h4 className="text-sm font-black text-foreground tracking-tight">{label}</h4>
        </div>
        <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
          <Sparkles size={12} className="text-amber-500" />
          <span>{sublabel}</span>
        </p>
      </div>
    </div>
  );
}
