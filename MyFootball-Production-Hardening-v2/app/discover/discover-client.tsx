"use client";

import {
  CalendarDays,
  Check,
  CircleDot,
  Compass,
  ExternalLink,
  Heart,
  IndianRupee,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ChatGPTUser } from "../chatgpt-auth";
import { BroadcastScorebug } from "../components/broadcast/BroadcastScorebug";
import { AppHeader } from "../components/layout/AppHeader";
import { AppFooter } from "../components/layout/AppFooter";
import { RadarPitchLoader } from "../components/ui/RadarPitchLoader";

export type LiveMatch = {
  fixtureId: string;
  tournamentId: string;
  tournamentName: string;
  tournamentState: string;
  venueName: string;
  divisionId: string;
  divisionName: string;
  roundName: string;
  pitch: number;
  status: string;
  period: string;
  matchClockMinute: number;
  clockStartedAt?: string | null;
  clockRunning?: boolean;
  clockElapsedSeconds?: number;
  stoppageMinutes?: number;
  clockPauseReason?: string | null;
  matchDurationMinutes?: number;
  homeScore: number;
  awayScore: number;
  homeScorePenalties?: number;
  awayScorePenalties?: number;
  homeTeamName: string;
  homeClubName: string;
  awayTeamName: string;
  awayClubName: string;
};

type Division = {
  id: string;
  name: string;
  format: string;
  maxTeams: number;
  feePaise: number;
};

type Tournament = {
  id: string;
  name: string;
  organizedBy: string;
  venueName: string;
  addressLine1: string;
  locality: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  startDate: string;
  durationDays: number;
  status: string;
  teamFormat?: string;
  divisions: Division[];
  registeredTeams: number;
  approvedTeams: number;
  followed: boolean;
  myRegistrations: number;
  nextFixture?: { kickoffAt: string; pitch: number; status: string };
};

const dateLabel = (date?: string | null) => {
  if (!date || typeof date !== "string") return "TBD";
  const raw = date.includes("T") ? date.split("T")[0] : date;
  const parts = raw.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime())
    ? date || "TBD"
    : parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const money = (paise: number) =>
  paise
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(paise / 100)
    : "Free";

