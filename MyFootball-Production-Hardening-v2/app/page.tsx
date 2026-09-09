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
import { redirect } from "next/navigation";
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

  // Fast Intercept: Authenticated users are directed to their operational role cockpit.
  // The public marketing & registration page is shown strictly to guests / new unauthenticated users.
  if (user) {
    const role = user.role?.toLowerCase() || "fan";
    switch (role) {
      case "organizer":
        redirect("/organize");
      case "referee":
        redirect("/referee");
      case "coach":
      case "fan":
      default:
        redirect("/discover");
    }
  }

  const db = getDb();

  // Load public metrics and sample tournaments
  const tournamentRows = await db.select().from(tournaments).orderBy(desc(tournaments.startDate)).limit(4);
  const fixtureRows = await db.select().from(fixtures).where(eq(fixtures.status, "in_progress")).limit(2);
  const allClubs = await db.select().from(clubs).limit(8);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Live Match Broadcast Ticker across Indian Stadiums */}
      <div className="bg-gradient-to-r from-amber-600 via-emerald-600 to-slate-900 text-white px-4 py-2 text-xs font-bold overflow-x-auto whitespace-nowrap flex items-center justify-between gap-6 border-b border-amber-500/30 shadow-md">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 bg-rose-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE IST
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card border border-border text-amber-600 dark:text-amber-400 text-xs font-black uppercase tracking-wider shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            🇮🇳 The Digital Operating System for Indian Football
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-none">
            From the Maidan to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500">Grand Final</span>
          </h1>

          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Empowering tournament directors, grassroots academies, pitch-side referees, and passionate football fans with live match scoreboards, 2D tactical lineups, knockout brackets, and instant UPI team registrations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/discover"
              className="min-h-[48px] px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/20 active:scale-[0.975] transition-transform duration-100 ease-out focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center gap-2"
            >
              <Compass size={18} /> Discover Tournaments Near You
            </Link>
            <Link
              href="/organize"
              className="min-h-[48px] px-6 py-3.5 rounded-2xl bg-card hover:bg-surface-hover text-foreground border border-border font-extrabold text-sm active:scale-[0.975] transition-transform duration-100 ease-out focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center gap-2 shadow-sm"
            >
              <Trophy size={18} className="text-amber-500 dark:text-amber-400" /> Host a Tournament
            </Link>
          </div>
        </div>

        {/* Real-time Grassroots Football Metrics in India */}
        <div className="cascade-2 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-border">
          <div className="interactive-card p-4 rounded-2xl bg-card border border-border text-center space-y-1 shadow-sm">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-amber-500 dark:text-amber-400">28+</strong>
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indian States</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-card border border-border text-center space-y-1 shadow-sm">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-emerald-500 dark:text-emerald-400">450+</strong>
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academies & Clubs</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-card border border-border text-center space-y-1 shadow-sm">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-blue-500 dark:text-blue-400">100%</strong>
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">AIFF-Standard Honors</span>
          </div>
          <div className="interactive-card p-4 rounded-2xl bg-card border border-border text-center space-y-1 shadow-sm">
            <strong className="font-mono font-black text-2xl sm:text-3xl text-purple-500 dark:text-purple-400">₹0 Fee</strong>
            <span className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instant UPI Ledger</span>
          </div>
        </div>

        {/* 4 Dedicated Operational Gateway Doors */}
        <div className="cascade-3 space-y-4 pt-8">
          <div className="text-center space-y-1">
            <span className="text-xs uppercase font-bold text-amber-600 dark:text-amber-400 tracking-widest">Multi-Role Architecture</span>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">Choose Your Operational Gateway</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Door 1: Organizer Hub */}
            <Link
              href="/organize"
              className="interactive-card p-6 rounded-3xl bg-card border border-border hover:border-amber-500/50 transition group space-y-4 shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <Trophy size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">Tournament Director</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Design cup divisions, generate round-robin groups, automated knockout bracket trees, and publish live standings.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 pt-2">
                Launch Workspace <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 2: Coach Portal */}
            <Link
              href="/coach"
              className="interactive-card p-6 rounded-3xl bg-card border border-border hover:border-emerald-500/50 transition group space-y-4 shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">Coach & Academy Hub</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Manage club player pools with DOB age-cutoff verification, Starting XI on 2D tactical pitch boards, and fixtures.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-2">
                Open Squad Manager <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 3: Referee Console */}
            <Link
              href="/referee"
              className="interactive-card p-6 rounded-3xl bg-card border border-border hover:border-blue-500/50 transition group space-y-4 shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">Pitch Referee Mode</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Mobile-first pitch stopwatch, rapid one-tap goal/assist/card logger, sudden death penalty shootouts, and match sheets.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 pt-2">
                Open Referee Console <ArrowRight size={13} />
              </span>
            </Link>

            {/* Door 4: Fan & Scout Discovery */}
            <Link
              href="/discover"
              className="interactive-card p-6 rounded-3xl bg-card border border-border hover:border-purple-500/50 transition group space-y-4 shadow-sm hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                <Compass size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">Fan & Scout Hub</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Live scores, group standings, 2D tactical lineups, Golden Boot podiums, and state-by-state tournament discovery.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 pt-2">
                Explore Matches <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </div>

        {/* Featured Live Tournament Spotlight */}
        {tournamentRows.length > 0 ? (
          <div className="cascade-4 space-y-4 pt-10">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-widest">Active Competitions</span>
                <h2 className="text-2xl sm:text-3xl font-black text-foreground">Featured Indian Tournaments</h2>
              </div>
              <Link href="/discover" className="interactive-button text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1">
                View All <ArrowRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {tournamentRows.map((t) => (
                <div
                  key={t.id}
                  className="interactive-card p-6 rounded-3xl bg-card border border-border hover:border-border/80 transition space-y-4 shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
                      {t.status.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      Starts: {new Date(`${t.startDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-foreground">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Organized by <strong className="text-foreground">{t.organizedBy}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
                    <span className="truncate">{t.venueName} • {t.city}, {t.state}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-border gap-2">
                    <Link
                      href={`/tournament/${t.id}`}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 active:scale-[0.975] transition-transform duration-100 ease-out flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Trophy size={14} /> Open Tournament Hub
                    </Link>
                    {t.status === "registration_open" && (
                      <Link
                        href={`/register/${t.id}`}
                        className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground active:scale-[0.975] transition-transform duration-100 ease-out flex items-center"
                      >
                        Register Team →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="cascade-4 space-y-4 pt-10">
            <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-3 shadow-sm max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold mx-auto">
                <Trophy size={24} />
              </div>
              <h3 className="text-lg font-black text-foreground">No Tournaments Currently Published</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Be the first to bring modern digital tournament administration to your region. Setup brackets, entry forms, and live scoreboards in minutes.
              </p>
              <div className="pt-2">
                <Link
                  href="/organize"
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs active:scale-[0.975] transition-transform"
                >
                  <Trophy size={14} /> Host Your First Tournament
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Grassroots Indian Academies Network */}
        <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4 shadow-sm">
          <span className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Connected Indian Academies & Clubs</span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-foreground font-bold text-sm">
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
