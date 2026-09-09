"use client";

import { useEffect, useRef, useState } from "react";

export type PauseReasonKey =
  | "foul"
  | "injury"
  | "cooling_break"
  | "tactical"
  | "var"
  | "manual";

export interface PauseReasonConfig {
  key: PauseReasonKey;
  label: string;
  short: string;
  icon: string;
  color: string;
}

export const PAUSE_REASONS: Record<PauseReasonKey, PauseReasonConfig> = {
  foul: {
    key: "foul",
    label: "Foul / Free Kick Administration",
    short: "Foul / Free Kick",
    icon: "🟨",
    color: "bg-amber-500/20 text-amber-500 border-amber-500/40",
  },
  injury: {
    key: "injury",
    label: "Injury / Physio on Pitch",
    short: "Injury / Physio",
    icon: "🚑",
    color: "bg-rose-500/20 text-rose-500 border-rose-500/40",
  },
  cooling_break: {
    key: "cooling_break",
    label: "Official Cooling / Drinks Break",
    short: "Cooling Break",
    icon: "💧",
    color: "bg-cyan-500/20 text-cyan-500 border-cyan-500/40",
  },
  tactical: {
    key: "tactical",
    label: "Tactical / Ball Out of Play",
    short: "Tactical Delay",
    icon: "⏸️",
    color: "bg-purple-500/20 text-purple-500 border-purple-500/40",
  },
  var: {
    key: "var",
    label: "Referee Consultation / Review",
    short: "Referee Review",
    icon: "📺",
    color: "bg-blue-500/20 text-blue-500 border-blue-500/40",
  },
  manual: {
    key: "manual",
    label: "Play Paused by Referee",
    short: "Play Paused",
    icon: "⏸️",
    color: "bg-slate-500/20 text-slate-400 border-slate-500/40",
  },
};

export interface PitchClockFixtureInput {
  status?: string | null;
  period?: string | null;
  matchClockMinute?: number | null;
  clockStartedAt?: string | null;
  clockRunning?: boolean | null;
  clockElapsedSeconds?: number | null;
  stoppageMinutes?: number | null;
  clockPauseReason?: string | null;
}

export interface PitchClockState {
  totalSeconds: number;
  displayMinute: number;
  displaySecond: number;
  isStoppage: boolean;
  stoppageSeconds: number;
  stoppageAllowanceMinutes: number;
  formattedClock: string; // e.g. "36:42" or "45:00 +02:15"
  formattedShort: string; // e.g. "37'" or "45' +3'"
  isRunning: boolean;
  isPaused: boolean;
  pauseReason: PauseReasonKey | null;
  pauseConfig: PauseReasonConfig | null;
}

/**
 * Pure deterministic calculation of instantaneous pitch clock state.
 * O(1) mathematical formulation invariant to operating system clock skew.
 */
