"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("myfootball-theme");
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const isDark = stored ? stored === "dark" : mql.matches;
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    setDark(isDark);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("myfootball-theme")) {
        const nextDark = e.matches;
        document.documentElement.dataset.theme = nextDark ? "dark" : "light";
        setDark(nextDark);
      }
    };
    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("myfootball-theme", next ? "dark" : "light");
  };

  return (
    <button
      className={`${compact ? "theme-toggle compact" : "theme-toggle"} min-h-[44px] min-w-[44px] flex items-center justify-center`}
      onClick={toggle}
      aria-label={mounted ? (dark ? "Use light mode" : "Use dark mode") : "Toggle theme"}
    >
      {mounted && dark ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{mounted && dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
