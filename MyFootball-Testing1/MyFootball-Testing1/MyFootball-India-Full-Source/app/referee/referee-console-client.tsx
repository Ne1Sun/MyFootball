"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { Division, Entry, Fixture, MatchEvent, Player, SquadMember, Tournament } from "../components/types";
import { AppHeader } from "../components/layout/AppHeader";
import { AppFooter } from "../components/layout/AppFooter";

// --- TYPES ---

export type ShootoutKick = {
  round: number;
  isHome: boolean;
  scored: boolean;
  shooterName?: string;
};

type RefereeData = {
  fixtures: Fixture[];
  entries: Entry[];
  divisions: Division[];
  tournaments: Tournament[];
  players: Player[];
  squadMembers: SquadMember[];
  events: MatchEvent[];
  user: { email: string; displayName: string };
};

type MatchWAL = {
  fixtureId: string;
  timestamp: number;
  matchClockMinute: number;
  period: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homeScorePenalties: number;
  awayScorePenalties: number;
  shootoutKicks: ShootoutKick[];
  events: MatchEvent[];
  potmId?: string;
  refereeNotes?: string;
};

// --- HAPTIC FEEDBACK HELPER ---

const triggerHaptic = (pattern: number | number[] = 40) => {
  if (typeof window !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }
};

// --- WRITE-AHEAD LOG (WAL) HELPERS (SEC-06) ---

const getWalKey = (fixtureId: string) => `referee_wal_${fixtureId}`;

const loadWAL = (fixtureId: string): MatchWAL | null => {
  if (typeof window === "undefined" || !fixtureId) return null;
  try {
    const raw = localStorage.getItem(getWalKey(fixtureId));
    if (!raw) return null;
    return JSON.parse(raw) as MatchWAL;
  } catch {
    return null;
  }
};

const saveWAL = (walData: MatchWAL) => {
  if (typeof window === "undefined" || !walData.fixtureId) return;
  try {
    localStorage.setItem(getWalKey(walData.fixtureId), JSON.stringify(walData));
  } catch {
    // Ignore storage quota errors
  }
};

const clearWAL = (fixtureId: string) => {
  if (typeof window === "undefined" || !fixtureId) return;
  try {
    localStorage.removeItem(getWalKey(fixtureId));
  } catch {
    // Ignore
  }
};

// --- FIFA 5-KICK + SUDDEN DEATH STATE MACHINE (SEC-01) ---

export function calculateShootoutState(kicks: ShootoutKick[]) {
  const homeKicks = kicks.filter((k) => k.isHome);
  const awayKicks = kicks.filter((k) => !k.isHome);

  const homeScore = homeKicks.filter((k) => k.scored).length;
  const awayScore = awayKicks.filter((k) => k.scored).length;

  const homeKicksTaken = homeKicks.length;
  const awayKicksTaken = awayKicks.length;

  let isFinished = false;
  let winner: "home" | "away" | null = null;
  let isSuddenDeath = false;
  let eliminationReason = "";

  // Regular best-of-5 rounds evaluation
  if (homeKicksTaken <= 5 && awayKicksTaken <= 5) {
    const homeRemaining = 5 - homeKicksTaken;
    const awayRemaining = 5 - awayKicksTaken;

    // Mathematical elimination checks before round 5 completes
    if (homeScore > awayScore + awayRemaining) {
      isFinished = true;
      winner = "home";
      eliminationReason = `Mathematical elimination reached (${homeScore}-${awayScore} with ${awayRemaining} kick(s) remaining for opponent)`;
    } else if (awayScore > homeScore + homeRemaining) {
      isFinished = true;
      winner = "away";
      eliminationReason = `Mathematical elimination reached (${awayScore}-${homeScore} with ${homeRemaining} kick(s) remaining for opponent)`;
    } else if (homeKicksTaken === 5 && awayKicksTaken === 5) {
      if (homeScore > awayScore) {
        isFinished = true;
        winner = "home";
        eliminationReason = `Regular 5-kick shootout won (${homeScore}-${awayScore})`;
      } else if (awayScore > homeScore) {
        isFinished = true;
        winner = "away";
        eliminationReason = `Regular 5-kick shootout won (${awayScore}-${homeScore})`;
      } else {
        // Tied after 5 kicks -> Sudden Death!
        isSuddenDeath = true;
      }
    }
  } else {
    // We are in Sudden Death (rounds 6+)
    isSuddenDeath = true;
    // In sudden death, each round has 1 kick per team.
    // Winner is decided ONLY when both teams have taken equal kicks in the round (e.g. 6 & 6, 7 & 7) and scores differ.
    if (homeKicksTaken === awayKicksTaken && homeKicksTaken >= 6) {
      if (homeScore > awayScore) {
        isFinished = true;
        winner = "home";
        eliminationReason = `Sudden Death victory in Round ${homeKicksTaken} (${homeScore}-${awayScore})`;
      } else if (awayScore > homeScore) {
        isFinished = true;
        winner = "away";
        eliminationReason = `Sudden Death victory in Round ${awayKicksTaken} (${awayScore}-${homeScore})`;
      }
    }
  }

  // Determine next kicker turn
  let nextIsHome = true;
  let currentRound = 1;

  if (homeKicksTaken === awayKicksTaken) {
    nextIsHome = true;
    currentRound = homeKicksTaken + 1;
  } else if (homeKicksTaken > awayKicksTaken) {
    nextIsHome = false;
    currentRound = homeKicksTaken;
  } else {
    nextIsHome = true;
    currentRound = awayKicksTaken + 1;
  }

  // Display grid size: minimum 5 rounds, or expands as sudden death rounds proceed
  const totalRoundsToDisplay = Math.max(5, Math.max(homeKicksTaken, awayKicksTaken) + (isFinished ? 0 : 1));

  return {
    homeKicks,
    awayKicks,
    homeScore,
    awayScore,
    homeKicksTaken,
    awayKicksTaken,
    isSuddenDeath,
    isFinished,
    winner,
    eliminationReason,
    nextIsHome,
    currentRound,
    totalRoundsToDisplay,
  };
}

// --- MAIN COMPONENT ---

