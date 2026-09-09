"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleDot,
  Clock,
  Compass,
  Lock,
  LogOut,
  Shield,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import { AppHeader } from "../layout/AppHeader";
import { AppFooter } from "../layout/AppFooter";

interface RoleGateCardProps {
  requiredRole: "organizer" | "coach" | "referee";
  currentRole?: string;
  userEmail?: string;
  userName?: string;
}

export function RoleGateCard({
  requiredRole,
  currentRole = "fan",
  userEmail = "",
  userName = "User",
}: RoleGateCardProps) {
  const roleConfig = {
    organizer: {
      title: "Tournament Director Hub",
      icon: Trophy,
      color: "text-amber-500",
      bgGlow: "bg-amber-500/10 border-amber-500/30",
      description:
        "The Organizer Hub is restricted to Tournament Directors and AIFF Competition Managers. Access is required to create tournaments, schedule division brackets, verify team payments, and approve club entries.",
      demoEmail: "organizer@myfootball.in",
      demoName: "Vikramaditya Singhania",
      targetPath: "/organize",
    },
    coach: {
      title: "Academy Coach & Tactics Hub",
      icon: Shield,
      color: "text-emerald-500",
      bgGlow: "bg-emerald-500/10 border-emerald-500/30",
      description:
        "The Coach Hub is restricted to Certified Academy Coaches and Team Managers. Access is required to manage youth club rosters, configure 4-3-3 pitch formations, select starting lineups, and register squads into tournaments.",
      demoEmail: "coach@myfootball.in",
      demoName: "Coach Subrata Paul",
      targetPath: "/coach",
    },
    referee: {
      title: "AIFF Match Official Console",
      icon: Clock,
      color: "text-cyan-500",
      bgGlow: "bg-cyan-500/10 border-cyan-500/30",
      description:
        "The Referee Console is restricted to AIFF-certified Match Officials and Pitch Commissioners. Access is required to operate the live match clock, record goals, cautions, IFAB Law 3 substitution windows, and shootout kicks.",
      demoEmail: "referee@myfootball.in",
      demoName: "Michael Murmu (AIFF)",
      targetPath: "/referee",
    },
  }[requiredRole];

  const RequiredIcon = roleConfig.icon;

  const currentHubPath =
    currentRole === "organizer"
      ? "/organize"
      : currentRole === "coach"
      ? "/coach"
      : currentRole === "referee"
      ? "/referee"
      : "/discover";

  const currentRoleLabel =
    currentRole === "organizer"
      ? "Tournament Director"
      : currentRole === "coach"
      ? "Academy Coach"
      : currentRole === "referee"
      ? "Match Official"
      : "Spectator / Fan";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      <AppHeader user={{ email: userEmail, displayName: userName, role: currentRole }} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full flex items-center justify-center">
        <div className="p-8 sm:p-10 rounded-3xl bg-card border border-border shadow-2xl space-y-6 text-center w-full relative overflow-hidden">
          {/* Ambient glow backdrop */}
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Locked Badge */}
          <div className="relative z-10 flex flex-col items-center space-y-3">
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-lg ${roleConfig.bgGlow}`}>
              <Lock size={28} className={roleConfig.color} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert size={13} />
              <span>Role Access Gate</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              {roleConfig.title} Requires {requiredRole.toUpperCase()} Role
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground max-w-lg leading-relaxed">
              {roleConfig.description}
            </p>
          </div>

          {/* Active Identity Summary */}
          <div className="relative z-10 p-4 rounded-2xl bg-muted/60 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-left space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Your Current Session:
              </span>
              <strong className="text-foreground text-sm block">{userName}</strong>
              <span className="font-mono text-muted-foreground text-[11px]">{userEmail}</span>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border bg-primary/10 text-primary border-primary/30">
                Active Role: {currentRoleLabel}
              </span>
            </div>
          </div>

          {/* Remediation / 1-Click Fast-Switch Actions */}
          <div className="relative z-10 space-y-3 pt-2">
            <a
              href={`/signin-with-chatgpt?email=${encodeURIComponent(
                roleConfig.demoEmail
              )}&role=${encodeURIComponent(requiredRole)}&name=${encodeURIComponent(
                roleConfig.demoName
              )}&return_to=${encodeURIComponent(roleConfig.targetPath)}`}
              className="w-full py-3.5 px-4 rounded-xl font-black text-xs bg-primary text-primary-foreground shadow-md hover:opacity-95 transition flex items-center justify-center gap-2"
            >
              <RequiredIcon size={16} />
              <span>1-Click Test as {roleConfig.demoName} ({requiredRole})</span>
              <ArrowRight size={14} />
            </a>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                href={currentHubPath}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 text-foreground border border-border transition flex items-center justify-center gap-2"
              >
                <span>Return to My {currentRoleLabel} Hub</span>
              </Link>

              <Link
                href="/login"
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-muted hover:bg-muted/80 text-foreground border border-border transition flex items-center justify-center gap-2"
              >
                <span>Switch / Register Other Account</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
