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
import { AppHeader } from "../components/layout/AppHeader";
import { AppFooter } from "../components/layout/AppFooter";
import { RadarPitchLoader } from "../components/ui/RadarPitchLoader";

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
  divisions: Division[];
  registeredTeams: number;
  approvedTeams: number;
  followed: boolean;
  myRegistrations: number;
  nextFixture?: { kickoffAt: string; pitch: number; status: string };
};

const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

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
  user: ChatGPTUser;
  role: string;
  preferredState: string;
  preferredCity: string;
}) {
  const [items, setItems] = useState<Tournament[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    state: preferredState || "",
    city: preferredCity || "",
    locality: "",
  });
  const [applied, setApplied] = useState(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(applied).filter(([, value]) => value),
      );
      const response = await fetch(`/api/discover?${query}`, {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems(body.tournaments);
      setStates(body.areas.states);
      setCities(body.areas.cities);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load tournaments",
      );
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    queueMicrotask(() => void load());
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
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tournamentId: item.id, follow: next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not update this follow.");
      setError("");
    } catch (reason) {
      setItems((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, followed: !next } : row,
        ),
      );
      setError(reason instanceof Error ? reason.message : "Could not update this follow.");
    }
  };

  const clear = () => {
    const next = { search: "", state: "", city: "", locality: "" };
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
              <strong className="text-white text-sm font-bold block">{user.displayName}</strong>
              <p className="text-amber-400 font-medium">
                {preferredCity || "All India"} {preferredState ? `• ${preferredState}` : ""}
              </p>
            </div>
          </div>
        </section>

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

          <button
            type="submit"
            className="interactive-button px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:opacity-90 transition"
          >
            Filter Matches
          </button>

          {(applied.search || applied.state || applied.city) && (
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

              return (
                <div
                  key={item.id}
                  className="interactive-card rounded-3xl bg-card border border-border hover:border-primary/50 transition overflow-hidden shadow-lg flex flex-col group"
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

                    {/* Regional Crest Badge */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${regBadge.color}`}>
                        {regBadge.text}
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
                      {item.status === "registration_open" && (
                        <Link
                          href={`/register/${item.id}`}
                          className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition"
                        >
                          Register Team
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
