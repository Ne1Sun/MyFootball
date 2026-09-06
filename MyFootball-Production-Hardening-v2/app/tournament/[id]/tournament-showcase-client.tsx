"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  Compass,
  Crown,
  ExternalLink,
  Flame,
  Globe,
  Heart,
  MapPin,
  MessageSquareText,
  Phone,
  Play,
  Plus,
  Share2,
  Shield,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";
import ThemeToggle from "../../theme-toggle";
import type { Division, Entry, Fixture, MatchEvent, Player, SquadMember, Tournament } from "../../components/types";
import { TacticalPitch } from "../../components/tactics/TacticalPitch";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppFooter } from "../../components/layout/AppFooter";
import { BroadcastScorebug } from "../../components/broadcast/BroadcastScorebug";
import { WhatsAppScorecardCard } from "../../components/social/WhatsAppScorecardCard";

type PublicTournamentData = {
  tournament: Tournament;
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  events: MatchEvent[];
  players?: Player[];
  squadMembers?: SquadMember[];
  announcements: Array<{ id: string; tournamentId: string; body: string; audience: string; createdAt: string }>;
  isFollowed: boolean;
  user: { email: string; displayName: string } | null;
};

export function TournamentShowcaseClient({ initialData }: { initialData: PublicTournamentData }) {
  const [data, setData] = useState<PublicTournamentData>(initialData);
  const [activeTab, setActiveTab] = useState<"matches" | "tactics" | "brackets" | "standings" | "honors" | "announcements">("matches");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(data.divisions[0]?.id || "");
  const [selectedTeamLineupId, setSelectedTeamLineupId] = useState<string>(data.entries[0]?.id || "");
  const [selectedMatchModal, setSelectedMatchModal] = useState<Fixture | null>(null);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(data.isFollowed);
  const [busyFollow, setBusyFollow] = useState(false);

  const tournament = data.tournament;
  const division = data.divisions.find((d) => d.id === selectedDivisionId) || data.divisions[0];

  const divisionFixtures = useMemo(() => {
    if (!division) return [];
    return data.fixtures.filter((f) => f.divisionId === division.id);
  }, [data.fixtures, division]);

  const liveFixtures = useMemo(() => {
    return divisionFixtures.filter((f) => f.status === "in_progress");
  }, [divisionFixtures]);

  // Selected Team for Tactical Pitch Tab
  const selectedEntry = data.entries.find((e) => e.id === selectedTeamLineupId) || data.entries[0];
  const allPlayers = data.players || [];
  const allSquadMembers = data.squadMembers || [];

  const teamSquad = useMemo(() => {
    if (!selectedEntry) return [];
    return allSquadMembers.filter((sm) => sm.entryId === selectedEntry.id);
  }, [allSquadMembers, selectedEntry]);

  const startingPlayerIds = new Set(teamSquad.filter((sm) => sm.isStarting).map((sm) => sm.playerId));
  const assignedPlayerIds = new Set(teamSquad.map((sm) => sm.playerId));

  const startingLineup = useMemo(() => {
    if (!selectedEntry) return [];
    const clubPool = allPlayers.filter((p) => p.clubId === selectedEntry.clubId);
    return clubPool.filter((p) => startingPlayerIds.has(p.id));
  }, [allPlayers, selectedEntry, startingPlayerIds]);

  const benchPlayers = useMemo(() => {
    if (!selectedEntry) return [];
    const clubPool = allPlayers.filter((p) => p.clubId === selectedEntry.clubId);
    return clubPool.filter((p) => assignedPlayerIds.has(p.id) && !startingPlayerIds.has(p.id));
  }, [allPlayers, selectedEntry, assignedPlayerIds, startingPlayerIds]);

  // Handle follow toggle
  const handleToggleFollow = async () => {
    if (!data.user) {
      window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    try {
      setBusyFollow(true);
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament.id, follow: !following }),
      });
      if (res.ok) setFollowing(!following);
    } catch {
      // ignore
    } finally {
      setBusyFollow(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const googleMapsUrl =
    tournament.latitude && tournament.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${tournament.latitude},${tournament.longitude}`
        )}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${tournament.venueName}, ${tournament.city}, ${tournament.state}`
        )}`;

  // Standings calculation
  const groupedStandings = useMemo(() => {
    if (!division) return {};
    const groups: Record<string, Array<{ entry: Entry; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number; form: Array<"W"|"D"|"L"> }>> = {};

    data.entries.filter((e) => e.divisionId === division.id).forEach((entry) => {
      const gName = entry.groupName || "Group A";
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push({ entry, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] });
    });

    divisionFixtures.filter((f) => f.stage === "group" && f.status === "completed").forEach((f) => {
      for (const list of Object.values(groups)) {
        const home = list.find((item) => item.entry.id === f.homeEntryId);
        const away = list.find((item) => item.entry.id === f.awayEntryId);
        if (home && away) {
          home.p += 1; away.p += 1; home.gf += f.homeScore; home.ga += f.awayScore; away.gf += f.awayScore; away.ga += f.homeScore;
          if (f.homeScore > f.awayScore) { home.w += 1; away.l += 1; home.pts += division.winPoints; away.pts += division.lossPoints; home.form.push("W"); away.form.push("L"); }
          else if (f.homeScore < f.awayScore) { away.w += 1; home.l += 1; away.pts += division.winPoints; home.pts += division.lossPoints; away.form.push("W"); home.form.push("L"); }
          else { home.d += 1; away.d += 1; home.pts += division.drawPoints; away.pts += division.drawPoints; home.form.push("D"); away.form.push("D"); }
        }
      }
    });

    for (const [groupName, list] of Object.entries(groups)) {
      list.forEach((item) => (item.gd = item.gf - item.ga));
      groups[groupName] = list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    }
    return groups;
  }, [division, data.entries, divisionFixtures]);

  // Leaderboards calculation
  const topScorers = useMemo(() => {
    const divFixIds = new Set(divisionFixtures.map((f) => f.id));
    const map = new Map<string, { name: string; teamName: string; goals: number; penalties: number }>();
    data.events.filter((e) => divFixIds.has(e.fixtureId) && (e.type === "goal" || e.type === "penalty_goal")).forEach((ev) => {
      const key = ev.playerId || ev.playerName;
      const entry = data.entries.find((e) => e.id === ev.entryId);
      const existing = map.get(key) || { name: ev.playerName, teamName: entry?.teamName || "Team", goals: 0, penalties: 0 };
      existing.goals += 1;
      if (ev.type === "penalty_goal") existing.penalties += 1;
      map.set(key, existing);
    });
    return [...map.values()].sort((a, b) => b.goals - a.goals);
  }, [divisionFixtures, data.events, data.entries]);

  // Knockout Bracket Fixtures
  const semiFinals = divisionFixtures.filter((f) => f.bracketRound === "semi_final");
  const finalMatch = divisionFixtures.find((f) => f.bracketRound === "final");
  const bronzeMatch = divisionFixtures.find((f) => f.bracketRound === "third_place");

  // Regional Pride Badge helper
  const getRegionalBadge = (state: string) => {
    switch (state?.toLowerCase()) {
      case "maharashtra": return { label: "🦁 Maha Pride", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
      case "punjab": return { label: "🐅 Sher-e-Punjab", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" };
      case "kerala": return { label: "🌴 God's Own Football", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
      case "goa": return { label: "🌊 Mandovi Wave", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" };
      case "west bengal":
      case "bengal": return { label: "⚽ Joy Bangla Football", color: "bg-rose-500/20 text-rose-300 border-rose-500/40" };
      case "karnataka": return { label: "🛡️ Deccan Vanguard", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" };
      default: return { label: "🇮🇳 Indian Grassroots", color: "bg-slate-700 text-slate-300 border-slate-600" };
    }
  };

  const regBadge = getRegionalBadge(tournament.state);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Unified App Header */}
      <AppHeader activeRoute="tournament" user={data.user} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Tournament Hero Showcase Card */}
        <div className="cascade-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 sm:p-10 shadow-2xl border border-slate-700/50">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    tournament.status === "live"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : tournament.status === "registration_open"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {tournament.status === "live" && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                  {tournament.status.replace("_", " ").toUpperCase()}
                </span>

                {/* Regional Pride Badge */}
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${regBadge.color}`}>
                  {regBadge.label}
                </span>

                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  {tournament.city}, {tournament.state}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleFollow}
                  disabled={busyFollow}
                  className={`interactive-button inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                    following
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                      : "bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300"
                  }`}
                >
                  <Heart size={14} className={following ? "fill-rose-500 text-rose-500" : ""} />
                  <span>{following ? "Following" : "Follow"}</span>
                </button>

                {tournament.status === "registration_open" && (
                  <a
                    href={`/register/${tournament.id}`}
                    className="interactive-button inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs shadow-lg hover:opacity-90 transition"
                  >
                    <Plus size={14} /> Register Team
                  </a>
                )}
              </div>
            </div>

            {/* Title & Info */}
            <div className="space-y-2 max-w-3xl">
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{tournament.name}</h1>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Organized by <strong className="text-white">{tournament.organizedBy}</strong> • Contact:{" "}
                {tournament.contactName} ({tournament.contactPhone})
              </p>
            </div>

            {/* Venue & Geocoding Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-700/60">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
                <MapPin size={18} className="text-primary shrink-0" />
                <span>
                  <strong>{tournament.venueName}</strong> — {tournament.addressLine1}, {tournament.locality},{" "}
                  {tournament.city} {tournament.postalCode}
                </span>
              </div>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <span>Open in Google Maps</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </div>

        {/* Division Selector & Tab Bar */}
        <div className="cascade-2 panel-card p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Category:</span>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="font-bold text-sm bg-muted px-3 py-1.5 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
            >
              {data.divisions.map((d) => (
                <option key={d.id} value={d.id} className="bg-popover text-popover-foreground">
                  {d.name} ({d.format.replace("_", " ").toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("matches")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "matches"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Swords size={14} /> Matches & Ticker
            </button>
            <button
              onClick={() => setActiveTab("tactics")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "tactics"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={14} /> 2D Tactical Lineups
            </button>
            <button
              onClick={() => setActiveTab("brackets")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "brackets"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy size={14} /> Knockout Tree
            </button>
            <button
              onClick={() => setActiveTab("standings")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "standings"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 size={14} /> Group Tables
            </button>
            <button
              onClick={() => setActiveTab("honors")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "honors"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Award size={14} /> Golden Boot & Honors
            </button>
            <button
              onClick={() => setActiveTab("announcements")}
              className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "announcements"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquareText size={14} /> Updates ({data.announcements.length})
            </button>
          </div>
        </div>

        {/* TAB 1: MATCHES & TICKER */}
        {activeTab === "matches" && (
          <div className="cascade-3 space-y-6">
            {/* Live Matches Section */}
            {liveFixtures.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <h3 className="font-extrabold text-lg text-foreground">Matches Live Right Now</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {liveFixtures.map((f) => {
                    const h = data.entries.find((e) => e.id === f.homeEntryId);
                    const a = data.entries.find((e) => e.id === f.awayEntryId);
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedMatchModal(f)}
                        className="interactive-card panel-card p-5 rounded-2xl bg-card border-2 border-rose-500/40 hover:border-rose-500 transition cursor-pointer shadow-lg shadow-rose-500/5 space-y-4"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                          <span className="font-bold text-foreground">{f.roundName}</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 font-extrabold animate-pulse">
                            LIVE {f.matchClockMinute}&apos; • Pitch {f.pitch}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 items-center text-center gap-2">
                          <div className="space-y-1">
                            <strong className="block text-sm sm:text-base text-foreground font-bold">{h?.teamName}</strong>
                            <span className="text-[11px] text-muted-foreground">{h?.clubName}</span>
                          </div>
                          <div className="font-mono font-black text-3xl sm:text-4xl text-primary">
                            {f.homeScore} : {f.awayScore}
                          </div>
                          <div className="space-y-1">
                            <strong className="block text-sm sm:text-base text-foreground font-bold">{a?.teamName}</strong>
                            <span className="text-[11px] text-muted-foreground">{a?.clubName}</span>
                          </div>
                        </div>

                        <div className="text-center text-xs font-semibold text-primary pt-1 flex items-center justify-center gap-1">
                          <span>View matchday events & timeline</span>
                          <ChevronRight size={13} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed & Scheduled Matches */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-lg text-foreground">All Fixtures & Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {divisionFixtures.map((f) => {
                  const h = data.entries.find((e) => e.id === f.homeEntryId);
                  const a = data.entries.find((e) => e.id === f.awayEntryId);
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedMatchModal(f)}
                      className="interactive-card panel-card p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition cursor-pointer space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                        <span className="font-bold text-muted-foreground">{f.roundName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium text-[11px]">
                          {f.status === "completed" ? "FINAL" : f.status === "in_progress" ? "LIVE" : `Pitch ${f.pitch}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 truncate">
                          <Shield size={16} className="text-primary shrink-0" />
                          <span className="font-bold text-sm text-foreground truncate">{h?.teamName || "TBD"}</span>
                        </div>
                        <div className="font-mono font-black text-base text-foreground shrink-0">
                          {f.status === "completed" || f.status === "in_progress"
                            ? `${f.homeScore} - ${f.awayScore}`
                            : "vs"}
                        </div>
                        <div className="flex items-center gap-2 truncate justify-end">
                          <span className="font-bold text-sm text-foreground truncate">{a?.teamName || "TBD"}</span>
                          <Shield size={16} className="text-blue-500 shrink-0" />
                        </div>
                      </div>

                      {f.potmPlayerName && (
                        <div className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                          <Star size={12} fill="currentColor" /> POTM: {f.potmPlayerName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 2D TACTICAL LINEUPS */}
        {activeTab === "tactics" && (
          <div className="cascade-3 space-y-6">
            <div className="panel-card p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-muted-foreground">Select Team:</span>
                <select
                  value={selectedTeamLineupId}
                  onChange={(e) => setSelectedTeamLineupId(e.target.value)}
                  className="font-bold text-sm bg-muted px-3 py-1.5 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
                >
                  {data.entries.filter((e) => e.divisionId === division?.id).map((entry) => (
                    <option key={entry.id} value={entry.id} className="bg-popover text-popover-foreground">
                      {entry.teamName} ({entry.clubName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-muted-foreground">
                Starting XI: <strong className="text-emerald-500">{startingLineup.length}</strong> • Bench:{" "}
                <strong className="text-foreground">{benchPlayers.length}</strong>
              </div>
            </div>

            <div className="panel-card p-6 rounded-3xl bg-card border border-border shadow-md">
              <TacticalPitch
                startingPlayers={startingLineup}
                benchPlayers={benchPlayers}
                teamName={selectedEntry?.teamName}
                isInteractive={false}
              />
            </div>
          </div>
        )}

        {/* TAB 3: KNOCKOUT TREE */}
        {activeTab === "brackets" && (
          <div className="cascade-3 space-y-6">
            <div className="panel-card p-6 rounded-3xl bg-card border border-border space-y-6 overflow-x-auto shadow-xl">
              <div className="min-w-[760px] grid grid-cols-3 gap-8 items-center">
                {/* Semi Finals */}
                <div className="space-y-4">
                  <div className="text-center font-bold text-xs uppercase tracking-widest text-muted-foreground pb-2 border-b border-border">
                    Semi-Finals
                  </div>
                  {semiFinals.map((sf, idx) => {
                    const h = data.entries.find((e) => e.id === sf.homeEntryId);
                    const a = data.entries.find((e) => e.id === sf.awayEntryId);
                    return (
                      <div
                        key={sf.id}
                        onClick={() => setSelectedMatchModal(sf)}
                        className="interactive-card p-3.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition border border-border cursor-pointer space-y-2"
                      >
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Semi-Final {idx + 1}</span>
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span>{h?.teamName || "TBD"}</span>
                          <span className="font-mono">{sf.status === "completed" ? sf.homeScore : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span>{a?.teamName || "TBD"}</span>
                          <span className="font-mono">{sf.status === "completed" ? sf.awayScore : "-"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Connector */}
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-amber-500 font-black text-sm animate-trophy-pulse">
                    🏆
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Championship Pathway</div>
                </div>

                {/* Final & 3rd Place */}
                <div className="space-y-4">
                  <div className="text-center font-bold text-xs uppercase tracking-widest text-amber-500 pb-2 border-b border-amber-500/30">
                    Grand Final & 3rd Place
                  </div>
                  {finalMatch && (
                    <div
                      onClick={() => setSelectedMatchModal(finalMatch)}
                      className="interactive-card p-4 rounded-xl bg-gradient-to-br from-amber-500/15 via-background to-card border-2 border-amber-500/40 hover:border-amber-500 transition cursor-pointer space-y-2 shadow-lg shadow-amber-500/5"
                    >
                      <span className="text-[10px] font-black text-amber-500 uppercase flex items-center gap-1">
                        <Crown size={12} /> 🏆 Grand Championship Final
                      </span>
                      <div className="flex items-center justify-between text-sm font-bold text-foreground">
                        <span>{data.entries.find((e) => e.id === finalMatch.homeEntryId)?.teamName || "TBD"}</span>
                        <span className="font-mono font-black">{finalMatch.homeScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-foreground">
                        <span>{data.entries.find((e) => e.id === finalMatch.awayEntryId)?.teamName || "TBD"}</span>
                        <span className="font-mono font-black">{finalMatch.awayScore}</span>
                      </div>
                    </div>
                  )}

                  {bronzeMatch && (
                    <div
                      onClick={() => setSelectedMatchModal(bronzeMatch)}
                      className="interactive-card p-3.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition border border-border cursor-pointer space-y-2"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">🥉 3rd Place Playoff</span>
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>{data.entries.find((e) => e.id === bronzeMatch.homeEntryId)?.teamName || "TBD"}</span>
                        <span className="font-mono">{bronzeMatch.homeScore}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span>{data.entries.find((e) => e.id === bronzeMatch.awayEntryId)?.teamName || "TBD"}</span>
                        <span className="font-mono">{bronzeMatch.awayScore}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GROUP STANDINGS */}
        {activeTab === "standings" && (
          <div className="cascade-3 space-y-6">
            {Object.entries(groupedStandings).map(([groupName, rows]) => (
              <div key={groupName} className="panel-card rounded-3xl p-6 bg-card border border-border space-y-4 shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
                    <Trophy size={18} className="text-primary" /> {groupName} Standings
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    Top 2 Qualify
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                        <th className="py-2.5 px-3">Pos</th>
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3 text-center">P</th>
                        <th className="py-2.5 px-3 text-center">W</th>
                        <th className="py-2.5 px-3 text-center">D</th>
                        <th className="py-2.5 px-3 text-center">L</th>
                        <th className="py-2.5 px-3 text-center">GD</th>
                        <th className="py-2.5 px-3 text-right">Pts</th>
                        <th className="py-2.5 px-3 text-center">Form</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row, index) => {
                        const qualifies = index < (division?.teamsAdvancingPerGroup || 2);
                        return (
                          <tr key={row.entry.id} className={`interactive-row ${qualifies ? "bg-emerald-500/5 font-semibold" : ""}`}>
                            <td className="py-3 px-3 font-mono font-bold">{index + 1}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <Shield size={16} className={qualifies ? "text-emerald-500" : "text-muted-foreground"} />
                                <div>
                                  <strong className="text-foreground">{row.entry.teamName}</strong>
                                  <div className="text-[11px] text-muted-foreground">{row.entry.clubName}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono">{row.p}</td>
                            <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{row.w}</td>
                            <td className="py-3 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{row.d}</td>
                            <td className="py-3 px-3 text-center font-mono text-rose-600 dark:text-rose-400">{row.l}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                            <td className="py-3 px-3 text-right font-mono font-black text-primary text-base">{row.pts}</td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {row.form.slice(-5).map((f, i) => (
                                  <span
                                    key={i}
                                    className={`w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center ${
                                      f === "W"
                                        ? "bg-emerald-500/20 text-emerald-600"
                                        : f === "D"
                                        ? "bg-amber-500/20 text-amber-600"
                                        : "bg-rose-500/20 text-rose-600"
                                    }`}
                                  >
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: HONORS & 3D GOLDEN BOOT PODIUM */}
        {activeTab === "honors" && (
          <div className="cascade-3 space-y-6">
            {/* Top 3 Podium Cards */}
            {topScorers.length >= 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                {/* Silver 🥈 */}
                <div className="interactive-card panel-card p-5 rounded-3xl bg-card border-2 border-slate-400/40 text-center space-y-2 shadow-lg sm:order-1 order-2">
                  <span className="text-3xl">🥈</span>
                  <strong className="block text-base font-extrabold text-foreground">{topScorers[1].name}</strong>
                  <span className="text-xs text-muted-foreground block">{topScorers[1].teamName}</span>
                  <div className="font-mono font-black text-2xl text-slate-300 pt-2 border-t border-border">
                    {topScorers[1].goals} Goals
                  </div>
                </div>

                {/* Gold 🥇 */}
                <div className="interactive-card panel-card p-6 rounded-3xl bg-gradient-to-b from-amber-500/20 via-card to-card border-2 border-amber-400 shadow-2xl text-center space-y-3 sm:order-2 order-1 sm:-translate-y-4">
                  <span className="text-5xl animate-trophy-pulse block">🥇</span>
                  <strong className="block text-lg font-black text-foreground">{topScorers[0].name}</strong>
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider block">{topScorers[0].teamName}</span>
                  <div className="font-mono font-black text-3xl text-amber-500 pt-2 border-t border-amber-500/30">
                    {topScorers[0].goals} Goals
                  </div>
                </div>

                {/* Bronze 🥉 */}
                <div className="interactive-card panel-card p-5 rounded-3xl bg-card border-2 border-amber-700/40 text-center space-y-2 shadow-lg sm:order-3 order-3">
                  <span className="text-3xl">🥉</span>
                  <strong className="block text-base font-extrabold text-foreground">{topScorers[2].name}</strong>
                  <span className="text-xs text-muted-foreground block">{topScorers[2].teamName}</span>
                  <div className="font-mono font-black text-2xl text-amber-700 dark:text-amber-500 pt-2 border-t border-border">
                    {topScorers[2].goals} Goals
                  </div>
                </div>
              </div>
            )}

            {/* Complete Scorers Table */}
            <div className="panel-card rounded-3xl p-6 bg-card border border-border space-y-4 shadow-md">
              <h3 className="font-extrabold text-lg text-foreground flex items-center gap-2">
                <Crown size={20} className="text-amber-500" /> Complete Golden Boot Standings
              </h3>

              {topScorers.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-8 text-center">No goals recorded yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {topScorers.map((scorer, i) => (
                    <div key={i} className="interactive-row flex items-center justify-between py-3.5 px-2 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center font-mono font-bold text-xs text-foreground">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <div>
                          <strong className="text-sm font-bold text-foreground">{scorer.name}</strong>
                          <span className="text-xs text-muted-foreground block">{scorer.teamName}</span>
                        </div>
                      </div>
                      <div className="font-mono font-black text-xl text-primary">{scorer.goals} Goals</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: ANNOUNCEMENTS */}
        {activeTab === "announcements" && (
          <div className="cascade-3 space-y-4">
            <h3 className="font-extrabold text-lg text-foreground">Official Tournament Broadcasts</h3>
            {data.announcements.length === 0 ? (
              <div className="panel-card p-8 rounded-3xl text-center text-muted-foreground text-sm italic">
                No official announcements posted yet.
              </div>
            ) : (
              data.announcements.map((a) => (
                <div key={a.id} className="interactive-card panel-card p-5 rounded-3xl bg-card border border-border space-y-2 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-bold text-primary uppercase">{a.audience.replace("_", " ")}</span>
                    <span>{new Date(a.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{a.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Match Detail Modal */}
      {selectedMatchModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal max-w-lg">
            <div className="modal-top">
              <div>
                <span className="eyebrow">Match Center</span>
                <h2>{selectedMatchModal.roundName}</h2>
                <p>
                  Pitch {selectedMatchModal.pitch} • Status: {selectedMatchModal.status.toUpperCase()}
                </p>
              </div>
              <button className="icon-button" onClick={() => setSelectedMatchModal(null)}>
                X
              </button>
            </div>

            <div className="modal-body space-y-6">
              {/* Television Broadcast Scorebug */}
              <BroadcastScorebug
                homeTeamName={data.entries.find((e) => e.id === selectedMatchModal.homeEntryId)?.teamName || "Home Team"}
                awayTeamName={data.entries.find((e) => e.id === selectedMatchModal.awayEntryId)?.teamName || "Away Team"}
                homeScore={selectedMatchModal.homeScore}
                awayScore={selectedMatchModal.awayScore}
                homePenaltyScore={selectedMatchModal.homeScorePenalties}
                awayPenaltyScore={selectedMatchModal.awayScorePenalties}
                matchMinute={selectedMatchModal.matchClockMinute}
                periodText={selectedMatchModal.roundName}
                status={selectedMatchModal.status as "completed" | "in_progress" | "scheduled" | "postponed" | "cancelled"}
                tournamentName={data.tournament.name}
              />

              {/* Match Events Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-foreground">Official Match Events & Timeline</h4>
                {data.events.filter((e) => e.fixtureId === selectedMatchModal.id).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4">No events recorded for this match yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {data.events
                      .filter((e) => e.fixtureId === selectedMatchModal.id)
                      .map((ev) => (
                        <div key={ev.id} className="interactive-row flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border border-border text-xs">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-background text-foreground shrink-0">
                            {ev.matchMinute}&apos;
                          </span>
                          <div>
                            <strong className="text-foreground">{ev.playerName}</strong> ({ev.type.replace("_", " ")})
                            {ev.assistPlayerName && <span className="text-muted-foreground"> • Assist: {ev.assistPlayerName}</span>}
                            {ev.cardReason && <span className="text-muted-foreground"> • {ev.cardReason}</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* WhatsApp Match Scorecard Exporter */}
              <WhatsAppScorecardCard
                tournamentName={data.tournament.name}
                homeTeamName={data.entries.find((e) => e.id === selectedMatchModal.homeEntryId)?.teamName || "Home Team"}
                awayTeamName={data.entries.find((e) => e.id === selectedMatchModal.awayEntryId)?.teamName || "Away Team"}
                homeScore={selectedMatchModal.homeScore}
                awayScore={selectedMatchModal.awayScore}
                homeScorers={data.events
                  .filter((e) => e.fixtureId === selectedMatchModal.id && e.type === "goal" && e.entryId === selectedMatchModal.homeEntryId)
                  .map((e) => `${e.playerName} ${e.matchMinute}'`)}
                awayScorers={data.events
                  .filter((e) => e.fixtureId === selectedMatchModal.id && e.type === "goal" && e.entryId === selectedMatchModal.awayEntryId)
                  .map((e) => `${e.playerName} ${e.matchMinute}'`)}
                dateText={`Pitch ${selectedMatchModal.pitch} • ${selectedMatchModal.roundName}`}
                venueText={data.tournament.venueName}
              />
            </div>

            <div className="modal-actions">
              <button className="button secondary" onClick={() => setSelectedMatchModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
