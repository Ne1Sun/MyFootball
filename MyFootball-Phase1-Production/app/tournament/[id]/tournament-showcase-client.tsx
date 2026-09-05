"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [matchFilter, setMatchFilter] = useState<"all" | "group" | "knockout">("all");
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(data.isFollowed);
  const [busyFollow, setBusyFollow] = useState(false);
  const [followError, setFollowError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
  const [clockNow, setClockNow] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const refreshLiveData = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/public/tournaments/${initialData.tournament.id}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const next = (await response.json()) as PublicTournamentData;
        if (cancelled) return;
        setData(next);
        setSelectedMatchModal((current) =>
          current ? next.fixtures.find((fixture) => fixture.id === current.id) || null : null,
        );
        setLastSyncedAt(Date.now());
      } catch {
        // Keep the last verified public snapshot and retry on the next interval.
      }
    };
    const interval = window.setInterval(() => void refreshLiveData(), 8_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLiveData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initialData.tournament.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const liveMinute = (fixture: Fixture) => {
    const startedAt = fixture.clockStartedAt ? new Date(fixture.clockStartedAt).getTime() : Number.NaN;
    const elapsed = fixture.clockRunning && Number.isFinite(startedAt)
      ? Math.max(0, Math.floor((clockNow - startedAt) / 60_000))
      : 0;
    return Math.min(200, fixture.matchClockMinute + elapsed);
  };

  const tournament = data.tournament;
  const division = data.divisions.find((d) => d.id === selectedDivisionId) || data.divisions[0];

  const divisionFixtures = useMemo(() => {
    if (!division) return [];
    return data.fixtures.filter((f) => f.divisionId === division.id);
  }, [data.fixtures, division]);

  const liveFixtures = useMemo(() => {
    return divisionFixtures.filter((f) => f.status === "in_progress");
  }, [divisionFixtures]);

  const matchDays = useMemo(() => {
    const visible = divisionFixtures
      .filter((fixture) => {
        if (matchFilter === "all") return true;
        const stage = fixture.stage === "knockout" || fixture.bracketRound ? "knockout" : "group";
        return stage === matchFilter;
      })
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

    const days = new Map<string, Fixture[]>();
    visible.forEach((fixture) => {
      const parsed = new Date(fixture.kickoffAt);
      const key = Number.isFinite(parsed.getTime())
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(parsed)
        : fixture.kickoffAt.slice(0, 10);
      days.set(key, [...(days.get(key) || []), fixture]);
    });
    return [...days.entries()].map(([date, fixturesForDate]) => ({ date, fixtures: fixturesForDate }));
  }, [divisionFixtures, matchFilter]);

  const formatMeta = useMemo(() => {
    const format = division?.format || "group_knockout";
    if (format === "round_robin") {
      return {
        label: "League format",
        description: "Every league round is listed chronologically with the live table available beside the results.",
      };
    }
    if (format === "knockout") {
      return {
        label: "Cup format",
        description: "Every elimination round is grouped by matchday, from the opening ties through the final.",
      };
    }
    return {
      label: "League + Cup format",
      description: "Follow the group-stage league first, then switch directly to the knockout path.",
    };
  }, [division?.format]);

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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not update this follow.");
      setFollowing(!following);
      setFollowError("");
    } catch (reason) {
      setFollowError(reason instanceof Error ? reason.message : "Could not update this follow.");
    } finally {
      setBusyFollow(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        window.prompt("Copy this tournament link", window.location.href);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Closing the native share sheet is intentional and needs no error banner.
    }
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

  // Every knockout round, from a straight final through a 128-team bracket.
  const publicBracketStages = useMemo(() => {
    const knockoutFixtures = divisionFixtures.filter((fixture) => fixture.stage === "knockout" || fixture.bracketRound);
    const order = ["round_of_128", "round_of_64", "round_of_32", "round_of_16", "quarter_final", "semi_final", "championship"];
    const labels: Record<string, string> = {
      round_of_128: "Round of 128",
      round_of_64: "Round of 64",
      round_of_32: "Round of 32",
      round_of_16: "Round of 16",
      quarter_final: "Quarter-Finals",
      semi_final: "Semi-Finals",
      championship: "Finals",
    };
    const grouped = new Map<string, typeof knockoutFixtures>();
    for (const fixture of knockoutFixtures) {
      const key = fixture.bracketRound === "final" || fixture.bracketRound === "third_place"
        ? "championship"
        : fixture.bracketRound || fixture.roundName || "knockout";
      grouped.set(key, [...(grouped.get(key) || []), fixture]);
    }
    return [...grouped.entries()]
      .map(([key, matches]) => ({
        key,
        label: labels[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        matches: matches.sort((a, b) => (a.bracketMatchIndex || 0) - (b.bracketMatchIndex || 0)),
      }))
      .sort((a, b) => {
        const left = order.indexOf(a.key);
        const right = order.indexOf(b.key);
        return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
      });
  }, [divisionFixtures]);

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
                <span className="text-[11px] text-emerald-300 font-semibold hidden md:inline" title={new Date(lastSyncedAt).toLocaleTimeString()}>
                  Live sync · 8s
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="interactive-button inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-700 bg-slate-800/90 text-slate-300 hover:bg-slate-700 transition"
                >
                  {copied ? <Check size={14} /> : <Share2 size={14} />}
                  <span>{copied ? "Shared" : "Share"}</span>
                </button>
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

            {followError && (
              <p className="text-xs font-semibold text-rose-300" role="alert">{followError}</p>
            )}

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
              onChange={(e) => {
                const nextDivisionId = e.target.value;
                setSelectedDivisionId(nextDivisionId);
                setSelectedTeamLineupId(data.entries.find((entry) => entry.divisionId === nextDivisionId)?.id || "");
                setMatchFilter("all");
                setActiveTab("matches");
              }}
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
              <Swords size={14} /> Fixtures & Results
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
            {division?.format !== "round_robin" && (
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
            )}
            {division?.format !== "knockout" && (
              <button
                onClick={() => setActiveTab("standings")}
                className={`interactive-button px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "standings"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 size={14} /> {division?.format === "round_robin" ? "League Table" : "Group Tables"}
              </button>
            )}
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

        {/* TAB 1: FORMAT-AWARE FIXTURES & RESULTS */}
        {activeTab === "matches" && (
          <div className="cascade-3 space-y-5">
            <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
              <div className="border-b border-border bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-5 text-white sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Match Centre</span>
                    <h3 className="text-xl font-black sm:text-2xl">{formatMeta.label}</h3>
                    <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">{formatMeta.description}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <strong className="block font-mono text-lg">{divisionFixtures.length}</strong>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">Matches</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <strong className="block font-mono text-lg text-rose-400">{liveFixtures.length}</strong>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">Live</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <strong className="block font-mono text-lg text-emerald-400">
                        {divisionFixtures.filter((fixture) => fixture.status === "completed").length}
                      </strong>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400">Played</span>
                    </div>
                  </div>
                </div>

                {division?.format === "group_knockout" && (
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4" aria-label="Match stage filter">
                    {([
                      ["all", "All matches"],
                      ["group", "League / groups"],
                      ["knockout", "Cup / knockouts"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMatchFilter(value)}
                        className={`rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                          matchFilter === value
                            ? "bg-amber-500 text-slate-950 shadow-md"
                            : "border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {matchDays.length === 0 ? (
                <div className="p-10 text-center">
                  <Calendar size={34} className="mx-auto mb-3 text-muted-foreground" />
                  <h4 className="font-extrabold text-foreground">No matches in this section yet</h4>
                  <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                    The organizer has not published this part of the schedule. It will appear here automatically once generated.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {matchDays.map((day) => {
                    const dayDate = new Date(day.fixtures[0]?.kickoffAt || day.date);
                    const dayLabel = Number.isFinite(dayDate.getTime())
                      ? dayDate.toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })
                      : day.date;
                    return (
                      <div key={day.date}>
                        <div className="flex items-center justify-between bg-muted/45 px-4 py-2.5 sm:px-6">
                          <h4 className="text-xs font-extrabold text-foreground">{dayLabel}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {day.fixtures.length} {day.fixtures.length === 1 ? "match" : "matches"}
                          </span>
                        </div>
                        <div className="divide-y divide-border/70">
                          {day.fixtures.map((fixture) => {
                            const home = data.entries.find((entry) => entry.id === fixture.homeEntryId);
                            const away = data.entries.find((entry) => entry.id === fixture.awayEntryId);
                            const isLive = fixture.status === "in_progress";
                            const hasScore = fixture.status === "completed" || isLive;
                            const hasPenalties = fixture.homeScorePenalties > 0 || fixture.awayScorePenalties > 0;
                            const kickoff = new Date(fixture.kickoffAt);
                            const stageLabel = fixture.stage === "knockout" || fixture.bracketRound
                              ? (fixture.bracketRound || fixture.roundName).replaceAll("_", " ")
                              : fixture.roundName;
                            return (
                              <button
                                key={fixture.id}
                                type="button"
                                onClick={() => setSelectedMatchModal(fixture)}
                                className={`group grid w-full grid-cols-[64px_minmax(0,1fr)_auto_20px] items-center gap-3 px-4 py-4 text-left transition sm:grid-cols-[96px_minmax(0,1fr)_120px_24px] sm:px-6 ${
                                  isLive ? "bg-rose-500/[0.06] hover:bg-rose-500/[0.1]" : "hover:bg-muted/45"
                                }`}
                              >
                                <div className="text-center">
                                  {isLive ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-[10px] font-black text-rose-500">
                                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" /> LIVE {liveMinute(fixture)}&apos;
                                    </span>
                                  ) : fixture.status === "completed" ? (
                                    <span className="text-[10px] font-black uppercase text-muted-foreground">Full time</span>
                                  ) : (
                                    <span className="font-mono text-xs font-black text-foreground">
                                      {Number.isFinite(kickoff.getTime())
                                        ? kickoff.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
                                        : "TBC"}
                                    </span>
                                  )}
                                  <span className="mt-1 block text-[9px] font-semibold text-muted-foreground">Pitch {fixture.pitch}</span>
                                </div>

                                <div className="min-w-0 space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm font-bold text-foreground">{home?.teamName || "TBD"}</span>
                                    <span className="font-mono text-base font-black text-foreground">{hasScore ? fixture.homeScore : ""}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="truncate text-sm font-bold text-foreground">{away?.teamName || "TBD"}</span>
                                    <span className="font-mono text-base font-black text-foreground">{hasScore ? fixture.awayScore : ""}</span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className={`inline-flex rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                                    fixture.stage === "knockout" || fixture.bracketRound
                                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                      : "bg-primary/10 text-primary"
                                  }`}>
                                    {stageLabel}
                                  </span>
                                  {hasPenalties && (
                                    <span className="mt-1.5 block text-[10px] font-bold text-muted-foreground">
                                      Pens {fixture.homeScorePenalties}–{fixture.awayScorePenalties}
                                    </span>
                                  )}
                                  {fixture.potmPlayerName && (
                                    <span className="mt-1.5 hidden text-[10px] font-semibold text-amber-500 sm:block">
                                      POTM {fixture.potmPlayerName}
                                    </span>
                                  )}
                                </div>
                                <ChevronRight size={17} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
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
            {!divisionFixtures.some((fixture) => fixture.stage === "knockout" || fixture.bracketRound) ? (
              <div className="panel-card p-10 rounded-3xl bg-card border border-border text-center shadow-md">
                <Trophy size={36} className="mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-extrabold text-foreground">Knockout bracket not published yet</h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                  Once the organizer generates the cup stage, every tie and progression path will appear here.
                </p>
              </div>
            ) : (
            <div className="panel-card p-5 rounded-3xl bg-card border border-border overflow-x-auto shadow-lg">
              <div className="flex min-w-max items-start gap-6">
                {publicBracketStages.map((stage, stageIndex) => (
                  <div key={stage.key} className="flex items-center gap-6">
                    <section className="w-[280px] space-y-3">
                      <div className={`sticky top-0 z-10 rounded-xl border px-3 py-2 text-center text-xs font-black uppercase tracking-widest ${stage.key === "championship" ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-border bg-background/95 text-muted-foreground"}`}>
                        {stage.label}
                      </div>
                      {stage.matches.map((match, matchIndex) => {
                        const home = data.entries.find((entry) => entry.id === match.homeEntryId);
                        const away = data.entries.find((entry) => entry.id === match.awayEntryId);
                        const isFinal = match.bracketRound === "final";
                        const isThird = match.bracketRound === "third_place";
                        return (
                          <button
                            type="button"
                            key={match.id}
                            onClick={() => setSelectedMatchModal(match)}
                            className={`interactive-card block w-full rounded-xl border p-3.5 text-left space-y-2 ${isFinal ? "border-amber-500/50 bg-amber-500/10" : "border-border bg-muted/40 hover:bg-muted/70"}`}
                          >
                            <span className={`text-[10px] font-black uppercase ${isFinal ? "text-amber-500" : "text-muted-foreground"}`}>
                              {isFinal ? "🏆 Grand Final" : isThird ? "🥉 3rd Place Playoff" : match.roundName || `${stage.label} ${matchIndex + 1}`}
                            </span>
                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-foreground">
                              <span className="truncate">{home?.teamName || "TBD"}</span>
                              <span className="font-mono">{match.status === "completed" ? match.homeScore : "–"}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-foreground">
                              <span className="truncate">{away?.teamName || "TBD"}</span>
                              <span className="font-mono">{match.status === "completed" ? match.awayScore : "–"}</span>
                            </div>
                          </button>
                        );
                      })}
                    </section>
                    {stageIndex < publicBracketStages.length - 1 && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            )}
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
                matchMinute={liveMinute(selectedMatchModal)}
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
