"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Crown,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Plus,
  Shield,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
  Printer,
  Share2,
  FileText,
} from "lucide-react";
import ThemeToggle from "../theme-toggle";
import type { Division, Entry, Fixture, MatchEvent, Player, SquadMember, Tournament } from "../components/types";
import { TacticalPitch } from "../components/tactics/TacticalPitch";
import { AppHeader } from "../components/layout/AppHeader";
import { AppFooter } from "../components/layout/AppFooter";

function getAgeCategoryBadge(dob?: string | null) {
  if (!dob) return null;
  const year = parseInt(dob.slice(0, 4), 10);
  if (isNaN(year)) return null;
  const ageIn2026 = 2026 - year;
  if (ageIn2026 <= 11) return { label: "U-11 Baby", color: "bg-sky-500/15 text-sky-400 border-sky-500/30" };
  if (ageIn2026 <= 13) return { label: "U-13 Sub-Jr", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (ageIn2026 <= 15) return { label: "U-15 Junior", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" };
  if (ageIn2026 <= 17) return { label: "U-17 Youth", color: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
  if (ageIn2026 <= 19) return { label: "U-19 Res", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  return { label: "Open", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
}

type Club = {
  id: string;
  name: string;
  organizationType: string;
  city: string;
  contactName: string;
  contactPhone: string;
};

type CoachPortalData = {
  clubs: Club[];
  teams: Array<{ id: string; clubId: string; name: string }>;
  entries: Entry[];
  tournaments: Tournament[];
  divisions: Division[];
  players: Player[];
  squadMembers: SquadMember[];
  fixtures: Fixture[];
  events: MatchEvent[];
  user: { email: string; displayName: string };
};

export function CoachPortalClient({ initialData }: { initialData: CoachPortalData }) {
  const [data, setData] = useState<CoachPortalData>(initialData);
  const [selectedClubId, setSelectedClubId] = useState<string>(data.clubs[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"roster" | "squads" | "fixtures" | "tournaments">("roster");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const activeClub = data.clubs.find((c) => c.id === selectedClubId) || data.clubs[0];

  const clubTeams = useMemo(() => {
    if (!activeClub) return [];
    return data.teams.filter((t) => t.clubId === activeClub.id);
  }, [data.teams, activeClub]);

  const clubTeamIds = useMemo(() => new Set(clubTeams.map((t) => t.id)), [clubTeams]);

  const clubEntries = useMemo(() => {
    return data.entries.filter((e) => clubTeamIds.has(e.teamId));
  }, [data.entries, clubTeamIds]);

  const clubPlayers = useMemo(() => {
    if (!activeClub) return [];
    return data.players.filter((p) => p.clubId === activeClub.id);
  }, [data.players, activeClub]);

  const clubFixtures = useMemo(() => {
    const entryIds = new Set(clubEntries.map((e) => e.id));
    return data.fixtures.filter((f) => entryIds.has(f.homeEntryId) || entryIds.has(f.awayEntryId));
  }, [data.fixtures, clubEntries]);

  const [selectedEntryId, setSelectedEntryId] = useState<string>(clubEntries[0]?.id || "");
  const activeEntry = clubEntries.find((e) => e.id === selectedEntryId) || clubEntries[0];
  const activeDivision = data.divisions.find((d) => d.id === activeEntry?.divisionId);
  const activeTournament = data.tournaments.find((t) => t.id === activeDivision?.tournamentId);

  const entrySquad = useMemo(() => {
    if (!activeEntry) return [];
    return data.squadMembers.filter((sm) => sm.entryId === activeEntry.id);
  }, [data.squadMembers, activeEntry]);

  const assignedPlayerIds = new Set(entrySquad.map((sm) => sm.playerId));
  const startingPlayerIds = new Set(entrySquad.filter((sm) => sm.isStarting).map((sm) => sm.playerId));

  const startingLineup = clubPlayers.filter((p) => startingPlayerIds.has(p.id));
  const substitutes = clubPlayers.filter((p) => assignedPlayerIds.has(p.id) && !startingPlayerIds.has(p.id));
  const unassignedClubPlayers = clubPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  const refreshData = async () => {
    try {
      const res = await fetch("/api/app");
      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({
          ...prev,
          players: json.players || [],
          squadMembers: json.squadMembers || [],
          entries: json.entries || [],
          fixtures: json.fixtures || [],
        }));
      }
    } catch {
      // ignore
    }
  };

  const handleAddPlayer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeClub) return;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const jerseyNumber = Number(form.get("jerseyNumber") || 0);
    const position = String(form.get("position") || "MID");
    const isCaptain = form.get("isCaptain") === "on";
    const dateOfBirth = String(form.get("dateOfBirth") || "");

    const res = await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "addPlayer",
        clubId: activeClub.id,
        name,
        jerseyNumber,
        position,
        isCaptain,
        dateOfBirth: dateOfBirth || null,
      }),
    });

    if (res.ok) {
      setToast("Player added to club roster!");
      setTimeout(() => setToast(""), 3000);
      setShowAddPlayer(false);
      await refreshData();
    }
    setBusy(false);
  };

  const handleToggleStarting = async (playerId: string, currentStarting: boolean) => {
    if (!activeEntry) return;
    setBusy(true);
    const updatedSquad = entrySquad.map((sm) => {
      if (sm.playerId === playerId) return { ...sm, isStarting: !currentStarting };
      return sm;
    });
    await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateSquad", entryId: activeEntry.id, squad: updatedSquad }),
    });
    await refreshData();
    setBusy(false);
  };

  const handleAddToSquad = async (playerId: string) => {
    if (!activeEntry) return;
    setBusy(true);
    const updatedSquad = [
      ...entrySquad,
      { playerId, isStarting: entrySquad.length < 11, jerseyNumber: null, position: null },
    ];
    await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateSquad", entryId: activeEntry.id, squad: updatedSquad }),
    });
    await refreshData();
    setBusy(false);
  };

  const handleRemoveFromSquad = async (playerId: string) => {
    if (!activeEntry) return;
    setBusy(true);
    const updatedSquad = entrySquad.filter((sm) => sm.playerId !== playerId);
    await fetch("/api/app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateSquad", entryId: activeEntry.id, squad: updatedSquad }),
    });
    await refreshData();
    setBusy(false);
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case "GK": return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "DEF": return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "MID": return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "FWD": return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default: return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Unified App Header */}
      <AppHeader activeRoute="coach" user={data.user} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 flex items-center gap-3">
            <Check size={18} className="text-emerald-400" />
            <span className="text-sm font-semibold">{toast}</span>
          </div>
        )}

        {/* Coach Welcome Banner */}
        <div className="cascade-1 relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white p-6 sm:p-8 border border-emerald-500/20 shadow-xl">
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase">
                <ShieldCheck size={14} /> Official Academy & Team Manager Hub
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-white">{activeClub?.name}</h1>
              <p className="text-slate-300 text-xs sm:text-sm">
                Head Coach: <strong className="text-white">{data.user.displayName}</strong> • {activeClub?.city} •{" "}
                {clubTeams.length} Active Teams
              </p>
            </div>

            {/* Club Selector if multiple */}
            {data.clubs.length > 1 && (
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Switch Club</span>
                <select
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-bold p-2 rounded-xl border border-slate-600 focus:outline-none cursor-pointer"
                >
                  {data.clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Portal Nav Tabs */}
        <div className="cascade-2 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("roster")}
            className={`interactive-button px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "roster"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users size={15} /> Club Player Pool ({clubPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab("squads")}
            className={`interactive-button px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "squads"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield size={15} /> Match Squad Lineups
          </button>
          <button
            onClick={() => setActiveTab("fixtures")}
            className={`interactive-button px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "fixtures"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar size={15} /> Team Fixtures ({clubFixtures.length})
          </button>
          <button
            onClick={() => setActiveTab("tournaments")}
            className={`interactive-button px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "tournaments"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy size={15} /> Tournament Entries ({clubEntries.length})
          </button>
        </div>

        {/* TAB 1: CLUB PLAYER ROSTER */}
        {activeTab === "roster" && (
          <div className="cascade-3 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-foreground">Club Players Directory</h3>
                <p className="text-xs text-muted-foreground">Manage your club roster with jersey numbers, positions, and DOB.</p>
              </div>
              <button
                onClick={() => setShowAddPlayer(true)}
                className="interactive-button button primary inline-flex items-center gap-1.5 text-xs px-3.5 py-2"
              >
                <UserPlus size={15} /> Add Player
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {clubPlayers.map((player) => (
                <div
                  key={player.id}
                  className="interactive-card panel-card p-4 rounded-2xl bg-card border border-border space-y-3 shadow-sm hover:border-primary/40 transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center font-mono font-black text-sm text-foreground">
                      #{player.jerseyNumber}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getPositionColor(player.position)}`}>
                      {player.position}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="font-bold text-sm text-foreground">{player.name}</strong>
                      {player.isCaptain && <Crown size={13} className="text-amber-500" />}
                    </div>
                    {player.dateOfBirth && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-mono">DOB: {player.dateOfBirth}</span>
                        {getAgeCategoryBadge(player.dateOfBirth) && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${getAgeCategoryBadge(player.dateOfBirth)!.color}`}>
                            {getAgeCategoryBadge(player.dateOfBirth)!.label}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: TOURNAMENT SQUAD BUILDER */}
        {activeTab === "squads" && (
          <div className="cascade-3 space-y-6">
            <div className="panel-card p-5 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Select Active Entry:</span>
                <select
                  value={selectedEntryId}
                  onChange={(e) => setSelectedEntryId(e.target.value)}
                  className="font-bold text-base bg-transparent border-none focus:outline-none cursor-pointer text-foreground block mt-1"
                >
                  {clubEntries.map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-popover text-popover-foreground">
                      {entry.teamName} — {activeTournament?.name} ({entry.groupName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
                  <span>Selected: <strong className="text-foreground">{entrySquad.length} / {activeDivision?.maxSquadSize || 18}</strong></span>
                  <span>•</span>
                  <span>Starting: <strong className="text-emerald-500">{startingLineup.length}</strong></span>
                </div>

                <button
                  onClick={() => {
                    const lineupText = startingLineup.map((p) => `#${p.jerseyNumber} ${p.name} (${p.position})`).join("\n");
                    const text = encodeURIComponent(
                      `📋 *${activeEntry?.teamName || "Club"}* — Starting XI Matchday Lineup\n🏆 Tournament: ${activeTournament?.name || "Cup"}\n\n*Starting XI:*\n${lineupText}\n\nShared via MyFootball Bharat 🇮🇳`
                    );
                    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
                  }}
                  className="interactive-button py-1.5 px-3 rounded-xl bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Share2 size={13} /> Share on WhatsApp
                </button>

                <button
                  onClick={() => window.print()}
                  className="interactive-button py-1.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer size={13} /> Print Match Sheet (A4)
                </button>
              </div>
            </div>

            {/* 2D Tactical Pitch Board */}
            <div className="panel-card p-6 rounded-3xl bg-card border border-border shadow-md">
              <TacticalPitch
                startingPlayers={startingLineup}
                benchPlayers={substitutes}
                teamName={activeEntry?.teamName}
                onSwapPlayer={(pitchId, benchId) => {
                  void handleToggleStarting(pitchId, true);
                  void handleToggleStarting(benchId, false);
                }}
                onBenchPlayer={(pitchId) => {
                  void handleToggleStarting(pitchId, true);
                }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Starting XI */}
              <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-3">
                <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Starting XI ({startingLineup.length})
                </h4>
                {startingLineup.map((p) => (
                  <div key={p.id} className="interactive-row flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-muted-foreground">#{p.jerseyNumber}</strong>
                      <span className="font-bold text-foreground">{p.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${getPositionColor(p.position)}`}>
                        {p.position}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleStarting(p.id, true)}
                      className="interactive-button text-[11px] px-2 py-1 rounded bg-muted hover:bg-secondary font-medium"
                    >
                      Bench
                    </button>
                  </div>
                ))}
              </div>

              {/* Substitutes */}
              <div className="panel-card p-5 rounded-2xl bg-card border border-border space-y-3">
                <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Substitutes ({substitutes.length})
                </h4>
                {substitutes.map((p) => (
                  <div key={p.id} className="interactive-row flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border text-xs">
                    <div className="flex items-center gap-2">
                      <strong className="font-mono text-muted-foreground">#{p.jerseyNumber}</strong>
                      <span className="font-bold text-foreground">{p.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${getPositionColor(p.position)}`}>
                        {p.position}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleStarting(p.id, false)}
                      className="interactive-button text-[11px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-600 font-medium"
                    >
                      Start
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FIXTURES */}
        {activeTab === "fixtures" && (
          <div className="cascade-3 space-y-4">
            <h3 className="font-extrabold text-lg text-foreground">Team Match Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubFixtures.map((f) => {
                const h = data.entries.find((e) => e.id === f.homeEntryId);
                const a = data.entries.find((e) => e.id === f.awayEntryId);
                return (
                  <div key={f.id} className="interactive-card panel-card p-4 rounded-2xl bg-card border border-border space-y-2 cursor-pointer shadow-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{f.roundName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-muted font-bold text-foreground">Pitch {f.pitch}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-sm text-foreground">
                      <span>{h?.teamName || "TBD"}</span>
                      <span className="font-mono">{f.status === "completed" || f.status === "in_progress" ? `${f.homeScore} - ${f.awayScore}` : "vs"}</span>
                      <span>{a?.teamName || "TBD"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: TOURNAMENTS */}
        {activeTab === "tournaments" && (
          <div className="cascade-3 space-y-4">
            <h3 className="font-extrabold text-lg text-foreground">Tournament Registrations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubEntries.map((entry) => {
                const div = data.divisions.find((d) => d.id === entry.divisionId);
                const tourney = data.tournaments.find((t) => t.id === div?.tournamentId);
                return (
                  <div key={entry.id} className="interactive-card panel-card p-5 rounded-2xl bg-card border border-border space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-bold uppercase">
                        {entry.status}
                      </span>
                      <span className="text-xs text-muted-foreground">Payment: {entry.paymentStatus}</span>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-foreground">{tourney?.name}</h4>
                      <p className="text-xs text-muted-foreground">{div?.name} • Assigned: {entry.groupName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-md">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Coach Squad Management</span>
                <h2>Add Player to {activeClub?.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddPlayer(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleAddPlayer}>
              <div className="modal-body space-y-4">
                <label className="field">
                  <span>Player Full Name</span>
                  <input name="name" placeholder="e.g. Rahul Patil" required autoFocus />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="field">
                    <span>Jersey #</span>
                    <input name="jerseyNumber" type="number" min="1" max="99" defaultValue="11" required />
                  </label>
                  <label className="field">
                    <span>Position</span>
                    <select name="position" defaultValue="MID">
                      <option value="GK">Goalkeeper (GK)</option>
                      <option value="DEF">Defender (DEF)</option>
                      <option value="MID">Midfielder (MID)</option>
                      <option value="FWD">Forward (FWD)</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Date of Birth</span>
                  <input name="dateOfBirth" type="date" />
                </label>
                <label className="toggle-row">
                  <div>
                    <strong>Team Captain</strong>
                    <small>Armband for match coin toss</small>
                  </div>
                  <input name="isCaptain" type="checkbox" />
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="button secondary" onClick={() => setShowAddPlayer(false)}>
                  Cancel
                </button>
                <button className="button primary" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />} Save to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-ONLY A4 TOURNAMENT CHECK-IN MATCH SHEET */}
      <div className="print-only hidden p-8 bg-white text-black print-page">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight">AIFF Official Matchday Team Sheet</h1>
            <p className="text-xs font-bold text-gray-700 mt-1">
              Tournament: <strong className="text-black">{activeTournament?.name || "All India Tournament"}</strong> | Division: <strong className="text-black">{activeDivision?.name || "Division"}</strong>
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              Club: <strong className="text-black">{activeClub?.name}</strong> | Team: <strong className="text-black">{activeEntry?.teamName}</strong> | City: <strong className="text-black">{activeClub?.city}</strong>
            </p>
          </div>
          <div className="text-right border border-black p-2 rounded">
            <span className="text-[10px] uppercase font-bold block">Verified Match Roster</span>
            <strong className="text-sm font-mono">{entrySquad.length} Players Listed</strong>
          </div>
        </div>

        <h3 className="text-sm font-black uppercase mb-2 border-b border-black pb-1">Starting XI Lineup</h3>
        <table className="print-table w-full text-xs mb-6">
          <thead>
            <tr>
              <th className="w-12 text-center">Jersey</th>
              <th className="text-left">Player Full Name</th>
              <th className="w-16 text-center">Position</th>
              <th className="w-24 text-center">DOB</th>
              <th className="w-28 text-center">Age Category</th>
              <th className="w-20 text-center">Captain</th>
              <th className="w-28 text-center">Ref Verification</th>
            </tr>
          </thead>
          <tbody>
            {startingLineup.map((p) => {
              const badge = getAgeCategoryBadge(p.dateOfBirth);
              return (
                <tr key={p.id}>
                  <td className="text-center font-bold font-mono">#{p.jerseyNumber}</td>
                  <td className="font-bold">{p.name}</td>
                  <td className="text-center">{p.position}</td>
                  <td className="text-center font-mono">{p.dateOfBirth || "N/A"}</td>
                  <td className="text-center font-bold">{badge?.label || "Open"}</td>
                  <td className="text-center">{p.isCaptain ? "CAPTAIN (C)" : "-"}</td>
                  <td className="text-center font-mono">[  ] Verified</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {substitutes.length > 0 && (
          <>
            <h3 className="text-sm font-black uppercase mb-2 border-b border-black pb-1">Substitutes Bench</h3>
            <table className="print-table w-full text-xs mb-6">
              <thead>
                <tr>
                  <th className="w-12 text-center">Jersey</th>
                  <th className="text-left">Player Full Name</th>
                  <th className="w-16 text-center">Position</th>
                  <th className="w-24 text-center">DOB</th>
                  <th className="w-28 text-center">Age Category</th>
                  <th className="w-28 text-center">Ref Verification</th>
                </tr>
              </thead>
              <tbody>
                {substitutes.map((p) => {
                  const badge = getAgeCategoryBadge(p.dateOfBirth);
                  return (
                    <tr key={p.id}>
                      <td className="text-center font-bold font-mono">#{p.jerseyNumber}</td>
                      <td className="font-bold">{p.name}</td>
                      <td className="text-center">{p.position}</td>
                      <td className="text-center font-mono">{p.dateOfBirth || "N/A"}</td>
                      <td className="text-center font-bold">{badge?.label || "Open"}</td>
                      <td className="text-center font-mono">[  ] Verified</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-3 gap-6 text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-gray-600">Head Coach Signature</span>
            <div className="mt-6 border-b border-black pb-1 font-bold">{activeClub?.contactName || "Head Coach"}</div>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-gray-600">Match Commissioner / Official</span>
            <div className="mt-6 border-b border-black pb-1 font-mono">Signature: _______________</div>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-gray-600">Official Stamp / Seal</span>
            <div className="mt-6 border-b border-black pb-1 font-mono">Date: ___ / ___ / 2026</div>
          </div>
        </div>
      </div>

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
