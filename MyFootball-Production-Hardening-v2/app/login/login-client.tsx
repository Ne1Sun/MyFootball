"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  Compass,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Shield,
  Sparkles,
  Trophy,
  User,
  UserPlus,
} from "lucide-react";
import type { ChatGPTUser } from "../chatgpt-auth";
import ThemeToggle from "../theme-toggle";

interface LoginClientProps {
  currentUser: ChatGPTUser | null;
  returnTo: string;
}

type RoleType = "organizer" | "coach" | "referee" | "fan";

interface PersonaCard {
  id: string;
  role: RoleType;
  title: string;
  badge: string;
  name: string;
  email: string;
  icon: typeof Trophy;
  targetPath: string;
  description: string;
  features: string[];
  gradient: string;
  badgeColor: string;
}

const DEMO_PERSONAS: PersonaCard[] = [
  {
    id: "organizer",
    role: "organizer",
    title: "Tournament Director",
    badge: "Director RBAC",
    name: "Vikramaditya Singhania",
    email: "organizer@myfootball.in",
    icon: Trophy,
    targetPath: "/organize",
    description: "Owns Mumbai Super Cup 2026. Manage 8 teams, draw knockout brackets, verify entry fees.",
    features: ["Mumbai Super Cup 2026", "Knockout Bracket Engine", "Digital UPI Receipt Verification"],
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/30 hover:border-amber-500",
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  {
    id: "coach",
    role: "coach",
    title: "Academy Head Coach",
    badge: "Tactics & Squad",
    name: "Coach Subrata Paul",
    email: "coach@myfootball.in",
    icon: Shield,
    targetPath: "/coach",
    description: "Owns Reliance Foundation Young Champs (RFYC). Manage 18 players and set 4-3-3 tactical lineups.",
    features: ["RFYC U-17 Academy", "Interactive Pitch Formation", "Matchday Lineup Sheets"],
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30 hover:border-emerald-500",
    badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    id: "referee",
    role: "referee",
    title: "Match Official / Referee",
    badge: "Pitch-Side Whistle",
    name: "Michael Murmu (AIFF)",
    email: "referee@myfootball.in",
    icon: Clock,
    targetPath: "/referee",
    description: "AIFF Certified Referee. Live match clock, goals, IFAB Law 3 substitution windows, and shootouts.",
    features: ["Pitch-Side Live Clock", "IFAB Law 3 Sub Limits", "Penalty Shootout Taker Ledger"],
    gradient: "from-cyan-500/20 via-cyan-500/5 to-transparent border-cyan-500/30 hover:border-cyan-500",
    badgeColor: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
  {
    id: "fan",
    role: "fan",
    title: "Spectator & Club Follower",
    badge: "Live Telemetry",
    name: "Aarav Sharma",
    email: "fan@myfootball.in",
    icon: Compass,
    targetPath: "/discover",
    description: "Follow grassroots tournaments across India, view live scoreboards, and export WhatsApp cards.",
    features: ["Discover Grassroots Cups", "Live Tournament Telemetry", "1080x1350 WhatsApp Match Cards"],
    gradient: "from-purple-500/20 via-purple-500/5 to-transparent border-purple-500/30 hover:border-purple-500",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
];

export default function LoginClient({ currentUser, returnTo }: LoginClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"fast-track" | "register" | "custom-login">("fast-track");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Registration form state
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<RoleType>("coach");
  const [regCity, setRegCity] = useState("Mumbai");
  const [regState, setRegState] = useState("Maharashtra");
  const [regClubName, setRegClubName] = useState("");

  // Custom login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("Grassroots@2026");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginRole, setLoginRole] = useState<RoleType>("coach");

  const handle1ClickLogin = async (persona: PersonaCard) => {
    setLoadingAction(persona.id);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: persona.email,
          password: "Grassroots@2026",
          role: persona.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Fallback to signin-with-chatgpt redirect
        const target = returnTo || persona.targetPath;
        window.location.href = `/signin-with-chatgpt?email=${encodeURIComponent(
          persona.email
        )}&role=${encodeURIComponent(persona.role)}&name=${encodeURIComponent(
          persona.name
        )}&return_to=${encodeURIComponent(target)}`;
        return;
      }
      const target = returnTo || data.redirectUrl || persona.targetPath;
      window.location.href = target;
    } catch {
      const target = returnTo || persona.targetPath;
      window.location.href = `/signin-with-chatgpt?email=${encodeURIComponent(
        persona.email
      )}&role=${encodeURIComponent(persona.role)}&name=${encodeURIComponent(
        persona.name
      )}&return_to=${encodeURIComponent(target)}`;
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!loginPassword) {
      setErrorMessage("Please enter your account password.");
      return;
    }

    setLoadingAction("custom-login");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
          role: loginRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || "Invalid credentials or password.");
        setLoadingAction(null);
        return;
      }

      setSuccessMessage(`Signed in successfully as ${loginRole.toUpperCase()}! Redirecting...`);
      const target = returnTo || data.redirectUrl;
      setTimeout(() => {
        window.location.href = target;
      }, 400);
    } catch {
      setErrorMessage("Network error during sign in. Please verify your connection.");
      setLoadingAction(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regFullName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setLoadingAction("register");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          email: regEmail.trim().toLowerCase(),
          password: regPassword,
          role: regRole,
          preferredCity: regCity.trim(),
          preferredState: regState.trim(),
          clubName: regClubName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || "Failed to create account.");
        setLoadingAction(null);
        return;
      }

      setSuccessMessage("Account created successfully with password protection! Entering your football hub...");
      const target = returnTo || data.redirectUrl;
      setTimeout(() => {
        window.location.href = target;
      }, 500);
    } catch {
      setErrorMessage("Network error during registration. Please check your connection.");
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-black text-lg tracking-tight group">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <CircleDot size={18} strokeWidth={2.6} />
            </span>
            <span>
              my<span className="text-amber-500 dark:text-amber-400">football</span>
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-widest">
              Bharat 🇮🇳
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-muted transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full">
        {/* Header Hero */}
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
            <Sparkles size={13} />
            <span>Multi-Role Football Operations & Password Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Sign In & Manage Your Role
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Select your active football role for this session. Your role determines your dashboard, permissions, and operational workspace with zero data clashing.
          </p>

          {currentUser && (
            <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2 text-left">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>
                  Currently active as <strong>{currentUser.displayName}</strong> • Active Role:{" "}
                  <span className="uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                    {currentUser.role}
                  </span>
                </span>
              </div>
              <a
                href="/signout-with-chatgpt?return_to=/login"
                className="font-bold underline hover:opacity-80 flex items-center gap-1 shrink-0 ml-3"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </a>
            </div>
          )}
        </div>

        {/* Global Alert Messages */}
        {errorMessage && (
          <div className="max-w-xl mx-auto mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="max-w-xl mx-auto mb-6 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-2xl bg-muted/70 border border-border">
            <button
              onClick={() => { setActiveTab("fast-track"); setErrorMessage(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "fast-track"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>1-Click Test Accounts</span>
            </button>
            <button
              onClick={() => { setActiveTab("custom-login"); setErrorMessage(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "custom-login"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn size={14} className="text-cyan-500" />
              <span>Account Sign In</span>
            </button>
            <button
              onClick={() => { setActiveTab("register"); setErrorMessage(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "register"
                  ? "bg-background text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus size={14} className="text-emerald-500" />
              <span>Register New Account</span>
            </button>
          </div>
        </div>

        {/* TAB 1: 1-Click Fast-Track Personas */}
        {activeTab === "fast-track" && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-muted/50 border border-border text-center max-w-xl mx-auto text-xs text-muted-foreground">
              ⚡ <strong>Instant Testing:</strong> Pre-seeded with PBKDF2 hashed credentials. Master Test Password:{" "}
              <code className="px-2 py-0.5 rounded bg-background border font-mono font-bold text-foreground">Grassroots@2026</code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {DEMO_PERSONAS.map((persona) => {
                const Icon = persona.icon;
                const isLoading = loadingAction === persona.id;
                return (
                  <div
                    key={persona.id}
                    className={`p-6 rounded-3xl bg-card border shadow-sm hover:shadow-lg transition-all flex flex-col justify-between ${persona.gradient}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${persona.badgeColor}`}>
                          {persona.badge}
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                          PW: Grassroots@2026
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center text-foreground shrink-0 border border-border">
                          <Icon size={20} />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-foreground leading-tight">
                            {persona.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {persona.name} • <span className="font-mono text-[11px]">{persona.email}</span>
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                        {persona.description}
                      </p>

                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        {persona.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-foreground font-medium">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-5 mt-4">
                      <button
                        onClick={() => handle1ClickLogin(persona)}
                        disabled={loadingAction !== null}
                        className="w-full py-2.5 px-4 rounded-xl font-extrabold text-xs bg-primary text-primary-foreground shadow-sm hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <LoaderCircle size={14} className="animate-spin" />
                            <span>Authenticating as {persona.title}...</span>
                          </>
                        ) : (
                          <>
                            <span>Test as {persona.title}</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Direct Account Sign In with Password & Role Choice */}
        {activeTab === "custom-login" && (
          <div className="max-w-lg mx-auto p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-sm">
            <div className="space-y-1 text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
                <Lock size={22} />
              </div>
              <h2 className="text-xl font-extrabold text-foreground">
                Sign In to Your Account
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose which role persona you want to enter for this active session.
              </p>
            </div>

            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Registered Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="e.g. coach@myfootball.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-foreground">
                    Account Password *
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Test PW: Grassroots@2026
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-2">
                  Choose Active Role for This Session *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "coach", label: "Academy Coach", desc: "Enroll squads, set lineups & tactics", icon: Shield },
                    { id: "organizer", label: "Tournament Director", desc: "Manage cups, brackets & fees", icon: Trophy },
                    { id: "referee", label: "Match Official", desc: "Live match clock & pitch whistle", icon: Clock },
                    { id: "fan", label: "Spectator / Fan", desc: "Follow cups & export scorecards", icon: Compass },
                  ].map((r) => {
                    const Icon = r.icon;
                    const isSelected = loginRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setLoginRole(r.id as RoleType)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-primary/15 border-primary text-foreground ring-1 ring-primary shadow-sm"
                            : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={16} className={isSelected ? "text-amber-500" : ""} />
                          <span className="font-extrabold text-xs text-foreground">{r.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  ℹ️ <em>Coach role is required to enroll squads into tournaments. Roles switch cleanly without data collisions.</em>
                </p>
              </div>

              <button
                type="submit"
                disabled={loadingAction === "custom-login"}
                className="w-full py-3 px-4 rounded-xl font-extrabold text-xs bg-primary text-primary-foreground shadow-sm hover:opacity-95 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {loadingAction === "custom-login" ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>Verifying Credentials & Starting Session...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={14} />
                    <span>Sign In as {loginRole.toUpperCase()}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: Register New Account */}
        {activeTab === "register" && (
          <div className="max-w-xl mx-auto p-6 sm:p-8 rounded-3xl bg-card border border-border shadow-sm">
            <div className="space-y-1 text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <UserPlus size={22} />
              </div>
              <h2 className="text-xl font-extrabold text-foreground">
                Join the Bharat Football Network
              </h2>
              <p className="text-xs text-muted-foreground">
                Create your password-protected account with instant role provisioning.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="e.g. Bhaichung Bhutia"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="e.g. coach@punjabfootball.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-foreground">
                      Password (min 6) *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Confirm Password *
                  </label>
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-2">
                  Select Your Primary Football Role *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "coach", label: "Academy Coach", icon: Shield, desc: "Manage squads, tactics & enroll in cups" },
                    { id: "organizer", label: "Tournament Director", icon: Trophy, desc: "Create and manage grassroots cups" },
                    { id: "referee", label: "Match Official", icon: Clock, desc: "Run pitch clock & match telemetry" },
                    { id: "fan", label: "Spectator / Fan", icon: Compass, desc: "Live matchdays & WhatsApp scorecards" },
                  ].map((r) => {
                    const Icon = r.icon;
                    const isSelected = regRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegRole(r.id as RoleType)}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? "bg-primary/15 border-primary text-foreground shadow-sm ring-1 ring-primary"
                            : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={16} className={isSelected ? "text-amber-500" : ""} />
                          <span className="font-bold text-xs text-foreground">{r.label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {regRole === "coach" && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Your Football Academy / Club Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={regClubName}
                    onChange={(e) => setRegClubName(e.target.value)}
                    placeholder="e.g. Minerva Punjab Football Academy"
                    className="w-full px-3.5 py-2 rounded-xl bg-background border border-emerald-500/30 text-xs text-foreground focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="text-[10px] text-muted-foreground block">
                    We will automatically provision your club roster so you can immediately add players and enroll in tournaments.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={regCity}
                    onChange={(e) => setRegCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={regState}
                    onChange={(e) => setRegState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingAction === "register"}
                className="w-full py-3 px-4 rounded-xl font-extrabold text-xs bg-primary text-primary-foreground shadow-sm hover:opacity-95 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
              >
                {loadingAction === "register" ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" />
                    <span>Securing Account & Provisioning Hub...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    <span>Create Account & Enter Platform</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-border/60 text-center text-xs text-muted-foreground">
        <p>MyFootball Bharat — AIFF Grassroots & Tournament Operations System 🇮🇳</p>
      </footer>
    </div>
  );
}
