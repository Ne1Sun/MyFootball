"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Crown,
  Filter,
  Info,
  RotateCcw,
  Shield,
  Star,
  Swords,
  User,
  UserCheck,
  UserMinus,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { Player, SquadMember } from "../types";

export type Formation = "4-3-3" | "4-2-3-1" | "4-4-2" | "3-5-2" | "5-3-2" | "3-4-3";

export interface TacticalPitchProps {
  startingPlayers: Player[];
  benchPlayers?: Player[];
  teamName?: string;
  formation?: Formation;
  onFormationChange?: (formation: Formation) => void;
  isInteractive?: boolean;
  onSwapPlayer?: (playerOnPitchId: string, benchPlayerId: string) => void;
  onSwapPitchPositions?: (player1Id: string, player2Id: string) => void;
  onBenchPlayer?: (playerId: string) => void;
}

type SlotCoordinate = {
  x: number;
  y: number;
  role: "GK" | "DEF" | "MID" | "FWD";
  lineSize: number;
  lineIndex: number;
};

const FORMATION_CONFIGS: Record<Formation, { label: string; lines: Array<{ role: "GK" | "DEF" | "MID" | "FWD"; slots: Array<{ x: number; y: number }> }> }> = {
  "4-3-3": {
    label: "4-3-3 Attack",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 18, y: 72 },
          { x: 38, y: 74 },
          { x: 62, y: 74 },
          { x: 82, y: 72 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 26, y: 48 },
          { x: 50, y: 52 },
          { x: 74, y: 48 },
        ],
      },
      {
        role: "FWD",
        slots: [
          { x: 20, y: 22 },
          { x: 50, y: 16 },
          { x: 80, y: 22 },
        ],
      },
    ],
  },
  "4-2-3-1": {
    label: "4-2-3-1 Modern",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 18, y: 74 },
          { x: 38, y: 76 },
          { x: 62, y: 76 },
          { x: 82, y: 74 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 34, y: 58 },
          { x: 66, y: 58 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 20, y: 38 },
          { x: 50, y: 36 },
          { x: 80, y: 38 },
        ],
      },
      {
        role: "FWD",
        slots: [{ x: 50, y: 18 }],
      },
    ],
  },
  "4-4-2": {
    label: "4-4-2 Classic",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 18, y: 72 },
          { x: 38, y: 74 },
          { x: 62, y: 74 },
          { x: 82, y: 72 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 16, y: 48 },
          { x: 38, y: 50 },
          { x: 62, y: 50 },
          { x: 84, y: 48 },
        ],
      },
      {
        role: "FWD",
        slots: [
          { x: 35, y: 20 },
          { x: 65, y: 20 },
        ],
      },
    ],
  },
  "3-5-2": {
    label: "3-5-2 Wingback",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 24, y: 74 },
          { x: 50, y: 76 },
          { x: 76, y: 74 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 14, y: 48 },
          { x: 32, y: 52 },
          { x: 50, y: 46 },
          { x: 68, y: 52 },
          { x: 86, y: 48 },
        ],
      },
      {
        role: "FWD",
        slots: [
          { x: 35, y: 20 },
          { x: 65, y: 20 },
        ],
      },
    ],
  },
  "5-3-2": {
    label: "5-3-2 Solid",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 14, y: 68 },
          { x: 32, y: 74 },
          { x: 50, y: 76 },
          { x: 68, y: 74 },
          { x: 86, y: 68 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 26, y: 46 },
          { x: 50, y: 48 },
          { x: 74, y: 46 },
        ],
      },
      {
        role: "FWD",
        slots: [
          { x: 35, y: 20 },
          { x: 65, y: 20 },
        ],
      },
    ],
  },
  "3-4-3": {
    label: "3-4-3 Press",
    lines: [
      { role: "GK", slots: [{ x: 50, y: 88 }] },
      {
        role: "DEF",
        slots: [
          { x: 24, y: 74 },
          { x: 50, y: 76 },
          { x: 76, y: 74 },
        ],
      },
      {
        role: "MID",
        slots: [
          { x: 16, y: 48 },
          { x: 38, y: 50 },
          { x: 62, y: 50 },
          { x: 84, y: 48 },
        ],
      },
      {
        role: "FWD",
        slots: [
          { x: 20, y: 22 },
          { x: 50, y: 16 },
          { x: 80, y: 22 },
        ],
      },
    ],
  },
};