export function RefereeConsoleClient({ initialData }: { initialData: RefereeData }) {
  const [data, setData] = useState<RefereeData>(initialData);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>(
    data.fixtures.find((f) => f.status === "in_progress")?.id || data.fixtures[0]?.id || ""
  );

  // Daylight Mode Toggle (SEC-07)
  const [daylightMode, setDaylightMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("referee_daylight_mode") === "true";
    }
    return false;
  });

  const toggleDaylightMode = () => {
    const next = !daylightMode;
    setDaylightMode(next);
    triggerHaptic(25);
    if (typeof window !== "undefined") {
      localStorage.setItem("referee_daylight_mode", String(next));
    }
  };

  const [activeModal, setActiveModal] = useState<"goal" | "card" | "sub" | "shootout" | "report" | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [walRestoredNotice, setWalRestoredNotice] = useState<string>("");

  const currentFixture = data.fixtures.find((f) => f.id === selectedFixtureId) || data.fixtures[0];
  const homeEntry = data.entries.find((e) => e.id === currentFixture?.homeEntryId);
  const awayEntry = data.entries.find((e) => e.id === currentFixture?.awayEntryId);
  const division = data.divisions.find((d) => d.id === currentFixture?.divisionId);
  const tournament = data.tournaments.find((t) => t.id === division?.tournamentId);

  // Lineup Players
  const homeSquad = data.squadMembers.filter((sm) => sm.entryId === homeEntry?.id);
  const awaySquad = data.squadMembers.filter((sm) => sm.entryId === awayEntry?.id);

  const homePlayers = data.players.filter((p) => homeSquad.some((sm) => sm.playerId === p.id));
  const awayPlayers = data.players.filter((p) => awaySquad.some((sm) => sm.playerId === p.id));

  // Events for current match
  const matchEvents = useMemo(() => {
    if (!currentFixture) return [];
    return data.events
      .filter((e) => e.fixtureId === currentFixture.id)
      .sort((a, b) => b.matchMinute - a.matchMinute);
  }, [data.events, currentFixture]);

  // Goal modal state
  const [goalTeam, setGoalTeam] = useState<string>(homeEntry?.id || "");
  const [goalScorerId, setGoalScorerId] = useState<string>("");
  const [goalAssistId, setGoalAssistId] = useState<string>("");
  const [goalType, setGoalType] = useState<string>("goal");
  const [goalMinute, setGoalMinute] = useState<number>(currentFixture?.matchClockMinute || 1);

  // Card modal state
  const [cardTeam, setCardTeam] = useState<string>(homeEntry?.id || "");
  const [cardPlayerId, setCardPlayerId] = useState<string>("");
  const [cardType, setCardType] = useState<string>("yellow_card");
  const [cardReason, setCardReason] = useState<string>("Tactical Foul");
  const [cardMinute, setCardMinute] = useState<number>(currentFixture?.matchClockMinute || 1);

  // Sub modal state
  const [subTeam, setSubTeam] = useState<string>(homeEntry?.id || "");
  const [subOutId, setSubOutId] = useState<string>("");
  const [subInId, setSubInId] = useState<string>("");
  const [subMinute, setSubMinute] = useState<number>(currentFixture?.matchClockMinute || 45);

  // Shootout kicks state (SEC-01)
  const [shootoutKicks, setShootoutKicks] = useState<ShootoutKick[]>([]);
  const [shootoutShooterName, setShootoutShooterName] = useState<string>("");

  // Match Report State
  const [potmId, setPotmId] = useState<string>("");
  const [refereeNotes, setRefereeNotes] = useState<string>("");

  // Calculated Shootout State
  const shootoutState = useMemo(() => calculateShootoutState(shootoutKicks), [shootoutKicks]);

  // Update default teams when homeEntry changes
  useEffect(() => {
    if (homeEntry) {
      setGoalTeam(homeEntry.id);
      setCardTeam(homeEntry.id);
      setSubTeam(homeEntry.id);
    }
  }, [homeEntry]);

  // --- WRITE-AHEAD LOG (WAL) RESTORATION (SEC-06) ---
  useEffect(() => {
    if (!currentFixture) return;
    const wal = loadWAL(currentFixture.id);
    if (wal && wal.fixtureId === currentFixture.id) {
      // Check if WAL has newer information than initial server state
      const hasNewerClock = wal.matchClockMinute > (currentFixture.matchClockMinute || 0);
      const hasNewerScore = wal.homeScore !== currentFixture.homeScore || wal.awayScore !== currentFixture.awayScore;
      const hasShootoutKicks = wal.shootoutKicks && wal.shootoutKicks.length > 0;
      const hasExtraEvents = wal.events && wal.events.length > matchEvents.length;

      if (hasNewerClock || hasNewerScore || hasShootoutKicks || hasExtraEvents) {
        // Restore local state from WAL
        if (hasShootoutKicks) {
          setShootoutKicks(wal.shootoutKicks);
        }
        if (wal.potmId) setPotmId(wal.potmId);
        if (wal.refereeNotes) setRefereeNotes(wal.refereeNotes);

        setData((prev) => {
          const updatedFixtures = prev.fixtures.map((f) => {
            if (f.id === currentFixture.id) {
              return {
                ...f,
                matchClockMinute: Math.max(f.matchClockMinute || 0, wal.matchClockMinute),
                period: wal.period || f.period,
                status: wal.status || f.status,
                homeScore: wal.homeScore,
                awayScore: wal.awayScore,
                homeScorePenalties: wal.homeScorePenalties,
                awayScorePenalties: wal.awayScorePenalties,
              };
            }
            return f;
          });

          // Merge events if WAL has events not in server data
          const existingIds = new Set(prev.events.map((e) => e.id));
          const mergedEvents = [...prev.events];
          (wal.events || []).forEach((we) => {
            if (!existingIds.has(we.id)) {
              mergedEvents.push(we);
            }
          });

          return {
            ...prev,
            fixtures: updatedFixtures,
            events: mergedEvents,
          };
        });

        setWalRestoredNotice(`⚡ WAL Restored: Match Minute ${wal.matchClockMinute}', Period: ${wal.period.toUpperCase()}`);
        setTimeout(() => setWalRestoredNotice(""), 6000);
      }
    }
  }, [currentFixture?.id]);

  // Synchronize WAL on current fixture state changes
  const persistCurrentWAL = useCallback(
    (overrides?: Partial<MatchWAL>) => {
      if (!currentFixture) return;
      const walPayload: MatchWAL = {
        fixtureId: currentFixture.id,
        timestamp: Date.now(),
        matchClockMinute: overrides?.matchClockMinute ?? currentFixture.matchClockMinute ?? 0,
        period: overrides?.period ?? currentFixture.period ?? "first_half",
        status: overrides?.status ?? currentFixture.status ?? "in_progress",
        homeScore: overrides?.homeScore ?? currentFixture.homeScore ?? 0,
        awayScore: overrides?.awayScore ?? currentFixture.awayScore ?? 0,
        homeScorePenalties: overrides?.homeScorePenalties ?? shootoutState.homeScore ?? currentFixture.homeScorePenalties ?? 0,
        awayScorePenalties: overrides?.awayScorePenalties ?? shootoutState.awayScore ?? currentFixture.awayScorePenalties ?? 0,
        shootoutKicks: overrides?.shootoutKicks ?? shootoutKicks,
        events: overrides?.events ?? matchEvents,
        potmId: overrides?.potmId ?? potmId,
        refereeNotes: overrides?.refereeNotes ?? refereeNotes,
      };
      saveWAL(walPayload);
    },
    [currentFixture, shootoutState, shootoutKicks, matchEvents, potmId, refereeNotes]
  );

  const refreshData = async () => {
    try {
      const res = await fetch("/api/app");
      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({
          ...prev,
          fixtures: json.fixtures || [],
          events: json.events || [],
          players: json.players || [],
          squadMembers: json.squadMembers || [],
        }));
      }
    } catch {
      // Ignore network errors - WAL maintains offline state
    }
  };

  const handleUpdateClock = async (minute: number, period: string, status?: string) => {
    if (!currentFixture) return;
    triggerHaptic(40);
    setBusy(true);

    const newMinute = Math.max(0, minute);
    const newPeriod = period;
    const newStatus = status || currentFixture.status;

    // Write-Ahead to WAL immediately (SEC-06)
    persistCurrentWAL({
      matchClockMinute: newMinute,
      period: newPeriod,
      status: newStatus,
    });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateLiveMatch",
          fixtureId: currentFixture.id,
          matchClockMinute: newMinute,
          period: newPeriod,
          status: newStatus,
        }),
      });
    } catch {
      // WAL has recorded this update
    }

    await refreshData();
    setBusy(false);
  };

  const handleScoreAdjust = async (isHome: boolean, delta: number) => {
    if (!currentFixture) return;
    triggerHaptic([40]);
    setBusy(true);

    const newHome = isHome ? Math.max(0, currentFixture.homeScore + delta) : currentFixture.homeScore;
    const newAway = !isHome ? Math.max(0, currentFixture.awayScore + delta) : currentFixture.awayScore;

    // Write-Ahead to WAL immediately (SEC-06)
    persistCurrentWAL({
      homeScore: newHome,
      awayScore: newAway,
    });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateLiveMatch",
          fixtureId: currentFixture.id,
          homeScore: newHome,
          awayScore: newAway,
        }),
      });
    } catch {
      // WAL has recorded score
    }

    await refreshData();
    setBusy(false);
  };

  // --- FIFA 5-KICK + SUDDEN DEATH STATE MACHINE HANDLER (SEC-01) ---
  const handleShootoutKick = async (isHome: boolean, scored: boolean, shooterName?: string) => {
    if (!currentFixture) return;
    triggerHaptic([40]);
    setBusy(true);

    const kickRound = shootoutState.currentRound;
    const newKick: ShootoutKick = {
      round: kickRound,
      isHome,
      scored,
      shooterName: shooterName || shootoutShooterName || undefined,
    };

    const nextKicks = [...shootoutKicks, newKick];
    setShootoutKicks(nextKicks);
    setShootoutShooterName("");

    const nextShootoutState = calculateShootoutState(nextKicks);

    // Save to WAL immediately (SEC-06)
    persistCurrentWAL({
      period: "penalties",
      status: "in_progress",
      homeScorePenalties: nextShootoutState.homeScore,
      awayScorePenalties: nextShootoutState.awayScore,
      shootoutKicks: nextKicks,
    });

    // Update live match period and penalty scores
    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateLiveMatch",
          fixtureId: currentFixture.id,
          period: "penalties",
          status: "in_progress",
        }),
      });
    } catch {
      // Offline safe via WAL
    }

    // SEC-01 FIX: ONLY call advanceBracketWinner when mathematical elimination is reached or sudden death is won!
    if (nextShootoutState.isFinished && nextShootoutState.winner) {
      triggerHaptic([40, 100, 40]);
      const winningTeamName = nextShootoutState.winner === "home" ? homeEntry?.teamName : awayEntry?.teamName;
      const winningEntryId = nextShootoutState.winner === "home" ? homeEntry?.id : awayEntry?.id;
      const losingEntryId = nextShootoutState.winner === "home" ? awayEntry?.id : homeEntry?.id;

      try {
        await fetch("/api/app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "advanceBracketWinner",
            fixtureId: currentFixture.id,
            winningEntryId,
            losingEntryId,
            homeScorePenalties: nextShootoutState.homeScore,
            awayScorePenalties: nextShootoutState.awayScore,
          }),
        });
      } catch {
        // Offline safe
      }

      setToast(`🎯 Shootout Finished! ${winningTeamName} wins (${nextShootoutState.homeScore}-${nextShootoutState.awayScore})!`);
      setTimeout(() => setToast(""), 6000);
    }

    await refreshData();
    setBusy(false);
  };

  const handleUndoLastShootoutKick = async () => {
    if (shootoutKicks.length === 0 || !currentFixture) return;
    triggerHaptic(30);
    const nextKicks = shootoutKicks.slice(0, -1);
    setShootoutKicks(nextKicks);

    const nextState = calculateShootoutState(nextKicks);
    persistCurrentWAL({
      shootoutKicks: nextKicks,
      homeScorePenalties: nextState.homeScore,
      awayScorePenalties: nextState.awayScore,
    });
  };

  const handleResetShootout = () => {
    if (!confirm("Reset all shootout kicks for this match?")) return;
    triggerHaptic(50);
    setShootoutKicks([]);
    persistCurrentWAL({
      shootoutKicks: [],
      homeScorePenalties: 0,
      awayScorePenalties: 0,
    });
  };

  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    triggerHaptic([40]);
    setBusy(true);

    const isHome = goalTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const scorer = teamPlayers.find((p) => p.id === goalScorerId);
    const assist = teamPlayers.find((p) => p.id === goalAssistId);

    const tempEventId = crypto.randomUUID();
    const optimisticEvent: MatchEvent = {
      id: tempEventId,
      fixtureId: currentFixture.id,
      entryId: goalTeam,
      type: goalType,
      playerName: scorer?.name || "Player",
      playerId: scorer?.id || null,
      assistPlayerName: assist?.name || "",
      assistPlayerId: assist?.id || null,
      matchMinute: goalMinute,
      matchPeriod: currentFixture.period || "first_half",
      recordedBy: data.user?.email || "referee",
      createdAt: new Date().toISOString(),
    };

    // WAL Write-Ahead
    persistCurrentWAL({
      events: [optimisticEvent, ...matchEvents],
      homeScore: isHome && goalType !== "own_goal" ? currentFixture.homeScore + 1 : currentFixture.homeScore,
      awayScore: !isHome && goalType !== "own_goal" ? currentFixture.awayScore + 1 : currentFixture.awayScore,
    });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
    } catch {
      // WAL persisted
    }

    setToast("Goal recorded!");
    setTimeout(() => setToast(""), 3000);
    setActiveModal(null);
    await refreshData();
    setBusy(false);
  };

  const handleSubmitCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    triggerHaptic([40]);
    setBusy(true);

    const isHome = cardTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const player = teamPlayers.find((p) => p.id === cardPlayerId);

    const tempEventId = crypto.randomUUID();
    const optimisticEvent: MatchEvent = {
      id: tempEventId,
      fixtureId: currentFixture.id,
      entryId: cardTeam,
      type: cardType,
      playerName: player?.name || "Player",
      playerId: player?.id || null,
      cardReason,
      matchMinute: cardMinute,
      matchPeriod: currentFixture.period || "first_half",
      recordedBy: data.user?.email || "referee",
      createdAt: new Date().toISOString(),
    };

    // WAL Write-Ahead
    persistCurrentWAL({
      events: [optimisticEvent, ...matchEvents],
    });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recordDetailedMatchEvent",
          fixtureId: currentFixture.id,
          entryId: cardTeam,
          type: cardType,
          playerName: player?.name || "Player",
          playerId: player?.id || null,
          cardReason,
          matchMinute: cardMinute,
          matchPeriod: currentFixture.period || "first_half",
        }),
      });
    } catch {
      // WAL persisted
    }

    setToast("Card sanction issued!");
    setTimeout(() => setToast(""), 3000);
    setActiveModal(null);
    await refreshData();
    setBusy(false);
  };

  const handleSubmitSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    triggerHaptic([40]);
    setBusy(true);

    const isHome = subTeam === homeEntry?.id;
    const teamPlayers = isHome ? homePlayers : awayPlayers;
    const playerOut = teamPlayers.find((p) => p.id === subOutId);
    const playerIn = teamPlayers.find((p) => p.id === subInId);

    const tempEventId = crypto.randomUUID();
    const optimisticEvent: MatchEvent = {
      id: tempEventId,
      fixtureId: currentFixture.id,
      entryId: subTeam,
      type: "substitution",
      playerName: playerOut?.name || "Player Out",
      playerId: playerOut?.id || null,
      relatedPlayerName: playerIn?.name || "Player In",
      assistPlayerId: playerIn?.id || null,
      matchMinute: subMinute,
      matchPeriod: currentFixture.period || "second_half",
      recordedBy: data.user?.email || "referee",
      createdAt: new Date().toISOString(),
    };

    // WAL Write-Ahead
    persistCurrentWAL({
      events: [optimisticEvent, ...matchEvents],
    });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
    } catch {
      // WAL persisted
    }

    setToast("Substitution recorded!");
    setTimeout(() => setToast(""), 3000);
    setActiveModal(null);
    await refreshData();
    setBusy(false);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Undo this event?")) return;
    triggerHaptic(30);
    setBusy(true);

    const updatedEvents = matchEvents.filter((e) => e.id !== eventId);
    persistCurrentWAL({ events: updatedEvents });

    try {
      await fetch("/api/app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteMatchEvent", eventId }),
      });
    } catch {
      // WAL persisted
    }

    await refreshData();
    setBusy(false);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFixture) return;
    triggerHaptic([40, 60, 40]);
    setBusy(true);
    const allPlayers = [...homePlayers, ...awayPlayers];
    const potm = allPlayers.find((p) => p.id === potmId);

    if (potm) {
      try {
        await fetch("/api/app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setPOTM",
            fixtureId: currentFixture.id,
            potmPlayerId: potm.id,
            potmPlayerName: potm.name,
          }),
        });
      } catch {
        // WAL fallback
      }
    }

    await handleUpdateClock(90, "completed", "completed");
    clearWAL(currentFixture.id); // Clean up WAL when match is officially completed
    setToast("Official match report submitted & whistle blown!");
    setTimeout(() => setToast(""), 3000);
    setActiveModal(null);
    await refreshData();
    setBusy(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        daylightMode
          ? "bg-white text-black selection:bg-amber-400 selection:text-black"
          : "bg-background text-foreground selection:bg-amber-500 selection:text-slate-950"
      }`}
    >
      {/* Unified App Header */}
      <AppHeader activeRoute="referee" user={data.user} />

      {/* Main Pitch View */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
        {/* WAL Restoration Notice (SEC-06) */}
        {walRestoredNotice && (
          <div
            className={`p-3 rounded-2xl text-xs font-black text-center flex items-center justify-center gap-2 shadow-md animate-in fade-in ${
              daylightMode ? "bg-amber-300 text-black border-2 border-black" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}
          >
            <Zap size={15} className="animate-bounce" />
            <span>{walRestoredNotice}</span>
          </div>
        )}

        {/* Live Action Toast */}
        {toast && (
          <div
            className={`p-3 rounded-2xl text-xs font-black text-center shadow-lg animate-in fade-in flex items-center justify-center gap-2 ${
              daylightMode ? "bg-emerald-600 text-white border-2 border-black" : "bg-emerald-600 text-white"
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{toast}</span>
          </div>
        )}

        {/* Top Controls Toolbar: Match Selector & Daylight Mode Toggle (SEC-07) */}
        <div
          className={`p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md transition-colors ${
            daylightMode ? "bg-white border-4 border-black text-black" : "bg-slate-900 border border-slate-800 text-white"
          }`}
        >
          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <span className={`text-[11px] uppercase font-black tracking-wider ${daylightMode ? "text-black" : "text-slate-400"}`}>
              Fixture:
            </span>
            <select
              value={selectedFixtureId}
              onChange={(e) => setSelectedFixtureId(e.target.value)}
              className={`flex-1 text-xs font-bold p-2 rounded-xl border focus:outline-none cursor-pointer truncate ${
                daylightMode
                  ? "bg-white text-black border-2 border-black font-black"
                  : "bg-slate-800 text-white border-slate-700"
              }`}
            >
              {data.fixtures.map((f) => {
                const h = data.entries.find((e) => e.id === f.homeEntryId);
                const a = data.entries.find((e) => e.id === f.awayEntryId);
                return (
                  <option key={f.id} value={f.id}>
                    Pitch {f.pitch}: {h?.teamName || "TBD"} vs {a?.teamName || "TBD"} [{f.period.toUpperCase()}]
                  </option>
                );
              })}
            </select>
          </div>

          {/* Daylight Mode Toggle (SEC-07) */}
          <button
            onClick={toggleDaylightMode}
            type="button"
            className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition shadow-sm ${
              daylightMode
                ? "bg-black text-white hover:bg-neutral-800 border-2 border-black"
                : "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
            }`}
            title="Toggle Daylight High-Contrast Mode for direct sunlight pitch conditions"
          >
            {daylightMode ? <Moon size={15} /> : <Sun size={15} />}
            <span>{daylightMode ? "Daylight Mode (Active)" : "Daylight Mode"}</span>
          </button>
        </div>

        {/* Pitch Digital Clock & Timer HUD */}
        <div
          className={`p-5 rounded-3xl text-center space-y-4 shadow-xl transition-colors ${
            daylightMode ? "bg-white border-4 border-black text-black" : "bg-slate-900 border border-slate-800 text-white"
          }`}
        >
          <div
            className={`flex items-center justify-between text-xs font-black uppercase tracking-wider ${
              daylightMode ? "text-black" : "text-slate-400"
            }`}
          >
            <span>{currentFixture?.roundName || "Matchday"}</span>
            <span
              className={`px-3 py-1 rounded-full font-mono font-black ${
                daylightMode ? "bg-black text-white" : "bg-primary/20 text-primary"
              }`}
            >
              PITCH {currentFixture?.pitch}
            </span>
          </div>

          {/* Huge Match Minute */}
          <div className="flex items-center justify-center gap-4 py-2">
            <div
              className={`text-6xl sm:text-7xl font-black font-mono tracking-tighter ${
                daylightMode ? "text-black" : "text-white"
              }`}
            >
              {currentFixture?.matchClockMinute}&apos;
            </div>
            <div className="text-left space-y-1">
              <span
                className={`text-xs uppercase font-black px-2.5 py-1 rounded-full block border ${
                  daylightMode
                    ? "bg-amber-400 text-black border-black"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
              >
                {currentFixture?.period.replace("_", " ").toUpperCase()}
              </span>
              <span className={`text-[11px] font-mono font-bold block ${daylightMode ? "text-neutral-700" : "text-slate-400"}`}>
                STATUS: {currentFixture?.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Timer Action Buttons */}
          <div
            className={`grid grid-cols-4 gap-2 pt-3 border-t ${
              daylightMode ? "border-black" : "border-slate-800"
            }`}
          >
            <button
              onClick={() => handleUpdateClock((currentFixture?.matchClockMinute || 0) + 1, currentFixture?.period || "first_half")}
              disabled={busy}
              className={`p-3 rounded-2xl font-mono font-black text-sm transition shadow-sm ${
                daylightMode
                  ? "bg-white text-black hover:bg-neutral-100 border-2 border-black"
                  : "bg-slate-800 hover:bg-slate-700 text-white"
              }`}
            >
              +1&apos; Min
            </button>
            <button
              onClick={() => handleUpdateClock(45, "half_time", "in_progress")}
              disabled={busy}
              className={`p-3 rounded-2xl font-black text-xs transition shadow-sm ${
                daylightMode
                  ? "bg-amber-400 text-black hover:bg-amber-500 border-2 border-black"
                  : "bg-amber-600/80 hover:bg-amber-600 text-white"
              }`}
            >
              Half-Time
            </button>
            <button
              onClick={() => handleUpdateClock(45, "second_half", "in_progress")}
              disabled={busy}
              className={`p-3 rounded-2xl font-black text-xs transition shadow-sm ${
                daylightMode
                  ? "bg-emerald-500 text-black hover:bg-emerald-400 border-2 border-black"
                  : "bg-emerald-600/80 hover:bg-emerald-600 text-white"
              }`}
            >
              2nd Half
            </button>
            <button
              onClick={() => {
                triggerHaptic(40);
                setActiveModal("report");
              }}
              disabled={busy}
              className={`p-3 rounded-2xl font-black text-xs transition shadow-sm ${
                daylightMode
                  ? "bg-rose-600 text-white hover:bg-rose-700 border-2 border-black"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              Full-Time
            </button>
          </div>
        </div>

        {/* Large Live Scoreboard (SEC-07: 72pt score numbers in Daylight Mode) */}
        <div
          className={`p-6 rounded-3xl grid grid-cols-3 items-center text-center gap-3 shadow-xl transition-colors ${
            daylightMode ? "bg-white border-4 border-black text-black" : "bg-slate-900 border border-slate-800 text-white"
          }`}
        >
          {/* Home Team */}
          <div className="space-y-2">
            <strong
              className={`block text-sm sm:text-base font-black truncate ${
                daylightMode ? "text-black" : "text-white"
              }`}
            >
              {homeEntry?.teamName || "Home"}
            </strong>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => handleScoreAdjust(true, 1)}
                className={`w-11 h-11 rounded-xl font-black text-xl transition shadow-md ${
                  daylightMode
                    ? "bg-emerald-500 text-black border-2 border-black hover:bg-emerald-400"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
                title="Add Home Goal"
              >
                +
              </button>
              <button
                onClick={() => handleScoreAdjust(true, -1)}
                className={`w-11 h-11 rounded-xl font-black text-xl transition shadow-md ${
                  daylightMode
                    ? "bg-white text-black border-2 border-black hover:bg-neutral-100"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                title="Subtract Home Goal"
              >
                -
              </button>
            </div>
          </div>

          {/* Scores (SEC-07: 72pt high-contrast score font) */}
          <div
            className={`font-mono font-black tracking-tight ${
              daylightMode
                ? "text-[72pt] leading-none text-black drop-shadow-sm"
                : "text-5xl sm:text-6xl text-white"
            }`}
          >
            <span>{currentFixture?.homeScore ?? 0}</span>
            <span className={daylightMode ? "text-neutral-500 mx-1" : "text-slate-600 mx-1"}>:</span>
            <span>{currentFixture?.awayScore ?? 0}</span>
          </div>

          {/* Away Team */}
          <div className="space-y-2">
            <strong
              className={`block text-sm sm:text-base font-black truncate ${
                daylightMode ? "text-black" : "text-white"
              }`}
            >
              {awayEntry?.teamName || "Away"}
            </strong>
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => handleScoreAdjust(false, 1)}
                className={`w-11 h-11 rounded-xl font-black text-xl transition shadow-md ${
                  daylightMode
                    ? "bg-emerald-500 text-black border-2 border-black hover:bg-emerald-400"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
                title="Add Away Goal"
              >
                +
              </button>
              <button
                onClick={() => handleScoreAdjust(false, -1)}
                className={`w-11 h-11 rounded-xl font-black text-xl transition shadow-md ${
                  daylightMode
                    ? "bg-white text-black border-2 border-black hover:bg-neutral-100"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
                title="Subtract Away Goal"
              >
                -
              </button>
            </div>
          </div>
        </div>

        {/* Rapid Match Action Drawers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => {
              triggerHaptic(40);
              setGoalMinute(currentFixture?.matchClockMinute || 1);
              setActiveModal("goal");
            }}
            className={`p-4 rounded-2xl font-black text-sm flex flex-col items-center gap-1 shadow-lg transition ${
              daylightMode
                ? "bg-emerald-500 text-black border-2 border-black hover:bg-emerald-400"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            <span className="text-xl">⚽</span> Log Goal
          </button>
          <button
            onClick={() => {
              triggerHaptic(40);
              setCardMinute(currentFixture?.matchClockMinute || 1);
              setActiveModal("card");
            }}
            className={`p-4 rounded-2xl font-black text-sm flex flex-col items-center gap-1 shadow-lg transition ${
              daylightMode
                ? "bg-amber-400 text-black border-2 border-black hover:bg-amber-300"
                : "bg-amber-600 hover:bg-amber-500 text-white"
            }`}
          >
            <span className="text-xl">🟨</span> Issue Card
          </button>
          <button
            onClick={() => {
              triggerHaptic(40);
              setSubMinute(currentFixture?.matchClockMinute || 45);
              setActiveModal("sub");
            }}
            className={`p-4 rounded-2xl font-black text-sm flex flex-col items-center gap-1 shadow-lg transition ${
              daylightMode
                ? "bg-blue-400 text-black border-2 border-black hover:bg-blue-300"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            }`}
          >
            <span className="text-xl">🔄</span> Substitution
          </button>
          <button
            onClick={() => {
              triggerHaptic(40);
              setActiveModal("shootout");
            }}
            className={`p-4 rounded-2xl font-black text-sm flex flex-col items-center gap-1 shadow-lg transition ${
              daylightMode
                ? "bg-purple-400 text-black border-2 border-black hover:bg-purple-300"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            <span className="text-xl">🎯</span> Shootout
          </button>
        </div>

        {/* Live Event Stream & WAL Status HUD */}
        <div
          className={`p-5 rounded-3xl space-y-3 shadow-xl transition-colors ${
            daylightMode ? "bg-white border-4 border-black text-black" : "bg-slate-900 border border-slate-800 text-white"
          }`}
        >
          <div
            className={`flex items-center justify-between text-xs font-black uppercase pb-2 border-b ${
              daylightMode ? "border-black text-black" : "border-slate-800 text-slate-400"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>Match Event Log ({matchEvents.length})</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                  daylightMode ? "bg-black text-white" : "bg-emerald-500/20 text-emerald-400"
                }`}
                title="Write-Ahead Log protects match state against accidental refreshes"
              >
                💾 WAL Active
              </span>
            </div>
            <span>Referee Stream</span>
          </div>

          {matchEvents.length === 0 ? (
            <p
              className={`text-xs italic text-center py-6 ${
                daylightMode ? "text-neutral-500" : "text-slate-500"
              }`}
            >
              No events logged for this fixture yet.
            </p>
          ) : (
            <div className="space-y-2">
              {matchEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between p-3 rounded-xl text-xs transition ${
                    daylightMode
                      ? "bg-neutral-50 border-2 border-black text-black font-bold"
                      : "bg-slate-800 border border-slate-700 text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-mono font-black px-2 py-0.5 rounded ${
                        daylightMode ? "bg-black text-white" : "bg-slate-900 text-primary"
                      }`}
                    >
                      {ev.matchMinute}&apos;
                    </span>
                    <span className="font-extrabold">{ev.playerName}</span>
                    <span
                      className={`uppercase text-[10px] font-black ${
                        daylightMode ? "text-neutral-700" : "text-slate-400"
                      }`}
                    >
                      ({ev.type.replace("_", " ")})
                    </span>
                    {ev.relatedPlayerName && (
                      <span className={daylightMode ? "text-neutral-800 font-bold" : "text-blue-400"}>
                        ⇄ In: {ev.relatedPlayerName}
                      </span>
                    )}
                    {ev.assistPlayerName && (
                      <span className={daylightMode ? "text-neutral-700" : "text-slate-400"}>
                        • Assist: {ev.assistPlayerName}
                      </span>
                    )}
                    {ev.cardReason && (
                      <span className={daylightMode ? "text-amber-700 font-black" : "text-amber-400"}>
                        • {ev.cardReason}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className={`p-1.5 rounded-lg transition ${
                      daylightMode ? "hover:bg-rose-100 text-rose-700" : "hover:text-rose-400 text-slate-500"
                    }`}
                    title="Undo this event"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Goal Modal */}
      {activeModal === "goal" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div
            className={`modal max-w-md ${
              daylightMode ? "bg-white text-black border-4 border-black" : "bg-slate-900 text-white border border-slate-800"
            }`}
          >
            <div className="modal-top">
              <div>
                <span className={`eyebrow ${daylightMode ? "text-neutral-700 font-black" : ""}`}>Referee Match Logger</span>
                <h2 className={daylightMode ? "text-black font-black" : "text-white"}>Record Goal</h2>
              </div>
              <button
                className={`icon-button ${daylightMode ? "text-black hover:bg-neutral-100" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitGoal}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Scoring Team</span>
                  <select
                    value={goalTeam}
                    onChange={(e) => setGoalTeam(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Goal Scorer</span>
                  <select
                    value={goalScorerId}
                    onChange={(e) => setGoalScorerId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
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
                  <span className={daylightMode ? "text-black font-black" : ""}>Assist (Optional)</span>
                  <select
                    value={goalAssistId}
                    onChange={(e) => setGoalAssistId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value="">No assist / Solo goal</option>
                    {(goalTeam === homeEntry?.id ? homePlayers : awayPlayers)
                      .filter((p) => p.id !== goalScorerId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span className={daylightMode ? "text-black font-black" : ""}>Goal Type</span>
                    <select
                      value={goalType}
                      onChange={(e) => setGoalType(e.target.value)}
                      className={
                        daylightMode
                          ? "bg-white text-black border-2 border-black font-bold"
                          : "bg-slate-800 text-white border-slate-700"
                      }
                    >
                      <option value="goal">Open Play Goal</option>
                      <option value="penalty_goal">Penalty Kick</option>
                      <option value="own_goal">Own Goal</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className={daylightMode ? "text-black font-black" : ""}>Minute</span>
                    <input
                      type="number"
                      min="1"
                      max="130"
                      value={goalMinute}
                      onChange={(e) => setGoalMinute(Number(e.target.value))}
                      className={
                        daylightMode
                          ? "bg-white text-black border-2 border-black font-bold"
                          : "bg-slate-800 text-white border-slate-700"
                      }
                      required
                    />
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className={`button secondary ${daylightMode ? "border-2 border-black text-black font-black" : ""}`}
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  className={`button primary ${daylightMode ? "bg-emerald-500 text-black border-2 border-black font-black" : ""}`}
                  disabled={busy || !goalScorerId}
                >
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
          <div
            className={`modal max-w-md ${
              daylightMode ? "bg-white text-black border-4 border-black" : "bg-slate-900 text-white border border-slate-800"
            }`}
          >
            <div className="modal-top">
              <div>
                <span className={`eyebrow ${daylightMode ? "text-neutral-700 font-black" : ""}`}>Disciplinary Sanction</span>
                <h2 className={daylightMode ? "text-black font-black" : "text-white"}>Issue Card / Booking</h2>
              </div>
              <button
                className={`icon-button ${daylightMode ? "text-black hover:bg-neutral-100" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitCard}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Team</span>
                  <select
                    value={cardTeam}
                    onChange={(e) => setCardTeam(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Player Booked</span>
                  <select
                    value={cardPlayerId}
                    onChange={(e) => setCardPlayerId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
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
                    <span className={daylightMode ? "text-black font-black" : ""}>Card Sanction</span>
                    <select
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value)}
                      className={
                        daylightMode
                          ? "bg-white text-black border-2 border-black font-bold"
                          : "bg-slate-800 text-white border-slate-700"
                      }
                    >
                      <option value="yellow_card">Yellow Card (🟨)</option>
                      <option value="red_card">Red Card (🟥)</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className={daylightMode ? "text-black font-black" : ""}>Minute</span>
                    <input
                      type="number"
                      min="1"
                      max="130"
                      value={cardMinute}
                      onChange={(e) => setCardMinute(Number(e.target.value))}
                      className={
                        daylightMode
                          ? "bg-white text-black border-2 border-black font-bold"
                          : "bg-slate-800 text-white border-slate-700"
                      }
                      required
                    />
                  </label>
                </div>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Offence Reason</span>
                  <select
                    value={cardReason}
                    onChange={(e) => setCardReason(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value="Tactical Foul">Tactical Foul / Stopping Counter</option>
                    <option value="Dangerous Tackle">Dangerous Tackle</option>
                    <option value="Dissent">Dissent with Referee</option>
                    <option value="Time Wasting">Time Wasting</option>
                    <option value="Handball">Deliberate Handball</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className={`button secondary ${daylightMode ? "border-2 border-black text-black font-black" : ""}`}
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  className={`button primary ${daylightMode ? "bg-amber-400 text-black border-2 border-black font-black" : ""}`}
                  disabled={busy || !cardPlayerId}
                >
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Submit Sanction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Substitution Modal */}
      {activeModal === "sub" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div
            className={`modal max-w-md ${
              daylightMode ? "bg-white text-black border-4 border-black" : "bg-slate-900 text-white border border-slate-800"
            }`}
          >
            <div className="modal-top">
              <div>
                <span className={`eyebrow ${daylightMode ? "text-neutral-700 font-black" : ""}`}>Squad Rotation</span>
                <h2 className={daylightMode ? "text-black font-black" : "text-white"}>Record Substitution</h2>
              </div>
              <button
                className={`icon-button ${daylightMode ? "text-black hover:bg-neutral-100" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitSub}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Team</span>
                  <select
                    value={subTeam}
                    onChange={(e) => setSubTeam(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value={homeEntry?.id}>{homeEntry?.teamName}</option>
                    <option value={awayEntry?.id}>{awayEntry?.teamName}</option>
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Player Coming OFF (🔻 Out)</span>
                  <select
                    value={subOutId}
                    onChange={(e) => setSubOutId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                    required
                  >
                    <option value="">Select player leaving pitch</option>
                    {(subTeam === homeEntry?.id ? homePlayers : awayPlayers).map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.jerseyNumber} {p.name} ({p.position})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Player Coming ON (🔺 In)</span>
                  <select
                    value={subInId}
                    onChange={(e) => setSubInId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                    required
                  >
                    <option value="">Select player entering pitch</option>
                    {(subTeam === homeEntry?.id ? homePlayers : awayPlayers)
                      .filter((p) => p.id !== subOutId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name} ({p.position})
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Minute of Sub</span>
                  <input
                    type="number"
                    min="1"
                    max="130"
                    value={subMinute}
                    onChange={(e) => setSubMinute(Number(e.target.value))}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                    required
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className={`button secondary ${daylightMode ? "border-2 border-black text-black font-black" : ""}`}
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  className={`button primary ${daylightMode ? "bg-blue-400 text-black border-2 border-black font-black" : ""}`}
                  disabled={busy || !subOutId || !subInId}
                >
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Submit Substitution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIFA 5-Kick + Sudden Death Penalty Shootout Modal (SEC-01) */}
      {activeModal === "shootout" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div
            className={`modal max-w-lg ${
              daylightMode ? "bg-white text-black border-4 border-black" : "bg-slate-900 text-white border border-slate-800"
            }`}
          >
            <div className="modal-top">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`eyebrow ${daylightMode ? "text-neutral-700 font-black" : ""}`}>
                    FIFA Penalty Shootout
                  </span>
                  {shootoutState.isSuddenDeath && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider border border-rose-500/30">
                      ⚡ Sudden Death
                    </span>
                  )}
                </div>
                <h2 className={daylightMode ? "text-black font-black" : "text-white"}>
                  {shootoutState.isFinished
                    ? "Shootout Complete!"
                    : shootoutState.isSuddenDeath
                    ? `Sudden Death — Round ${shootoutState.currentRound}`
                    : `5-Kick Regular — Round ${shootoutState.currentRound} of 5`}
                </h2>
              </div>
              <button
                className={`icon-button ${daylightMode ? "text-black hover:bg-neutral-100" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-body space-y-6">
              {/* Giant Shootout Score Board */}
              <div
                className={`p-4 rounded-2xl text-center space-y-1 ${
                  daylightMode ? "bg-neutral-100 border-2 border-black" : "bg-slate-800 border border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-black px-4">
                  <span className="truncate max-w-[150px]">{homeEntry?.teamName || "Home"}</span>
                  <span className="text-slate-400 uppercase text-[10px]">PENALTIES</span>
                  <span className="truncate max-w-[150px]">{awayEntry?.teamName || "Away"}</span>
                </div>
                <div
                  className={`font-mono font-black text-5xl tracking-tight ${
                    daylightMode ? "text-black" : "text-primary"
                  }`}
                >
                  <span>{shootoutState.homeScore}</span>
                  <span className="text-slate-400 mx-3">:</span>
                  <span>{shootoutState.awayScore}</span>
                </div>
                {shootoutState.eliminationReason && (
                  <p
                    className={`text-xs font-black mt-2 px-3 py-1 rounded-xl ${
                      daylightMode ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-emerald-950/60 text-emerald-300 border border-emerald-700/40"
                    }`}
                  >
                    🏆 {shootoutState.eliminationReason}
                  </p>
                )}
              </div>

              {/* Visual 5-Dot Grid (🟢 Score, 🔴 Miss, ⚪ Pending, 🟡 Active) */}
              <div className="space-y-4">
                {/* Home Team Kicks Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      {homeEntry?.teamName || "Home"}
                    </span>
                    <span className="font-mono text-slate-400 font-bold">
                      {shootoutState.homeScore} Scored ({shootoutState.homeKicksTaken} taken)
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {Array.from({ length: shootoutState.totalRoundsToDisplay }).map((_, idx) => {
                      const roundNum = idx + 1;
                      const kick = shootoutState.homeKicks.find((k) => k.round === roundNum);
                      const isNextKick =
                        !shootoutState.isFinished && shootoutState.nextIsHome && shootoutState.currentRound === roundNum;

                      let dotClass = daylightMode
                        ? "bg-neutral-200 border-2 border-neutral-300 text-neutral-400"
                        : "bg-slate-800 border border-slate-700 text-slate-600";
                      let dotIcon = "⚪";

                      if (kick) {
                        if (kick.scored) {
                          dotClass = "bg-emerald-500 text-white border-2 border-emerald-600 shadow-md shadow-emerald-500/20";
                          dotIcon = "🟢";
                        } else {
                          dotClass = "bg-rose-500 text-white border-2 border-rose-600 shadow-md shadow-rose-500/20";
                          dotIcon = "🔴";
                        }
                      } else if (isNextKick) {
                        dotClass = daylightMode
                          ? "bg-amber-300 text-black border-2 border-black ring-2 ring-amber-400 animate-pulse"
                          : "bg-amber-500/30 text-amber-300 border-2 border-amber-400 ring-2 ring-amber-400/40 animate-pulse";
                        dotIcon = "🟡";
                      }

                      return (
                        <div
                          key={`home-kick-${roundNum}`}
                          className={`h-11 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all ${dotClass}`}
                          title={`Round ${roundNum} ${kick ? (kick.scored ? "Scored" : "Missed") : isNextKick ? "Active Kicker" : "Pending"}`}
                        >
                          <span className="text-sm leading-none">{dotIcon}</span>
                          <span className="text-[9px] font-mono mt-0.5 opacity-80">R{roundNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Away Team Kicks Row */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      {awayEntry?.teamName || "Away"}
                    </span>
                    <span className="font-mono text-slate-400 font-bold">
                      {shootoutState.awayScore} Scored ({shootoutState.awayKicksTaken} taken)
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {Array.from({ length: shootoutState.totalRoundsToDisplay }).map((_, idx) => {
                      const roundNum = idx + 1;
                      const kick = shootoutState.awayKicks.find((k) => k.round === roundNum);
                      const isNextKick =
                        !shootoutState.isFinished && !shootoutState.nextIsHome && shootoutState.currentRound === roundNum;

                      let dotClass = daylightMode
                        ? "bg-neutral-200 border-2 border-neutral-300 text-neutral-400"
                        : "bg-slate-800 border border-slate-700 text-slate-600";
                      let dotIcon = "⚪";

                      if (kick) {
                        if (kick.scored) {
                          dotClass = "bg-emerald-500 text-white border-2 border-emerald-600 shadow-md shadow-emerald-500/20";
                          dotIcon = "🟢";
                        } else {
                          dotClass = "bg-rose-500 text-white border-2 border-rose-600 shadow-md shadow-rose-500/20";
                          dotIcon = "🔴";
                        }
                      } else if (isNextKick) {
                        dotClass = daylightMode
                          ? "bg-amber-300 text-black border-2 border-black ring-2 ring-amber-400 animate-pulse"
                          : "bg-amber-500/30 text-amber-300 border-2 border-amber-400 ring-2 ring-amber-400/40 animate-pulse";
                        dotIcon = "🟡";
                      }

                      return (
                        <div
                          key={`away-kick-${roundNum}`}
                          className={`h-11 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all ${dotClass}`}
                          title={`Round ${roundNum} ${kick ? (kick.scored ? "Scored" : "Missed") : isNextKick ? "Active Kicker" : "Pending"}`}
                        >
                          <span className="text-sm leading-none">{dotIcon}</span>
                          <span className="text-[9px] font-mono mt-0.5 opacity-80">R{roundNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Interactive Kick Entry Controls */}
              {!shootoutState.isFinished ? (
                <div
                  className={`p-4 rounded-2xl space-y-3 ${
                    daylightMode ? "bg-neutral-50 border-2 border-black" : "bg-slate-800/80 border border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-black tracking-wide flex items-center gap-1.5">
                      <span>Next Turn:</span>
                      <strong className={shootoutState.nextIsHome ? "text-blue-500" : "text-amber-500"}>
                        {shootoutState.nextIsHome ? homeEntry?.teamName : awayEntry?.teamName} (Round {shootoutState.currentRound})
                      </strong>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {shootoutState.isSuddenDeath ? "Sudden Death" : `Kick #${shootoutKicks.length + 1}`}
                    </span>
                  </div>

                  {/* Optional Shooter Name Selector */}
                  <div className="flex gap-2">
                    <select
                      value={shootoutShooterName}
                      onChange={(e) => setShootoutShooterName(e.target.value)}
                      className={`flex-1 text-xs font-bold p-2 rounded-xl border ${
                        daylightMode
                          ? "bg-white text-black border-2 border-black"
                          : "bg-slate-900 text-white border-slate-700"
                      }`}
                    >
                      <option value="">Select shooter (Optional)</option>
                      {(shootoutState.nextIsHome ? homePlayers : awayPlayers).map((p) => (
                        <option key={p.id} value={`#${p.jerseyNumber} ${p.name}`}>
                          #{p.jerseyNumber} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Goal or Miss Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={() => handleShootoutKick(shootoutState.nextIsHome, true)}
                      disabled={busy}
                      className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition ${
                        daylightMode
                          ? "bg-emerald-500 text-black border-2 border-black hover:bg-emerald-400"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      <span>⚽</span>
                      <span>SCORED / GOAL</span>
                    </button>
                    <button
                      onClick={() => handleShootoutKick(shootoutState.nextIsHome, false)}
                      disabled={busy}
                      className={`py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition ${
                        daylightMode
                          ? "bg-rose-500 text-white border-2 border-black hover:bg-rose-600"
                          : "bg-rose-600 hover:bg-rose-500 text-white"
                      }`}
                    >
                      <span>❌</span>
                      <span>MISSED / SAVED</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-5 rounded-2xl text-center space-y-3 ${
                    daylightMode ? "bg-emerald-50 border-4 border-black" : "bg-emerald-950/40 border border-emerald-600/50"
                  }`}
                >
                  <div className="inline-flex p-3 rounded-full bg-emerald-500 text-white">
                    <Trophy size={28} />
                  </div>
                  <h3 className={`text-lg font-black ${daylightMode ? "text-black" : "text-white"}`}>
                    🏆 {shootoutState.winner === "home" ? homeEntry?.teamName : awayEntry?.teamName} Wins Shootout!
                  </h3>
                  <p className="text-xs text-slate-400">
                    Bracket winner has been automatically advanced into the tournament finals/semis.
                  </p>
                </div>
              )}

              {/* Undo and Reset Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={handleUndoLastShootoutKick}
                  disabled={shootoutKicks.length === 0 || busy}
                  className="flex items-center gap-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                >
                  <RotateCcw size={14} /> Undo Last Kick
                </button>
                <button
                  type="button"
                  onClick={handleResetShootout}
                  disabled={shootoutKicks.length === 0 || busy}
                  className="text-rose-400 hover:text-rose-300 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                >
                  Reset Shootout
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className={`button secondary ${daylightMode ? "border-2 border-black text-black font-black" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                Close Shootout Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Match Sheet / Report Modal */}
      {activeModal === "report" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div
            className={`modal max-w-md ${
              daylightMode ? "bg-white text-black border-4 border-black" : "bg-slate-900 text-white border border-slate-800"
            }`}
          >
            <div className="modal-top">
              <div>
                <span className={`eyebrow ${daylightMode ? "text-neutral-700 font-black" : ""}`}>Official Match Sheet</span>
                <h2 className={daylightMode ? "text-black font-black" : "text-white"}>Submit Full-Time Report</h2>
              </div>
              <button
                className={`icon-button ${daylightMode ? "text-black hover:bg-neutral-100" : ""}`}
                onClick={() => setActiveModal(null)}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport}>
              <div className="modal-body space-y-4">
                <div
                  className={`p-4 rounded-2xl text-center font-mono font-black text-2xl ${
                    daylightMode ? "bg-neutral-100 text-black border-2 border-black" : "bg-slate-800 text-white"
                  }`}
                >
                  {homeEntry?.teamName} {currentFixture?.homeScore} - {currentFixture?.awayScore} {awayEntry?.teamName}
                  {shootoutKicks.length > 0 && (
                    <div className="text-sm font-sans font-bold text-amber-500 mt-1">
                      Penalties: {shootoutState.homeScore} - {shootoutState.awayScore}
                    </div>
                  )}
                </div>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Player of the Match (POTM)</span>
                  <select
                    value={potmId}
                    onChange={(e) => setPotmId(e.target.value)}
                    className={
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }
                  >
                    <option value="">Select outstanding player</option>
                    <optgroup label={homeEntry?.teamName}>
                      {homePlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={awayEntry?.teamName}>
                      {awayPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          #{p.jerseyNumber} {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>

                <label className="field">
                  <span className={daylightMode ? "text-black font-black" : ""}>Referee Match Notes</span>
                  <textarea
                    rows={3}
                    placeholder="Fair play remarks, pitch condition, or misconduct notes..."
                    value={refereeNotes}
                    onChange={(e) => setRefereeNotes(e.target.value)}
                    className={`text-xs p-2.5 rounded-xl w-full ${
                      daylightMode
                        ? "bg-white text-black border-2 border-black font-bold"
                        : "bg-slate-800 text-white border-slate-700"
                    }`}
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className={`button secondary ${daylightMode ? "border-2 border-black text-black font-black" : ""}`}
                  onClick={() => setActiveModal(null)}
                >
                  Cancel
                </button>
                <button
                  className={`button primary ${daylightMode ? "bg-rose-600 text-white border-2 border-black font-black" : ""}`}
                  disabled={busy}
                >
                  {busy ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />} Finalize & Blow Whistle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
