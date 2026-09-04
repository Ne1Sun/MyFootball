"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  CircleDot,
  Clock,
  Compass,
  LogOut,
  Menu,
  ShieldCheck,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import ThemeToggle from "../../theme-toggle";

type HeaderProps = {
  activeRoute?: "home" | "discover" | "organize" | "coach" | "referee" | "tournament" | "register";
  user?: { email: string; displayName: string } | null;
};

export function AppHeader({ activeRoute, user }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const current = activeRoute || (
    pathname === "/" ? "home" :
    pathname.startsWith("/discover") ? "discover" :
    pathname.startsWith("/organize") ? "organize" :
    pathname.startsWith("/coach") ? "coach" :
    pathname.startsWith("/referee") ? "referee" :
    pathname.startsWith("/tournament") ? "tournament" : "home"
  );

  const navItems = [
    { href: "/", label: "Home", id: "home", icon: CircleDot },
    { href: "/discover", label: "Discover", id: "discover", icon: Compass },
    { href: "/organize", label: "Organizer Hub", id: "organize", icon: Trophy },
    { href: "/coach", label: "Coach Hub", id: "coach", icon: ShieldCheck },
    { href: "/referee", label: "Referee Console", id: "referee", icon: Clock },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-lg tracking-tight shrink-0 group">
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
            <div className="hidden sm:flex items-center gap-1.5">
              <Link
                href="/account"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-90 transition"
              >
                <UserCheck size={14} />
                <span>{user.displayName?.split(" ")[0] || "Account"}</span>
              </Link>
              <a
                href="/signout-with-chatgpt?return_to=%2Fsigned-out"
                className="p-2 rounded-xl border border-border text-muted-foreground hover:text-rose-500 hover:border-rose-500/30 transition"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={15} />
              </a>
            </div>
          ) : (
            <a
              href="/signin-with-chatgpt?return_to=%2Forganize"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm hover:opacity-90 transition"
            >
              <span>Sign In</span>
              <ArrowRight size={13} />
            </a>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition"
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

          <div className="pt-3 border-t border-border flex items-center justify-between">
            {user ? (
              <div className="w-full flex items-center justify-between gap-3">
                <Link
                  href="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs font-bold text-primary flex items-center gap-1.5 min-w-0"
                >
                  <UserCheck size={15} />
                  <span className="truncate">Account: {user.displayName}</span>
                </Link>
                <a
                  href="/signout-with-chatgpt?return_to=%2Fsigned-out"
                  className="text-xs font-bold text-rose-500 flex items-center gap-1.5 shrink-0"
                >
                  <LogOut size={14} /> Sign out
                </a>
              </div>
            ) : (
              <a
                href="/signin-with-chatgpt?return_to=%2Forganize"
                className="w-full text-center py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
              >
                Sign In to MyFootball Bharat
              </a>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