export function calculatePitchClock(
  fixture?: PitchClockFixtureInput | null,
  nominalHalfMinutes: number = 45,
  clientNowMs: number = Date.now()
): PitchClockState {
  const isRunning = Boolean(fixture?.clockRunning);
  const status = fixture?.status || "scheduled";
  const period = fixture?.period || "scheduled";
  const stoppageAllowanceMinutes = Math.max(0, fixture?.stoppageMinutes || 0);
  const rawPauseReason = (fixture?.clockPauseReason as PauseReasonKey) || null;
  const pauseConfig = rawPauseReason && PAUSE_REASONS[rawPauseReason] ? PAUSE_REASONS[rawPauseReason] : null;

  // Base accumulated seconds
  let totalSeconds = Math.max(0, fixture?.clockElapsedSeconds || 0);

  // If clock is actively ticking and match is in progress
  if (isRunning && status === "in_progress" && fixture?.clockStartedAt) {
    const startedMs = Date.parse(fixture.clockStartedAt);
    if (!Number.isNaN(startedMs) && clientNowMs > startedMs) {
      const liveDelta = Math.floor((clientNowMs - startedMs) / 1000);
      totalSeconds += Math.max(0, liveDelta);
    }
  }

  // Determine nominal regulation limit for current period
  const isSecondHalf = period === "second_half";
  const nominalPeriodMinutes = isSecondHalf ? nominalHalfMinutes * 2 : nominalHalfMinutes;
  const nominalPeriodSeconds = nominalPeriodMinutes * 60;

  const isStoppage = totalSeconds > nominalPeriodSeconds;
  const stoppageSeconds = isStoppage ? totalSeconds - nominalPeriodSeconds : 0;

  const displayMinute = Math.max(1, Math.floor(totalSeconds / 60) + 1);
  const displaySecond = totalSeconds % 60;

  let formattedClock = "";
  let formattedShort = "";

  if (!isStoppage) {
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    formattedClock = `${mm}:${ss}`;
    formattedShort = `${displayMinute}'`;
  } else {
    const regMm = String(nominalPeriodMinutes).padStart(2, "0");
    const stopMm = String(Math.floor(stoppageSeconds / 60)).padStart(2, "0");
    const stopSs = String(stoppageSeconds % 60).padStart(2, "0");
    formattedClock = `${regMm}:00 +${stopMm}:${stopSs}`;

    const stopMin = Math.floor(stoppageSeconds / 60) + 1;
    const addedBadge = stoppageAllowanceMinutes > 0 ? `+${stoppageAllowanceMinutes}'` : `+${stopMin}'`;
    formattedShort = `${nominalPeriodMinutes}' ${addedBadge}`;
  }

  const isPaused = !isRunning && status === "in_progress" && period !== "half_time" && period !== "completed";

  return {
    totalSeconds,
    displayMinute,
    displaySecond,
    isStoppage,
    stoppageSeconds,
    stoppageAllowanceMinutes,
    formattedClock,
    formattedShort,
    isRunning,
    isPaused,
    pauseReason: rawPauseReason,
    pauseConfig,
  };
}

/**
 * High-performance React hook for autonomous pitch clock rendering.
 * Uses monotonic performance.now() delta and auto-resynchronizes on tab focus/visibility.
 */
export function usePitchClock(
  fixture?: PitchClockFixtureInput | null,
  nominalHalfMinutes: number = 45
): PitchClockState {
  const [clockState, setClockState] = useState<PitchClockState>(() =>
    calculatePitchClock(fixture, nominalHalfMinutes, Date.now())
  );

  const perfAnchorRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const dateAnchorRef = useRef<number>(Date.now());

  useEffect(() => {
    // Immediate initial sync
    perfAnchorRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    dateAnchorRef.current = Date.now();
    setClockState(calculatePitchClock(fixture, nominalHalfMinutes, dateAnchorRef.current));

    if (!fixture?.clockRunning || fixture.status !== "in_progress") {
      return;
    }

    // High-resolution 1-second interval
    const interval = setInterval(() => {
      const perfNow = typeof performance !== "undefined" ? performance.now() : 0;
      const perfDelta = perfNow - perfAnchorRef.current;
      const nowMs = dateAnchorRef.current + perfDelta;
      setClockState(calculatePitchClock(fixture, nominalHalfMinutes, nowMs));
    }, 1000);

    // Visibility change handler to immediately eliminate sleep drift
    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        perfAnchorRef.current = typeof performance !== "undefined" ? performance.now() : 0;
        dateAnchorRef.current = Date.now();
        setClockState(calculatePitchClock(fixture, nominalHalfMinutes, dateAnchorRef.current));
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [
    fixture?.clockRunning,
    fixture?.clockStartedAt,
    fixture?.clockElapsedSeconds,
    fixture?.stoppageMinutes,
    fixture?.clockPauseReason,
    fixture?.period,
    fixture?.status,
    nominalHalfMinutes,
  ]);

  return clockState;
}