const FORMATIONS: Formation[] = ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2", "5-3-2", "3-4-3"];

export function TacticalPitch({
  startingPlayers,
  benchPlayers = [],
  teamName = "Starting XI",
  formation: propFormation,
  onFormationChange,
  isInteractive = true,
  onSwapPlayer,
  onSwapPitchPositions,
  onBenchPlayer,
}: TacticalPitchProps) {
  const [internalFormation, setInternalFormation] = useState<Formation>("4-3-3");
  const activeFormation: Formation = propFormation || internalFormation;

  const [selectedPitchPlayer, setSelectedPitchPlayer] = useState<Player | null>(null);
  const [benchPositionFilter, setBenchPositionFilter] = useState<string>("ALL");
  const [customSlotMap, setCustomSlotMap] = useState<Record<string, number> | null>(null);
  const [tacticalFeedback, setTacticalFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const handleSelectFormation = (f: Formation) => {
    setInternalFormation(f);
    setCustomSlotMap(null);
    setSelectedPitchPlayer(null);
    onFormationChange?.(f);
  };

  // Base slot list for the active formation
  const formationSlots = useMemo(() => {
    const config = FORMATION_CONFIGS[activeFormation] || FORMATION_CONFIGS["4-3-3"];
    const allSlots: SlotCoordinate[] = [];

    for (const line of config.lines) {
      const lineSize = line.slots.length;
      line.slots.forEach((s, idx) => {
        allSlots.push({
          x: s.x,
          y: s.y,
          role: line.role,
          lineSize,
          lineIndex: idx,
        });
      });
    }
    return allSlots;
  }, [activeFormation]);

  // Group starting players intelligently to match formation slots
  const playerCoordinates = useMemo(() => {
    const allSlots = formationSlots;

    // Separate players by preferred position
    const gkPool = startingPlayers.filter((p) => p.position === "GK");
    const defPool = startingPlayers.filter((p) => p.position === "DEF");
    const midPool = startingPlayers.filter((p) => p.position === "MID");
    const fwdPool = startingPlayers.filter((p) => p.position === "FWD");

    const usedPlayerIds = new Set<string>();
    const defaultAssigned: Array<{
      player: Player;
      slotIndex: number;
    }> = [];

    const takeFrom = (pool: Player[]): Player | undefined => {
      const p = pool.find((item) => !usedPlayerIds.has(item.id));
      if (p) {
        usedPlayerIds.add(p.id);
        return p;
      }
      return undefined;
    };

    // 1. Assign GK slot (slot 0)
    if (allSlots.length > 0 && allSlots[0].role === "GK") {
      const gk = takeFrom(gkPool) || takeFrom(startingPlayers);
      if (gk) {
        defaultAssigned.push({ player: gk, slotIndex: 0 });
      }
    }

    // 2. Assign outfield slots matching position preference
    for (let i = 0; i < allSlots.length; i++) {
      if (allSlots[i].role === "GK") continue;
      const slot = allSlots[i];
      let player: Player | undefined;

      if (slot.role === "DEF") player = takeFrom(defPool);
      else if (slot.role === "MID") player = takeFrom(midPool);
      else if (slot.role === "FWD") player = takeFrom(fwdPool);

      if (player) {
        defaultAssigned.push({ player, slotIndex: i });
      }
    }

    // 3. Fill any unassigned slots with remaining unplaced starting players
    const remainingUnplaced = startingPlayers.filter((p) => !usedPlayerIds.has(p.id));
    let unplacedIdx = 0;

    for (let i = 0; i < allSlots.length; i++) {
      const alreadyAssigned = defaultAssigned.some((a) => a.slotIndex === i);
      if (!alreadyAssigned && unplacedIdx < remainingUnplaced.length) {
        const p = remainingUnplaced[unplacedIdx++];
        usedPlayerIds.add(p.id);
        defaultAssigned.push({ player: p, slotIndex: i });
      }
    }

    // Apply custom slot overrides if on-pitch swaps occurred
    return defaultAssigned.map(({ player, slotIndex }) => {
      const activeSlotIndex =
        customSlotMap && customSlotMap[player.id] !== undefined
          ? customSlotMap[player.id]
          : slotIndex;
      const slot = allSlots[activeSlotIndex] || allSlots[slotIndex] || allSlots[0];
      return {
        player,
        slotIndex: activeSlotIndex,
        x: slot.x,
        y: slot.y,
        role: slot.role,
        lineSize: slot.lineSize,
        lineIndex: slot.lineIndex,
      };
    });
  }, [startingPlayers, formationSlots, customSlotMap]);

  const handlePlayerClick = (player: Player) => {
    if (!isInteractive) return;

    // If a player is ALREADY selected on pitch, and the user clicked a DIFFERENT player on pitch:
    // Execute on-pitch positional swap!
    if (selectedPitchPlayer && selectedPitchPlayer.id !== player.id) {
      const playerA = selectedPitchPlayer;
      const playerB = player;

      const coordA = playerCoordinates.find((pc) => pc.player.id === playerA.id);
      const coordB = playerCoordinates.find((pc) => pc.player.id === playerB.id);

      if (coordA && coordB) {
        setCustomSlotMap((prev) => {
          const currentMap = { ...(prev || {}) };
          // Initialize map with current slot indices if empty
          if (!prev) {
            playerCoordinates.forEach((pc) => {
              currentMap[pc.player.id] = pc.slotIndex;
            });
          }
          // Swap their slot indices
          const slotA = currentMap[playerA.id] ?? coordA.slotIndex;
          const slotB = currentMap[playerB.id] ?? coordB.slotIndex;
          currentMap[playerA.id] = slotB;
          currentMap[playerB.id] = slotA;
          return currentMap;
        });

        onSwapPitchPositions?.(playerA.id, playerB.id);
        setTacticalFeedback(
          `Swapped positions: #${playerA.jerseyNumber} ${playerA.name} ⇄ #${playerB.jerseyNumber} ${playerB.name}`
        );
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setTacticalFeedback(null), 3500);
      }

      setSelectedPitchPlayer(null);
      return;
    }

    // Otherwise toggle selection
    setSelectedPitchPlayer((prev) => (prev?.id === player.id ? null : player));
  };

  const handleResetPositions = () => {
    setCustomSlotMap(null);
    setSelectedPitchPlayer(null);
    setTacticalFeedback("Tactical positions reset to default formation slots");
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setTacticalFeedback(null), 2500);
  };

  const handleExecuteSwap = (benchPlayer: Player) => {
    if (selectedPitchPlayer && onSwapPlayer) {
      onSwapPlayer(selectedPitchPlayer.id, benchPlayer.id);
      setSelectedPitchPlayer(null);
    }
  };

  // Filtered bench players
  const filteredBench = useMemo(() => {
    if (benchPositionFilter === "ALL") return benchPlayers;
    return benchPlayers.filter((p) => p.position === benchPositionFilter);
  }, [benchPlayers, benchPositionFilter]);

  return (
    <div className="space-y-4">
      {/* Top Tactical Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
            <Shield size={16} />
          </div>
          <div>
            <strong className="text-xs sm:text-sm font-bold text-foreground block">
              {teamName} Tactical Board
            </strong>
            <span className="text-[11px] text-muted-foreground">
              {startingPlayers.length} On Pitch • {FORMATION_CONFIGS[activeFormation]?.label || activeFormation}
              {customSlotMap && " • Custom Positions"}
            </span>
          </div>
        </div>

        {/* Tactical Actions & Formation Selector */}
        <div className="flex items-center flex-wrap gap-2">
          {customSlotMap && (
            <button
              onClick={handleResetPositions}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 text-xs font-bold transition min-h-[32px] border border-amber-500/30"
              title="Reset player positions back to formation defaults"
            >
              <RotateCcw size={13} /> Reset Positions
            </button>
          )}

          {/* Compact Multi-Formation Selector */}
          <div className="flex items-center flex-wrap gap-1 p-1 rounded-xl bg-muted/70 border border-border">
            {FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => handleSelectFormation(f)}
                aria-label={`Formation ${f}`}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition min-h-[32px] ${
                  activeFormation === f
                    ? "bg-primary text-primary-foreground shadow-xs ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time Feedback Banner */}
      {tacticalFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1 shadow-xs">
          <Zap size={14} className="shrink-0 text-emerald-500" />
          <span>{tacticalFeedback}</span>
        </div>
      )}

      {/* 2D Grass Football Pitch Board */}
      <div className="football-pitch relative w-full aspect-[4/3] sm:aspect-[16/11] max-h-[560px] flex items-center justify-center shadow-2xl rounded-2xl overflow-hidden border border-emerald-950">
        {/* Pitch Lines (SVG Field Markings) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none stroke-white/60 fill-none"
          strokeWidth="1.8"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Boundary */}
          <rect x="4%" y="4%" width="92%" height="92%" rx="4" />

          {/* Half-Way Line */}
          <line x1="4%" y1="50%" x2="96%" y2="50%" />

          {/* Center Circle */}
          <circle cx="50%" cy="50%" r="14%" />
          <circle cx="50%" cy="50%" r="1.5%" fill="rgba(255,255,255,0.7)" />

          {/* Top Penalty Box (Opponent Goal) */}
          <rect x="25%" y="4%" width="50%" height="20%" />
          <rect x="37%" y="4%" width="26%" height="8%" />
          <path d="M 40% 24% A 12% 12% 0 0 0 60% 24%" />

          {/* Bottom Penalty Box (Home Goal) */}
          <rect x="25%" y="76%" width="50%" height="20%" />
          <rect x="37%" y="88%" width="26%" height="8%" />
          <path d="M 40% 76% A 12% 12% 0 0 1 60% 76%" />
          <circle cx="50%" cy="84%" r="1.2%" fill="rgba(255,255,255,0.7)" />

          {/* Corner Arcs */}
          <path d="M 4% 6% A 2% 2% 0 0 0 6% 4%" />
          <path d="M 94% 4% A 2% 2% 0 0 0 96% 6%" />
          <path d="M 4% 94% A 2% 2% 0 0 0 6% 96%" />
          <path d="M 94% 96% A 2% 2% 0 0 0 96% 94%" />
        </svg>

        {/* Player Tokens Placed on Field */}
        {playerCoordinates.map(({ player, x, y, lineSize, lineIndex }) => {
          const isGK = player.position === "GK";
          const isSelected = selectedPitchPlayer?.id === player.id;
          const isSwapTargetCandidate = selectedPitchPlayer && !isSelected;

          // SEC-04: Spatial deconfliction for lines with 4+ players on mobile (<480px)
          const needsDeconfliction = lineSize >= 4;
          const isStaggerOdd = lineIndex % 2 === 1;

          return (
            <div
              key={player.id}
              onClick={() => handlePlayerClick(player)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePlayerClick(player);
                }
              }}
              role="button"
              tabIndex={isInteractive ? 0 : -1}
              aria-label={
                isSwapTargetCandidate
                  ? `Click to swap position with #${selectedPitchPlayer.jerseyNumber} ${selectedPitchPlayer.name}`
                  : `#${player.jerseyNumber} ${player.name} (${player.position})`
              }
              title={
                isSwapTargetCandidate
                  ? `Click to swap with #${selectedPitchPlayer.jerseyNumber} ${selectedPitchPlayer.name}`
                  : player.name
              }
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`player-pitch-token absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer min-w-[44px] min-h-[44px] justify-center p-1 select-none transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl ${
                isSelected
                  ? "z-30 scale-120"
                  : isSwapTargetCandidate
                  ? "z-20 hover:scale-115"
                  : "z-10 hover:scale-110"
              }`}
            >
              {/* Token Disc - Minimum 44px Touch Target Zone */}
              <div
                className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-mono font-black text-xs sm:text-sm shadow-xl border-2 transition ${
                  isSelected
                    ? "border-amber-400 bg-amber-500 text-slate-950 ring-4 ring-amber-400/50 scale-110"
                    : isSwapTargetCandidate
                    ? "border-emerald-400/90 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white ring-2 ring-emerald-400/60 ring-dashed"
                    : isGK
                    ? "border-amber-300 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950"
                    : "border-white bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white"
                }`}
              >
                #{player.jerseyNumber}

                {/* Captain Crown */}
                {player.isCaptain && (
                  <span className="absolute -top-2.5 -right-1 p-0.5 rounded-full bg-amber-400 text-slate-950 shadow-md">
                    <Crown size={10} />
                  </span>
                )}
              </div>

              {/* Name Tag with SEC-04 mobile vertical staggering (±12px) */}
              <div
                className={`mt-0.5 px-1.5 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-sm border text-[10px] sm:text-[11px] font-bold text-white max-w-[80px] sm:max-w-[100px] truncate text-center shadow-md transition-all ${
                  isSelected
                    ? "border-amber-400 text-amber-300"
                    : isSwapTargetCandidate
                    ? "border-emerald-400/70 text-emerald-200"
                    : "border-white/20"
                } ${
                  needsDeconfliction
                    ? isStaggerOdd
                      ? "translate-y-[10px] sm:translate-y-0"
                      : "-translate-y-[4px] sm:translate-y-0"
                    : ""
                }`}
                title={player.name}
              >
                {player.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Selected Player Substitution Drawer */}
      {selectedPitchPlayer && isInteractive && (
        <div className="p-4 rounded-2xl bg-card border-2 border-emerald-500/40 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-emerald-500 text-white font-mono font-bold text-sm flex items-center justify-center shadow-xs">
                #{selectedPitchPlayer.jerseyNumber}
              </span>
              <div>
                <strong className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                  {selectedPitchPlayer.name}
                  {selectedPitchPlayer.isCaptain && <Crown size={13} className="text-amber-500" />}
                </strong>
                <span className="text-[11px] text-muted-foreground">
                  Position: <span className="font-bold text-foreground">{selectedPitchPlayer.position}</span> •{" "}
                  {selectedPitchPlayer.dateOfBirth ? `DOB: ${selectedPitchPlayer.dateOfBirth}` : "Active Squad"}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedPitchPlayer(null)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tactical Prompt Banner */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
            <RotateCcw size={14} className="shrink-0 text-amber-500" />
            <span>
              <strong>Tactical Actions:</strong> Tap any teammate on the pitch to swap positions, or select a bench player below to substitute.
            </span>
          </div>

          {/* Quick Swap with Bench */}
          {benchPlayers.length > 0 && onSwapPlayer ? (
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Tap a Bench Player to Swap:
              </span>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {benchPlayers.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => handleExecuteSwap(bp)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-emerald-500 hover:text-white border border-border text-xs font-semibold transition min-h-[36px]"
                  >
                    <span className="font-mono font-bold">#{bp.jerseyNumber}</span>
                    <span className="truncate max-w-[120px]">{bp.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 text-foreground font-mono">
                      {bp.position}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic pt-2 border-t border-border">
              No bench substitutes available to swap.
            </p>
          )}

          {onBenchPlayer && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  onBenchPlayer(selectedPitchPlayer.id);
                  setSelectedPitchPlayer(null);
                }}
                className="text-xs px-3.5 py-2 rounded-xl bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 font-bold transition flex items-center gap-1.5 min-h-[36px]"
              >
                <UserMinus size={14} /> Send to Bench
              </button>
            </div>
          )}
        </div>
      )}

      {/* Substitutes Bench Container (Comfortably handles up to 18 substitutes) */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/80">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <strong className="text-xs sm:text-sm font-bold text-foreground">
              Substitutes Bench
            </strong>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {benchPlayers.length} / 18
            </span>
          </div>

          {/* Bench Position Filter */}
          {benchPlayers.length > 4 && (
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
              {["ALL", "GK", "DEF", "MID", "FWD"].map((pos) => (
                <button
                  key={pos}
                  onClick={() => setBenchPositionFilter(pos)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition ${
                    benchPositionFilter === pos
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          )}
        </div>

        {benchPlayers.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground italic">
            No players currently on the substitutes bench.
          </div>
        ) : (
          <div className="max-h-56 sm:max-h-72 overflow-y-auto pr-1 scrollbar-thin">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredBench.map((bp) => {
                const isGK = bp.position === "GK";
                return (
                  <div
                    key={bp.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                          isGK ? "bg-amber-500/20 text-amber-500" : "bg-primary/15 text-primary"
                        }`}
                      >
                        #{bp.jerseyNumber}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-foreground truncate block" title={bp.name}>
                          {bp.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {bp.position}
                          {bp.isCaptain && " • (C)"}
                        </span>
                      </div>
                    </div>

                    {isInteractive && onSwapPlayer && selectedPitchPlayer && (
                      <button
                        onClick={() => handleExecuteSwap(bp)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 font-bold shrink-0 transition min-h-[30px]"
                      >
                        Sub In
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
