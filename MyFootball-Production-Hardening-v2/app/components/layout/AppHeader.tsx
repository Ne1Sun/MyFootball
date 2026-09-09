"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  CircleDot,
  Clock,
  Compass,
  LogOut,
  Menu,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import ThemeToggle from "../../theme-toggle";
import { getNavItems, getRoleHomePath } from "../../lib/navigation";

export { getNavItems, getRoleHomePath };

type HeaderProps = {
  activeRoute?: "home" | "discover" | "organize" | "coach" | "referee" | "tournament" | "register" | "login";
  user?: { email: string; displayName: string; role?: string } | null;
};

export function AppHeader({ activeRoute, user }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const current = activeRoute || (
    pathname === "/" ? "home" :
    pathname.startsWith("/discover") ? "discover" :
    pathname.startsWith("/organize") ? "organize" :
    pathname.startsWith("/coach") ? "coach" :
    pathname.startsWith("/referee") ? "referee" :
    pathname.startsWith("/login") ? "login" :
    pathname.startsWith("/tournament") ? "tournament" : (user ? "discover" : "home")
  );

  const navItems = getNavItems(user);

  const getRoleMeta = (role?: string) => {
    switch (role?.toLowerCase()) {
      case "organizer":
        return { label: "Director", icon: Trophy, hub: "/organize", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
      case "coach":
        return { label: "Coach", icon: Shield, hub: "/coach", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
      case "referee":
        return { label: "Official", icon: Clock, hub: "/referee", color: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" };
      default:
        return { label: "Fan", icon: Compass, hub: "/discover", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" };
    }
  };

  const roleMeta = getRoleMeta(user?.role);
  const RoleIcon = roleMeta.icon;
  const brandHomeHref = getRoleHomePath(user?.role);

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link
          href={brandHomeHref}
          className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight shrink-0 group"
          aria-label={`MyFootball Bharat Home (${user?.role || "Guest"})`}
        >
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
            <CircleDot size={18} strokeWidth={2.6} />
          </span>
          <span className="text-foreground">
            my<span className="text-amber-500 dark:text-amber-400">football</span>
          </span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-widest hidden sm:inline">
            Bharat 🇮🇳
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = current === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? "bg-background text-foreground shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Icon size={14} className={isActive ? "text-amber-500 dark:text-amber-400" : ""} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-card border border-border shadow-sm hover:border-primary/50 transition"
              >
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${roleMeta.color}`}>
                  <RoleIcon size={11} />
                  <span>{roleMeta.label}</span>
                </span>
                <span className="hidden sm:inline text-foreground max-w-[120px] truncate">
                  {user.displayName?.split(" ")[0] || "Account"}
                </span>
                <ChevronDown size={13} className="text-muted-foreground" />
              </button>

              {/* User Dropdown Popover */}
              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-card border border-border shadow-xl p-3 z-50 space-y-3 animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  <div className="px-2 py-1 space-y-0.5 border-b border-border pb-2">
                    <p className="text-xs font-extrabold text-foreground truncate">{user.displayName}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{user.email}</p>
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleMeta.color}`}>
                      Role: {roleMeta.label}
                    </span>
                  </div>

                  {/* Primary Hub Link */}
                  <Link
                    href={roleMeta.hub}
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground shadow-sm flex items-center justify-between hover:opacity-95 transition"
                  >
                    <span>Go to {roleMeta.label} Hub</span>
                    <ArrowRight size={13} />
                  </Link>

                  {/* 1-Click Role Switcher */}
                  <div className="pt-1 border-t border-border space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 block">
                      Quick Switch Demo Role
                    </span>
                    <a
                      href="/signin-with-chatgpt?email=organizer@myfootball.in&role=organizer&return_to=/organize"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <Trophy size={13} className="text-amber-500" />
                      <span>Organizer (Sunil / Vikram)</span>
                    </a>
                    <a
                      href="/signin-with-chatgpt?email=coach@myfootball.in&role=coach&return_to=/coach"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <Shield size={13} className="text-emerald-500" />
                      <span>Coach (Subrata / RFYC)</span>
                    </a>
                    <a
                      href="/signin-with-chatgpt?email=referee@myfootball.in&role=referee&return_to=/referee"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <Clock size={13} className="text-cyan-500" />
                      <span>Referee (Michael Murmu)</span>
                    </a>
                    <a
                      href="/signin-with-chatgpt?email=fan@myfootball.in&role=fan&return_to=/discover"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <Compass size={13} className="text-purple-500" />
                      <span>Fan (Aarav Sharma)</span>
                    </a>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-border">
                    <a
                      href="/signout-with-chatgpt?return_to=/login"
                      className="w-full px-2 py-1.5 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition"
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm hover:opacity-90 transition"
            >
              <Sparkles size={13} />
              <span>Sign In / Test Roles</span>
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-2 shadow-xl animate-in slide-in-from-top-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = current === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2.5 transition ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-border space-y-2">
            {user ? (
              <>
                <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{user.displayName}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleMeta.color}`}>
                      {roleMeta.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground block">{user.email}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    href={roleMeta.hub}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                  >
                    Open Hub
                  </Link>
                  <a
                    href="/signout-with-chatgpt?return_to=/login"
                    className="w-full text-center py-2 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-xs"
                  >
                    Sign Out
                  </a>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs block"
              >
                Sign In / Test Roles
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

