"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  FastForward,
  Flag,
  LoaderCircle,
  MapPin,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Star,
  Swords,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import type { Division, Entry, Fixture, MatchEvent, Player, SquadMember } from "../types";
import { GoalCelebration } from "./GoalCelebration";
import { TacticalPitch } from "../tactics/TacticalPitch";
import { computeSubstitutionState } from "../../lib/substitution-rules";
import { usePitchClock, PAUSE_REASONS, type PauseReasonKey } from "../../lib/pitch-clock";

export function LiveMatchConsole({
  divisions,
  entries,
  fixtures,
  events,
  players,
  squadMembers,
  initialFixtureId,
  onSaveAction,
}: {
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  events: MatchEvent[];
  players: Player[];
  squadMembers: SquadMember[];
  initialFixtureId?: string;
  onSaveAction: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(
    initialFixtureId || fixtures.find((f) => f.status === "in_progress")?.id || fixtures[0]?.id || ""
  );

  useEffect(() => {
    if (initialFixtureId && fixtures.some((f) => f.id === initialFixtureId)) {
      setSelectedFixtureId(initialFixtureId);
    } else if (fixtures.length > 0 && !fixtures.some((f) => f.id === selectedFixtureId)) {
      setSelectedFixtureId(fixtures.find((f) => f.status === "in_progress")?.id || fixtures[0].id);
    }
  }, [initialFixtureId, fixtures, selectedFixtureId]);

  const [activeModal, setActiveModal] = useState<"goal" | "card" | "sub" | "potm" | null>(null);
  const [matchViewTab, setMatchViewTab] = useState<"events" | "tactics">("events");
  const [tacticsTeam, setTacticsTeam] = useState<"home" | "away">("home");
  const [celebrationData, setCelebrationData] = useState<{
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
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // Clock local timer state for active match
  const currentFixture = fixtures.find((f) => f.id === selectedFixtureId) || fixtures[0];
  const homeEntry = entries.find((e) => e.id === currentFixture?.homeEntryId);
  const awayEntry = entries.find((e) => e.id === currentFixture?.awayEntryId);
  const division = divisions.find((d) => d.id === currentFixture?.divisionId);

  // Autonomous IFAB Pitch Clock Engine
  const pitchClock = usePitchClock(
    currentFixture,
    Math.ceil((division?.matchDurationMinutes || 90) / 2)
  );

  // Match events for selected fixture
  const fixtureEvents = useMemo(() => {
    if (!currentFixture) return [];
    return events
      .filter((e) => e.fixtureId === currentFixture.id)
      .sort((a, b) => b.matchMinute - a.matchMinute);
  }, [events, currentFixture]);

  // Squads for Home and Away entries
  const homeSquadMembers = squadMembers.filter((sm) => sm.entryId === homeEntry?.id);
  const awaySquadMembers = squadMembers.filter((sm) => sm.entryId === awayEntry?.id);

  const homePlayers = players.filter((p) => homeSquadMembers.some((sm) => sm.playerId === p.id));
  const awayPlayers = players.filter((p) => awaySquadMembers.some((sm) => sm.playerId === p.id));

  // Goal modal form state
  const [goalTeam, setGoalTeam] = useState<string>(homeEntry?.id || "");
  const [goalScorerId, setGoalScorerId] = useState<string>("");
  const [goalAssistId, setGoalAssistId] = useState<string>("");
  const [goalType, setGoalType] = useState<string>("goal");
  const [goalMinute, setGoalMinute] = useState<number>(currentFixture?.matchClockMinute || 1);

  // Card modal form state
  const [cardTeam, setCardTeam] = useState<string>(homeEntry?.id || "");
  const [cardPlayerId, setCardPlayerId] = useState<string>("");
  const [cardType, setCardType] = useState<string>("yellow_card");
  const [cardReason, setCardReason] = useState<string>("Tactical Foul");
  const [cardMinute, setCardMinute] = useState<number>(currentFixture?.matchClockMinute || 1);

  // Sub modal form state
  const [subTeam, setSubTeam] = useState<string>(homeEntry?.id || "");
  const [subPlayerOutId, setSubPlayerOutId] = useState<string>("");
  const [subPlayerInId, setSubPlayerInId] = useState<string>("");
  const [subMinute, setSubMinute] = useState<number>(currentFixture?.matchClockMinute || 45);

  // Potm form state
  const [potmPlayerId, setPotmPlayerId] = useState<string>("");

  // Auto-sync event modal minutes with running pitch clock
  useEffect(() => {
    if (currentFixture?.status === "in_progress") {
      setGoalMinute(pitchClock.displayMinute);
      setCardMinute(pitchClock.displayMinute);
      setSubMinute(pitchClock.displayMinute);
    }
  }, [pitchClock.displayMinute, currentFixture?.status]);

  // IFAB Law 3 live substitution states
  const homeSubState = useMemo(() => {
    if (!homeEntry || !currentFixture) return null;
    return computeSubstitutionState(homeEntry.id, fixtureEvents as any, currentFixture.period);
  }, [homeEntry, currentFixture, fixtureEvents]);

  const awaySubState = useMemo(() => {
    if (!awayEntry || !currentFixture) return null;
    return computeSubstitutionState(awayEntry.id, fixtureEvents as any, currentFixture.period);
  }, [awayEntry, currentFixture, fixtureEvents]);

  const activeSubState = subTeam === homeEntry?.id ? homeSubState : awaySubState;

  useEffect(() => {
    if (homeEntry) setGoalTeam(homeEntry.id);
  }, [homeEntry]);

  // Clock Actions
  const handleUpdateClock = async (minute: number, period: string, status?: string) => {
    if (!currentFixture) return;
    setBusy(true);
    await onSaveAction({
      action: "updateLiveMatch",
      fixtureId: currentFixture.id,
      matchClockMinute: minute,
      period,
      status: status || currentFixture.status,
    });
    setBusy(false);
  };

  const handlePauseClock = async (reason = "manual") => {
    if (!currentFixture) return;
    setBusy(true);
    await onSaveAction({
      action: "pauseMatchClock",
      fixtureId: currentFixture.id,
      reason,
    });
    setBusy(false);
  };

  const handleResumeClock = async () => {
    if (!currentFixture) return;
    setBusy(true);
    await onSaveAction({
      action: "resumeMatchClock",
      fixtureId: currentFixture.id,
    });
    setBusy(false);
  };

  const handleSetStoppageTime = async (stoppageMinutes: number) => {
    if (!currentFixture) return;
    setBusy(true);
    await onSaveAction({
      action: "setStoppageTime",
      fixtureId: currentFixture.id,
      stoppageMinutes,
    });
    setBusy(false);
  };

  const handleStartMatch = async () => {
    if (!currentFixture) return;
    await handleUpdateClock(currentFixture.matchClockMinute || 1, "first_half", "in_progress");
  };

  const handlePauseMatch = async () => {
    if (!currentFixture) return;
    await handleUpdateClock(currentFixture.matchClockMinute, "half_time", "in_progress");
  };

  const handleStartSecondHalf = async () => {
    if (!currentFixture) return;
    const secondHalfMinute = division ? Math.floor(division.matchDurationMinutes / 2) + 1 : 46;
    await handleUpdateClock(secondHalfMinute, "second_half", "in_progress");
  };

  const handleCompleteMatch = async () => {
    if (!currentFixture) return;
    if (!confirm("Are you sure you want to finalize and complete this match?")) return;
    const finishMinute = division?.matchDurationMinutes || 90;
    await handleUpdateClock(finishMinute, "completed", "completed");

    // Automatically advance winner if knockout match finishes with decisive score or penalties
    const isScoreDecisive = currentFixture.homeScore !== currentFixture.awayScore;
    const isPenDecisive =
      currentFixture.homeScore === currentFixture.awayScore &&
      (currentFixture.homeScorePenalties || 0) !== (currentFixture.awayScorePenalties || 0);

    if (currentFixture.stage === "knockout" && (isScoreDecisive || isPenDecisive)) {
      const homeWon = isScoreDecisive
        ? currentFixture.homeScore > currentFixture.awayScore
        : (currentFixture.homeScorePenalties || 0) > (currentFixture.awayScorePenalties || 0);
      const winnerId = homeWon ? currentFixture.homeEntryId : currentFixture.awayEntryId;
      const loserId = homeWon ? currentFixture.awayEntryId : currentFixture.homeEntryId;
      if (winnerId && loserId) {
        await onSaveAction({
          action: "advanceBracketWinner",
          fixtureId: currentFixture.id,
          winningEntryId: winnerId,
          losingEntryId: loserId,
          homeScorePenalties: currentFixture.homeScorePenalties || 0,
          awayScorePenalties: currentFixture.awayScorePenalties || 0,
        }).catch(() => {});
      }
    }
  };

  // Event submission
  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    setBusy(true);

    const isHome = goalTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const scorer = teamPlayers.find((p) => p.id === goalScorerId);
    const assist = teamPlayers.find((p) => p.id === goalAssistId);

    await onSaveAction({
      action: "recordDetailedMatchEvent",
      fixtureId: currentFixture.id,
      entryId: goalTeam,
      type: goalType,
      playerName: scorer?.name || "Player",
      playerId: scorer?.id || null,
      assistPlayerName: assist?.name || "",
      assistPlayerId: assist?.id || null,
      matchMinute: goalMinute,
      matchPeriod: currentFixture.period || "first_half",
    });

    const isOwnGoal = goalType === "own_goal";
    const awardedHome = isOwnGoal ? !isHome : isHome;

    setCelebrationData({
      scorerName: scorer?.name || "Player",
      scorerJersey: scorer?.jerseyNumber,
      assistName: assist?.name || "",
      teamName: isHome ? homeEntry?.teamName || "Home" : awayEntry?.teamName || "Away",
      goalType,
      minute: goalMinute,
      homeTeam: homeEntry?.teamName || "Home",
      awayTeam: awayEntry?.teamName || "Away",
      homeScore: awardedHome ? currentFixture.homeScore + 1 : currentFixture.homeScore,
      awayScore: !awardedHome ? currentFixture.awayScore + 1 : currentFixture.awayScore,
    });

    setBusy(false);
    setActiveModal(null);
  };

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    setBusy(true);

    const isHome = cardTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const player = teamPlayers.find((p) => p.id === cardPlayerId);

    await onSaveAction({
      action: "recordDetailedMatchEvent",
      fixtureId: currentFixture.id,
      entryId: cardTeam,
      type: cardType,
      playerName: player?.name || "Player",
      playerId: player?.id || null,
      cardReason,
      matchMinute: cardMinute,
      matchPeriod: currentFixture.period || "first_half",
    });

    setBusy(false);
    setActiveModal(null);
  };

  const handleSubmitSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    setBusy(true);

    const isHome = subTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const playerOut = teamPlayers.find((p) => p.id === subPlayerOutId);
    const playerIn = teamPlayers.find((p) => p.id === subPlayerInId);

    await onSaveAction({
      action: "recordDetailedMatchEvent",
      fixtureId: currentFixture.id,
      entryId: subTeam,
      type: "substitution",
      playerName: playerOut?.name || "Player Out",
      playerId: playerOut?.id || null,
      relatedPlayerName: playerIn?.name || "Player In",
      assistPlayerId: playerIn?.id || null,
      matchMinute: subMinute,
      matchPeriod: currentFixture.period || "second_half",
    });

    setBusy(false);
    setActiveModal(null);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Delete this match event? If this was a goal, score will automatically adjust.")) return;
    setBusy(true);
    await onSaveAction({
      action: "deleteMatchEvent",
      eventId,
    });
    setBusy(false);
  };

  const handleSetPOTM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    const allPlayers = [...homePlayers, ...awayPlayers];
    const player = allPlayers.find((p) => p.id === potmPlayerId);
    if (!player) return;

    setBusy(true);
    await onSaveAction({
      action: "setPOTM",
      fixtureId: currentFixture.id,
      potmPlayerId: player.id,
      potmPlayerName: player.name,
    });
    setBusy(false);
    setActiveModal(null);
  };

  if (fixtures.length === 0) {
    return (
      <div className="empty-card">
        <Swords size={36} />
        <h3>No Fixtures Scheduled</h3>
        <p>Generate fixtures in the Fixtures tab to use the pitch-side Live Match Console.</p>
      </div>
    );
  }

  const getEventBadge = (type: string) => {
    switch (type) {
      case "goal":
      case "penalty_goal":
        return <span className="p-1 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">⚽ Goal</span>;
      case "yellow_card":
        return <span className="p-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">🟨 Yellow</span>;
      case "red_card":
        return <span className="p-1 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">🟥 Red</span>;
      case "substitution":
        return <span className="p-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">🔄 Sub</span>;
      default:
        return <span className="p-1 rounded bg-muted text-muted-foreground font-bold">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Match Selector Strip */}
      <div className="panel-card p-4 rounded-2xl bg-card border border-border flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-3 min-w-max">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Select Match:</span>
          <select
            value={selectedFixtureId}
            onChange={(e) => setSelectedFixtureId(e.target.value)}
            className="font-bold text-sm bg-muted px-3 py-1.5 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
          >
            {fixtures.map((f) => {
              const h = entries.find((e) => e.id === f.homeEntryId);
              const a = entries.find((e) => e.id === f.awayEntryId);
              return (
                <option key={f.id} value={f.id} className="bg-popover text-popover-foreground">
                  {f.roundName} : {h?.teamName || "TBD"} vs {a?.teamName || "TBD"} [{f.status.toUpperCase()}]
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-max">
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
            Pitch {currentFixture?.pitch}
          </span>
          <span>•</span>
          <span>{currentFixture?.roundName}</span>
        </div>
      </div>

      {/* Main Pitch-Side Scoreboard & Live Clock */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-700/50">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Bar: Match Status & Clock */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                currentFixture?.status === "in_progress"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                  : currentFixture?.status === "completed"
                  ? "bg-slate-700 text-slate-300"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              }`}
            >
              {currentFixture?.status === "in_progress" && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
              {currentFixture?.status === "in_progress" ? "LIVE ON PITCH" : currentFixture?.status.toUpperCase()}
            </span>

            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold ${
              pitchClock.isPaused
                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                : "bg-slate-800/80 border-slate-700 text-slate-300"
            }`}>
              <Clock size={13} className="text-amber-400" />
              <span>{pitchClock.formattedClock}</span>
              {pitchClock.isPaused && <span className="text-amber-400 font-sans font-black text-[10px]">PAUSED</span>}
              <span className="text-slate-500">|</span>
              <span className="uppercase text-[11px] text-primary">{currentFixture?.period.replace("_", " ")}</span>
            </div>
          </div>

          {/* Match Control Buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {currentFixture?.status !== "in_progress" ? (
              <button
                onClick={handleStartMatch}
                disabled={busy}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.975] text-white font-bold text-xs shadow-lg transition-transform duration-100 ease-out"
              >
                <Play size={13} fill="currentColor" /> Start Kick-Off
              </button>
            ) : (
              <>
                {/* 1-Tap Clock Pause/Resume */}
                {pitchClock.isPaused ? (
                  <button
                    onClick={handleResumeClock}
                    disabled={busy}
                    className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.975] text-xs font-bold text-white transition-transform shadow-sm"
                    title="Resume Pitch Clock"
                  >
                    <Play size={13} fill="currentColor" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={() => handlePauseClock("manual")}
                    disabled={busy}
                    className="inline-flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-[0.975] text-xs font-bold text-white transition-transform shadow-sm"
                    title="Pause Pitch Clock"
                  >
                    <Pause size={13} fill="currentColor" /> Pause
                  </button>
                )}

                {/* Stoppage Time Quick Increments */}
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
                  <span className="text-[11px] text-slate-400 font-bold">Stop:</span>
                  {[1, 2, 3, 5].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => handleSetStoppageTime(mins)}
                      disabled={busy}
                      className={`min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg text-xs font-mono font-bold transition active:scale-95 ${
                        pitchClock.stoppageAllowanceMinutes === mins
                          ? "bg-amber-500 text-slate-950 font-black"
                          : "hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      +{mins}&apos;
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleUpdateClock((currentFixture?.matchClockMinute || 0) + 1, currentFixture?.period || "first_half")}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-mono text-white transition"
                  title="Add 1 Minute"
                >
                  <FastForward size={13} /> +1&apos;
                </button>
                {currentFixture?.period === "half_time" ? (
                  <button
                    onClick={handleStartSecondHalf}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition min-h-[36px]"
                  >
                    <Play size={13} fill="currentColor" /> Start 2nd Half
                  </button>
                ) : (
                  <button
                    onClick={handlePauseMatch}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-xs font-bold text-white transition min-h-[36px]"
                  >
                    <Pause size={13} /> Half-Time
                  </button>
                )}
                <button
                  onClick={handleCompleteMatch}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white border border-slate-600 transition"
                >
                  <CheckCircle2 size={13} /> Full-Time Whistle
                </button>
              </>
            )}
          </div>
        </div>

        {/* Score Display */}
        <div className="relative z-10 grid grid-cols-3 items-center py-8 gap-4 text-center">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-slate-800 flex items-center justify-center font-black text-2xl text-primary border border-primary/30 shadow-lg">
              <Shield size={34} />
            </div>
            <h2 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">{homeEntry?.teamName || "Home Team"}</h2>
            <span className="text-xs text-slate-400 font-medium">{homeEntry?.clubName}</span>
            {currentFixture?.homeScorePenalties > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 font-bold">
                (Pen: {currentFixture.homeScorePenalties})
              </span>
            )}
            {homeSubState && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Subs: {homeSubState.usedSubs}/5 ({homeSubState.usedWindows}/3 Win)
              </span>
            )}
          </div>

          {/* Live Score Digit */}
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-3 sm:gap-6 font-black text-5xl sm:text-7xl tracking-tighter text-white font-mono">
              <span className="w-16 sm:w-20 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner">
                {currentFixture?.homeScore ?? 0}
              </span>
              <span className="text-slate-600 font-light">:</span>
              <span className="w-16 sm:w-20 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner">
                {currentFixture?.awayScore ?? 0}
              </span>
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-2">
              {currentFixture?.stage === "knockout" ? "Knockout Match" : "Group Stage"}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500/30 to-slate-800 flex items-center justify-center font-black text-2xl text-blue-400 border border-blue-500/30 shadow-lg">
              <Shield size={34} />
            </div>
            <h2 className="font-extrabold text-lg sm:text-xl text-white tracking-tight">{awayEntry?.teamName || "Away Team"}</h2>
            <span className="text-xs text-slate-400 font-medium">{awayEntry?.clubName}</span>
            {currentFixture?.awayScorePenalties > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold">
                (Pen: {currentFixture.awayScorePenalties})
              </span>
            )}
            {awaySubState && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Subs: {awaySubState.usedSubs}/5 ({awaySubState.usedWindows}/3 Win)
              </span>
            )}
          </div>
        </div>

        {/* Quick Pitch-Side Action Bar */}
        <div className="relative z-10 pt-6 border-t border-slate-700/50 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              setGoalMinute(currentFixture?.matchClockMinute || 1);
              setActiveModal("goal");
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition"
          >
            <span>⚽</span> Record Goal / Scorer
          </button>
          <button
            onClick={() => {
              setCardMinute(currentFixture?.matchClockMinute || 1);
              setActiveModal("card");
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition"
          >
            <span>🟨</span> Issue Booking / Card
          </button>
          <button
            onClick={() => {
              setSubMinute(currentFixture?.matchClockMinute || 45);
              setActiveModal("sub");
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition"
          >
            <span>🔄</span> Log Substitution
          </button>
          <button
            onClick={() => setActiveModal("potm")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-amber-400 font-bold text-sm border border-slate-600 transition"
          >
            <Star size={16} fill="currentColor" /> Select POTM
          </button>
        </div>

        {/* POTM Banner if assigned */}
        {currentFixture?.potmPlayerName && (
          <div className="relative z-10 mt-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-xs font-bold text-amber-300">
            <Award size={16} className="text-amber-400" />
            <span>PLAYER OF THE MATCH: {currentFixture.potmPlayerName.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Grid: Live Match Timeline & Squad Lineups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Timeline & Tactical Pitch Stream */}
        <div className="lg:col-span-2 panel-card rounded-2xl p-6 bg-card border border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-border gap-3">
            <div className="flex items-center gap-2 p-1 bg-muted rounded-xl">
              <button
                type="button"
                onClick={() => setMatchViewTab("events")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] flex items-center gap-1.5 ${
                  matchViewTab === "events"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp size={14} className={matchViewTab === "events" ? "text-primary" : ""} />
                Match Timeline ({fixtureEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setMatchViewTab("tactics")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition min-h-[36px] flex items-center gap-1.5 ${
                  matchViewTab === "tactics"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users size={14} className={matchViewTab === "tactics" ? "text-primary" : ""} />
                2D Tactical Pitch
              </button>
            </div>

            {matchViewTab === "tactics" && (
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTacticsTeam("home")}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    tacticsTeam === "home"
                      ? "bg-primary/20 text-primary border-primary/40 font-black"
                      : "text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {homeEntry?.teamName || "Home"}
                </button>
                <button
                  type="button"
                  onClick={() => setTacticsTeam("away")}
                  className={`px-3 py-1.5 rounded-lg border transition ${
                    tacticsTeam === "away"
                      ? "bg-primary/20 text-primary border-primary/40 font-black"
                      : "text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {awayEntry?.teamName || "Away"}
                </button>
              </div>
            )}
          </div>

          {matchViewTab === "tactics" ? (
            <div className="py-2">
              {(() => {
                const activeSquadMembers = tacticsTeam === "home" ? homeSquadMembers : awaySquadMembers;
                const activeTeamPlayers = tacticsTeam === "home" ? homePlayers : awayPlayers;
                const activeStartingPlayers = activeTeamPlayers.filter((p) =>
                  activeSquadMembers.some((sm) => sm.playerId === p.id && sm.isStarting)
                );
                const activeBenchPlayers = activeTeamPlayers.filter((p) =>
                  activeSquadMembers.some((sm) => sm.playerId === p.id && !sm.isStarting)
                );

                return (
                  <TacticalPitch
                    startingPlayers={activeStartingPlayers}
                    benchPlayers={activeBenchPlayers}
                    teamName={tacticsTeam === "home" ? homeEntry?.teamName : awayEntry?.teamName}
                    isInteractive={false}
                  />
                );
              })()}
            </div>
          ) : fixtureEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm italic">
              No match events logged yet. Use the action buttons above to record goals, cards, and substitutions.
            </div>
          ) : (
            <div className="space-y-3">
              {fixtureEvents.map((ev) => {
                const eventTeam = entries.find((e) => e.id === ev.entryId);
                return (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-background flex items-center justify-center font-mono font-bold text-xs text-foreground shadow-sm">
                        {ev.matchMinute}&apos;
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm font-bold text-foreground">{ev.playerName}</strong>
                          {getEventBadge(ev.type)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="font-semibold text-foreground/80">{eventTeam?.teamName}</span>
                          {ev.assistPlayerName && <span>• Assist: <strong>{ev.assistPlayerName}</strong></span>}
                          {ev.relatedPlayerName && <span>• Replaced by: <strong>{ev.relatedPlayerName}</strong></span>}
                          {ev.cardReason && <span>• Reason: <em>{ev.cardReason}</em></span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      title="Undo / Delete Event"
                      aria-label={`Delete event at minute ${ev.matchMinute}`}
                      className="p-2 text-muted-foreground hover:text-rose-500 transition rounded-lg hover:bg-rose-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pitch Lineups */}
        <div className="panel-card rounded-2xl p-6 bg-card border border-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <h3 className="font-bold text-base text-foreground">Active Squad Lineups</h3>
            </div>
          </div>

          {/* Home Team Squad */}
          <div className="space-y-2">
            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              {homeEntry?.teamName} ({homePlayers.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {homePlayers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-muted border border-border text-foreground font-medium"
                >
                  <strong className="font-mono text-muted-foreground">#{p.jerseyNumber}</strong> {p.name}
                  {p.isCaptain && <Crown size={11} className="text-amber-500" />}
                </span>
              ))}
            </div>
          </div>

          <hr className="border-border my-2" />

          {/* Away Team Squad */}
          <div className="space-y-2">
            <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              {awayEntry?.teamName} ({awayPlayers.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {awayPlayers.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-muted border border-border text-foreground font-medium"
                >
                  <strong className="font-mono text-muted-foreground">#{p.jerseyNumber}</strong> {p.name}
                  {p.isCaptain && <Crown size={11} className="text-amber-500" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Modal */}
      {activeModal === "goal" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Match Events</span>
                <h2>Record Goal</h2>
                <p>Log a goal with scorer, assist provider, and type.</p>
              </div>
              <button className="icon-button min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setActiveModal(null)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitGoal}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Scoring Team</span>
                  <select value={goalTeam} onChange={(e) => setGoalTeam(e.target.value)}>
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                <label className="field">
                  <span>Goal Scorer</span>
                  <select
                    value={goalScorerId}
                    onChange={(e) => setGoalScorerId(e.target.value)}
                    required
                  >
                    <option value="">Select player from squad</option>
                    {(goalTeam === homeEntry?.id ? homePlayers : awayPlayers).map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber} {p.name} ({p.position})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Assist Provided By (Optional)</span>
                  <select value={goalAssistId} onChange={(e) => setGoalAssistId(e.target.value)}>
                    <option value="">No assist / Solo goal</option>
                    {(goalTeam === homeEntry?.id ? homePlayers : awayPlayers)
                      .filter((p) => p.id !== goalScorerId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name} ({p.position})
                        </option>
                      ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Goal Type</span>
                    <select value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                      <option value="goal">Open Play Goal</option>
                      <option value="penalty_goal">Penalty Kick</option>
                      <option value="own_goal">Opponent Own Goal</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Match Minute</span>
                    <input
                      type="number"
                      min="1"
                      max="130"
                      value={goalMinute}
                      onChange={(e) => setGoalMinute(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy || !goalScorerId}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Submit Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {activeModal === "card" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Match Discipline</span>
                <h2>Issue Booking / Card</h2>
                <p>Record a yellow or red card against a player.</p>
              </div>
              <button className="icon-button min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setActiveModal(null)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitCard}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Team</span>
                  <select value={cardTeam} onChange={(e) => setCardTeam(e.target.value)}>
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                <label className="field">
                  <span>Player</span>
                  <select
                    value={cardPlayerId}
                    onChange={(e) => setCardPlayerId(e.target.value)}
                    required
                  >
                    <option value="">Select player</option>
                    {(cardTeam === homeEntry?.id ? homePlayers : awayPlayers).map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber} {p.name} ({p.position})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Card Type</span>
                    <select value={cardType} onChange={(e) => setCardType(e.target.value)}>
                      <option value="yellow_card">Yellow Card (🟨)</option>
                      <option value="red_card">Direct Red Card (🟥)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Minute</span>
                    <input
                      type="number"
                      min="1"
                      max="130"
                      value={cardMinute}
                      onChange={(e) => setCardMinute(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Offence Reason</span>
                  <select value={cardReason} onChange={(e) => setCardReason(e.target.value)}>
                    <option value="Tactical Foul">Tactical Foul / Stopping Counter</option>
                    <option value="Dangerous Tackle">Dangerous Tackle / Rough Play</option>
                    <option value="Dissent">Dissent / Arguing with Referee</option>
                    <option value="Time Wasting">Time Wasting</option>
                    <option value="Unsporting Behavior">Unsporting Behavior</option>
                    <option value="Handball">Deliberate Handball</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy || !cardPlayerId}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Issue Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Modal */}
      {activeModal === "sub" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Squad Changes</span>
                <h2>Log Player Substitution</h2>
                <p>Record a tactical or injury substitution.</p>
              </div>
              <button className="icon-button min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setActiveModal(null)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitSub}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Team</span>
                  <select value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                {activeSubState && (
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Substitutions Used:</span>
                      <span className="font-mono font-bold text-white">{activeSubState.usedSubs} / {activeSubState.maxSubs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">In-Play Windows Used:</span>
                      <span className="font-mono font-bold text-white">{activeSubState.usedWindows} / {activeSubState.maxWindows}</span>
                    </div>
                    {activeSubState.isSubExhausted && (
                      <div className="text-rose-400 font-semibold pt-1">All 5 substitutions used for this match.</div>
                    )}
                    {activeSubState.isWindowExhausted && !activeSubState.isSubExhausted && (
                      <div className="text-amber-400 font-semibold pt-1">All 3 in-play windows used (half-time substitutions only).</div>
                    )}
                  </div>
                )}

                <label className="field">
                  <span>Player Coming Off (Out)</span>
                  <select
                    value={subPlayerOutId}
                    onChange={(e) => setSubPlayerOutId(e.target.value)}
                    required
                  >
                    <option value="">Select player coming off</option>
                    {(subTeam === homeEntry?.id ? homePlayers : awayPlayers).map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber} {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Player Coming On (In)</span>
                  <select
                    value={subPlayerInId}
                    onChange={(e) => setSubPlayerInId(e.target.value)}
                    required
                  >
                    <option value="">Select substitute player</option>
                    {(subTeam === homeEntry?.id ? homePlayers : awayPlayers)
                      .filter((p) => p.id !== subPlayerOutId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field">
                  <span>Match Minute</span>
                  <input
                    type="number"
                    min="1"
                    max="130"
                    value={subMinute}
                    onChange={(e) => setSubMinute(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy || !subPlayerOutId || !subPlayerInId}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Record Sub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POTM Modal */}
      {activeModal === "potm" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Match Honors</span>
                <h2>Select Player of the Match</h2>
                <p>Award the top performer for this match.</p>
              </div>
              <button className="icon-button min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setActiveModal(null)} aria-label="Close dialog">
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSetPOTM}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Select Outstanding Player</span>
                  <select
                    value={potmPlayerId}
                    onChange={(e) => setPotmPlayerId(e.target.value)}
                    required
                  >
                    <option value="">Select player</option>
                    <optgroup label={homeEntry?.teamName}>
                      {homePlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name} ({p.position})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={awayEntry?.teamName}>
                      {awayPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name} ({p.position})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy || !potmPlayerId}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Star size={17} fill="currentColor" />} Award POTM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Celebration Animation Overlay */}
      {celebrationData && (
        <GoalCelebration
          scorerName={celebrationData.scorerName}
          scorerJersey={celebrationData.scorerJersey}
          assistName={celebrationData.assistName}
          teamName={celebrationData.teamName}
          goalType={celebrationData.goalType}
          minute={celebrationData.minute}
          homeTeam={celebrationData.homeTeam}
          awayTeam={celebrationData.awayTeam}
          homeScore={celebrationData.homeScore}
          awayScore={celebrationData.awayScore}
          onDismiss={() => setCelebrationData(null)}
        />
      )}
    </div>
  );
}