const getRegionBadge = (state: string) => {
  switch (state?.toLowerCase()) {
    case "maharashtra":
      return { text: "🦁 Maha Pride", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
    case "punjab":
      return { text: "🐅 Sher-e-Punjab", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30" };
    case "kerala":
      return { text: "🌴 God's Own Football", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    case "goa":
      return { text: "🌊 Mandovi Wave", color: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" };
    case "west bengal":
    case "bengal":
      return { text: "⚽ Joy Bangla", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
    case "karnataka":
      return { text: "🛡️ Deccan Vanguard", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" };
    default:
      return { text: `🇮🇳 ${state || "India"}`, color: "bg-muted text-muted-foreground border-border" };
  }
};

export default function DiscoverClient({
  user,
  role,
  preferredState,
  preferredCity,
}: {
  user: ChatGPTUser | null;
  role: string;
  preferredState: string;
  preferredCity: string;
}) {
  const [items, setItems] = useState<Tournament[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    state: preferredState || "",
    city: preferredCity || "",
    locality: "",
    teamFormat: "",
  });
  const [applied, setApplied] = useState(filters);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(applied).filter(([, value]) => value),
      );
      const response = await fetch(`/api/discover?${query}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.tournaments || []);
      setStates(body.areas?.states || []);
      setCities(body.areas?.cities || []);
      setLiveMatches(body.liveMatches || []);
      setError("");
    } catch (reason) {
      if (!isSilent) {
        setError(
          reason instanceof Error ? reason.message : "Could not load tournaments",
        );
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Background refresh for live match telemetry
  useEffect(() => {
    const pollInterval = window.setInterval(() => {
      void load(true);
    }, 15000);
    return () => window.clearInterval(pollInterval);
  }, [load]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setApplied(filters);
  };

  const follow = async (item: Tournament) => {
    const next = !item.followed;
    setItems((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, followed: next } : row,
      ),
    );
    const response = await fetch("/api/discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tournamentId: item.id, follow: next }),
    });
    if (!response.ok)
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, followed: !next } : row,
        ),
      );
  };

  const clear = () => {
    const next = { search: "", state: "", city: "", locality: "", teamFormat: "" };
    setFilters(next);
    setApplied(next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Unified App Header */}
      <AppHeader activeRoute="discover" user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:px-6 lg:px-8 space-y-8 py-8">
        {/* Unified Hero Showcase Banner */}
        <section className="cascade-1 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 sm:p-10 shadow-2xl border border-slate-700/50">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={13} /> Regional Grassroots Network
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                Discover Verified <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-emerald-400">
                  Indian Matchdays
                </span>
              </h1>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Explore local tournaments across Maharashtra, Punjab, Kerala, Goa, Bengal, Karnataka, and Delhi. Follow live scoreboards, track brackets, and register your club squad.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2 text-xs shrink-0 w-full sm:w-auto">
              <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider block">Your Profile & Area</span>
              <strong className="text-white text-sm font-bold block">{user ? user.displayName : "Guest Spectator"}</strong>
              <p className="text-amber-400 font-medium">
                {preferredCity || "All India"} {preferredState ? `• ${preferredState}` : ""}
              </p>
            </div>
          </div>
        </section>

        {/* Live Matchday Telemetry Section */}
        {liveMatches.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <h2 className="text-sm font-black uppercase tracking-wider text-rose-500 flex items-center gap-2">
                  <span>Live Matchday Telemetry</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono">
                    {liveMatches.length} {liveMatches.length === 1 ? "Match" : "Matches"} in Play
                  </span>
                </h2>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                Real-time Pitch Updates • AIFF Grassroots Feeds
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {liveMatches.map((m) => {
                const region = getRegionBadge(m.tournamentState);
                const periodDisplay =
                  m.period === "first_half"
                    ? "1st Half"
                    : m.period === "second_half"
                      ? "2nd Half"
                      : m.period === "halftime"
                        ? "Half Time"
                        : m.period === "fulltime"
                          ? "Full Time"
                          : m.period || "Live";

                return (
                  <div key={m.fixtureId} className="group relative space-y-2">
                    <BroadcastScorebug
                      tournamentName={`${m.tournamentName} • Pitch ${m.pitch}`}
                      stateBadge={region.text}
                      homeTeamName={m.homeTeamName}
                      awayTeamName={m.awayTeamName}
                      homeScore={m.homeScore}
                      awayScore={m.awayScore}
                      homePenaltyScore={m.homeScorePenalties}
                      awayPenaltyScore={m.awayScorePenalties}
                      matchMinute={m.matchClockMinute}
                      clockStartedAt={m.clockStartedAt}
                      clockRunning={m.clockRunning}
                      clockElapsedSeconds={m.clockElapsedSeconds}
                      stoppageTime={m.stoppageMinutes}
                      clockPauseReason={m.clockPauseReason}
                      matchDurationMinutes={m.matchDurationMinutes}
                      periodText={periodDisplay}
                      status="in_progress"
                    />
                    <Link
                      href={`/tournament/${m.tournamentId}?tab=matches`}
                      className="w-full py-2 px-3 rounded-xl bg-card hover:bg-muted text-amber-500 dark:text-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 transition border border-border shadow-sm"
                    >
                      <Trophy size={13} /> View Match Telemetry & Pitch Radar
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Unified Search & Filters Form */}
        <form onSubmit={submit} className="cascade-2 p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center gap-3 shadow-md">
          <div className="flex-1 min-w-[220px] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/60 border border-border focus-within:border-primary transition">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search tournament name, venue, or city..."
              className="w-full bg-transparent border-none focus:outline-none text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="text-xs font-bold bg-muted/60 px-3.5 py-2 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
          >
            <option value="">All States</option>
            {states.map((st) => (
              <option key={st} value={st} className="bg-popover text-popover-foreground">
                {st}
              </option>
            ))}
          </select>

          <select
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="text-xs font-bold bg-muted/60 px-3.5 py-2 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
          >
            <option value="">All Cities</option>
            {cities.map((ct) => (
              <option key={ct} value={ct} className="bg-popover text-popover-foreground">
                {ct}
              </option>
            ))}
          </select>

          <select
            value={filters.teamFormat}
            onChange={(e) => setFilters({ ...filters, teamFormat: e.target.value })}
            className="text-xs font-bold bg-muted/60 px-3.5 py-2 rounded-xl border border-border focus:outline-none cursor-pointer text-foreground"
          >
            <option value="">All Formats</option>
            <option value="5v5">⚡ 5v5 Turf / Futsal</option>
            <option value="7v7">🌱 7v7 Grassroots</option>
            <option value="11v11">🏆 11v11 Full Pitch</option>
          </select>

          <button
            type="submit"
            className="interactive-button px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:opacity-90 transition"
          >
            Filter Matches
          </button>

          {(applied.search || applied.state || applied.city || applied.teamFormat) && (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted-foreground hover:text-foreground font-semibold px-2"
            >
              Reset Filters
            </button>
          )}
        </form>

        {/* Results Section */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center">
            <RadarPitchLoader
              label="Scanning Verified Indian Matchdays..."
              sublabel="Syncing with AIFF-registered State Football Associations"
              size="lg"
            />
          </div>
        ) : items.length === 0 ? (
          <div className="cascade-3 p-12 rounded-3xl bg-card border border-border text-center space-y-3">
            <Trophy size={36} className="text-muted-foreground mx-auto" />
            <h3 className="font-extrabold text-base text-foreground">No tournaments found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Try adjusting your search criteria or switch to &quot;All States&quot; to see matches across India.
            </p>
            <button onClick={clear} className="button secondary text-xs">
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="cascade-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const regBadge = getRegionBadge(item.state);
              const minFee = item.divisions.length
                ? Math.min(...item.divisions.map((d) => d.feePaise))
                : 0;
              const totalCapacity = item.divisions.reduce((acc, d) => acc + (d.maxTeams || 0), 0);
              const hasCapacity = totalCapacity === 0 || item.registeredTeams < totalCapacity;
              const canRegister = ["registration_open", "live", "scheduled"].includes(item.status) && hasCapacity;

              return (
                <div
                  key={item.id}
                  className="interactive-card rounded-3xl bg-card border border-border hover:border-primary/50 transition overflow-hidden shadow-lg flex flex-col group cursor-pointer"
                >
                  {/* Card Top Banner */}
                  <div className="p-5 bg-gradient-to-br from-muted/60 via-card to-card border-b border-border/80 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                          item.status === "live"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {item.status === "live" && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                        {item.status.replace("_", " ")}
                      </span>

                      <button
                        onClick={() => void follow(item)}
                        className={`p-2 rounded-xl border transition ${
                          item.followed
                            ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                        title={item.followed ? "Unfollow tournament" : "Follow tournament"}
                      >
                        <Heart size={15} fill={item.followed ? "currentColor" : "none"} />
                      </button>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">{item.organizedBy}</span>
                      <h3 className="text-xl font-black text-foreground group-hover:text-primary transition line-clamp-1">
                        {item.name}
                      </h3>
                    </div>

                    {/* Regional Crest & Match Format Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${regBadge.color}`}>
                        {regBadge.text}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${
                          item.teamFormat === "5v5"
                            ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                            : item.teamFormat === "7v7"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {item.teamFormat === "5v5" ? "⚡ 5v5 Turf" : item.teamFormat === "7v7" ? "🌱 7v7 Mini" : "🏆 11v11 Full"}
                      </span>
                      {item.divisions.slice(0, 2).map((div) => (
                        <span key={div.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {div.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2">
                        <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          <strong className="text-foreground">{item.venueName}</strong> • {item.addressLine1}, {item.city}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Kickoff</span>
                          <strong className="text-foreground font-mono">{dateLabel(item.startDate)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Teams</span>
                          <strong className="text-foreground font-mono">{item.registeredTeams} Registered</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">Entry Fee</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{money(minFee)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/80">
                      <Link
                        href={`/tournament/${item.id}`}
                        className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold text-center hover:opacity-90 transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Trophy size={14} /> Open Tournament
                      </Link>
                      {canRegister && role === "coach" && (
                        <Link
                          href={`/register/${item.id}`}
                          className="px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-amber-500 text-slate-950 shadow-sm hover:opacity-95"
                        >
                          <ShieldCheck size={14} />
                          <span>Enroll Squad</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
