import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  Compass,
  Crown,
  ExternalLink,
  Flame,
  Globe,
  Heart,
  MapPin,
  Play,
  Plus,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import ProfileSetup from "./profile-setup";
import { getDb } from "../db";
import { clubs, divisions, entries, fixtures, matchEvents, tournaments, users } from "../db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import ThemeToggle from "./theme-toggle";
import { AppHeader } from "./components/layout/AppHeader";
import { AppFooter } from "./components/layout/AppFooter";

export const dynamic = "force-dynamic";

function AppLogo() {
  return (
    <div className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight text-white">
      <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg">
        <CircleDot size={20} strokeWidth={2.5} />
      </span>
      <span>
        my<span className="text-amber-400">football</span> <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">Bharat</span>
      </span>
    </div>
  );
}

export default async function Home() {
  const user = await getChatGPTUser();
  const db = getDb();

  // Load public metrics and sample tournaments
  const tournamentRows = await db.select().from(tournaments).orderBy(desc(tournaments.startDate)).limit(4);
  const fixtureRows = await db.select().from(fixtures).where(eq(fixtures.status, "in_progress")).limit(2);
  const allClubs = await db.select().from(clubs).limit(8);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Live Match Broadcast Ticker across Indian Stadiums */}
      <div className="bg-gradient-to-r from-amber-600 via-emerald-600 to-slate-900 text-white px-4 py-2 text-xs font-bold overflow-x-auto whitespace-nowrap flex items-center justify-between gap-6 border-b border-amber-500/30 shadow-md">
        <div className="flex items-center gap-6 animate-pulse">
          <span className="flex items-center gap-1.5 bg-rose-600 text-white px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" /> LIVE IST
          </span>
          <span>⚽ Mumbai Super Cup: <strong>RFYC U17 1 - 0 Minerva Punjab</strong> (36&apos;)</span>
          <span className="text-amber-200">•</span>
          <span>🏆 Kolkata Maidan Youth: <strong>East Bengal U19 vs Mohun Bagan U19</strong> (16:30 IST)</span>
          <span className="text-amber-200">•</span>
          <span>🌴 Kerala Santosh Trophy Cup: <strong>Gokulam Kerala vs Malabar FC</strong> (18:00 IST)</span>
          <span className="text-amber-200">•</span>
          <span>🌊 Goa Mandovi League: <strong>Dempo SC Juniors vs Churchill Brothers</strong> (19:30 IST)</span>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-amber-200 shrink-0">
          <Sparkles size={13} />
          <span>Real-time Tournament Operations</span>
        </div>
      </div>

      {/* Unified App Header */}
      <AppHeader activeRoute="home" user={user} />

      {/* Hero Section: Modern Bharat Sports Tech */}
      <section className="relative overflow-hidden pt-12 pb-20 px-4 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="cascade-1 text-center space-y-6 max-w-3xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-black uppercase tracking-wider shadow-inner">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            🇮🇳 The Digital Operating System for Indian Football
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-none">
            From the Maidan to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400">Grand Final</span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Empowering tournament directors, grassroots academies, pitch-side referees, and passionate football fans with live match scoreboards, 2D tactical lineups, knockout brackets, and instant UPI team registrations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/discover"
              className="interactive-button px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/20 hover:scale-105 transition flex items-center gap-2"
            >
              <Compass size={18} /> Discover Tournaments Near You
            </Link>
            <Link
              href="/organize"
              className="interactive-button px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-extrabold text-sm transition flex items-center gap-2"
            >
              <Trophy size={18} className="text-amber-400" /> Host a Tournament
            </Link>
          </div>
        </div>

        {/* Real-time Grassroots Football Metrics in India */}
        <div className="cascade-2 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800">
          <div className="interactive-card p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-1">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-amber-400">28+</strong>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Indian States</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-1">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-emerald-400">450+</strong>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Academies & Clubs</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-1">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-blue-400">100%</strong>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">AIFF-Standard Honors</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-1">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-purple-400">₹0 Fee</strong>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Instant UPI Ledger</span>
          </div>
        </div>

        {/* 4 Dedicated Operational Gateway Doors */}
        <div className="cascade-3 space-y-4 pt-8">
          <div className="text-center space-y-1">
            <span className="text-xs uppercase font-bold text-amber-500 tracking-widest">Multi-Role Architecture</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Choose Your Operational Gateway</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Door 1: Organizer Hub */}
            <Link
              href="/organize"
              className="interactive-card p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/50 transition group space-y-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Trophy size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition">Tournament Director</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Design cup divisions, generate round-robin groups, automated knockout bracket trees, and publish live standings.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 pt-2">
                Launch Workspace <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 2: Coach Portal */}
            <Link
              href="/coach"
              className="interactive-card p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-emerald-500/50 transition group space-y-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition">Coach & Academy Hub</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Manage club player pools with DOB age-cutoff verification, Starting XI on 2D tactical pitch boards, and fixtures.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 pt-2">
                Open Squad Manager <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 3: Referee Console */}
            <Link
              href="/referee"
              className="interactive-card p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-blue-500/50 transition group space-y-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-blue-400 transition">Pitch Referee Mode</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Mobile-first pitch stopwatch, rapid one-tap goal/assist/card logger, sudden death penalty shootouts, and match sheets.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-400 pt-2">
                Open Referee Console <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 4: Fan & Scout Discovery */}
            <Link
              href="/discover"
              className="interactive-card p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-purple-500/50 transition group space-y-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition">Fan & Scout Hub</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Live scores, group standings, 2D tactical lineups, Golden Boot podiums, and state-by-state tournament discovery.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 pt-2">
                Explore Matches <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </div>

        {/* Featured Live Tournament Spotlight */}
        {tournamentRows.length > 0 && (
          <div className="cascade-4 space-y-4 pt-10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-widest">Active Competitions</span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Featured Indian Tournaments</h2>
              </div>
              <Link href="/discover" className="interactive-button text-xs font-bold text-amber-400 hover:underline flex items-center gap-1">
                View All <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tournamentRows.map((t) => (
                <div
                  key={t.id}
                  className="interactive-card p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
                      {t.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Starts: {new Date(`${t.startDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">{t.name}</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Organized by <strong className="text-white">{t.organizedBy}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={15} className="text-amber-400 shrink-0" />
                    <span className="truncate">{t.venueName} • {t.city}, {t.state}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <Link
                      href={`/tournament/${t.id}`}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition flex items-center gap-1.5"
                    >
                      <Trophy size={14} /> Open Tournament Hub
                    </Link>
                    {t.status === "registration_open" && (
                      <Link
                        href={`/register/${t.id}`}
                        className="text-xs font-bold text-slate-300 hover:text-white"
                      >
                        Register Team →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grassroots Indian Academies Network */}
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
          <span className="text-xs uppercase font-bold text-slate-400 tracking-widest">Connected Indian Academies & Clubs</span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-slate-300 font-bold text-sm">
            <span>Reliance Foundation Young Champs</span>
            <span>Minerva Punjab Academy</span>
            <span>Dempo SC Juniors</span>
            <span>Bengaluru FC Academy</span>
            <span>East Bengal FC Youth</span>
            <span>Gokulam Kerala FC</span>
          </div>
        </div>
      </section>

      {/* Unified App Footer */}
      <AppFooter />
    </div>
  );
}
