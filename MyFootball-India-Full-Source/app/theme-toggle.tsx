"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem("myfootball-theme");
      const enabled =
        stored === "dark" ||
        (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = enabled ? "dark" : "light";
      setDark(enabled);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("myfootball-theme", next ? "dark" : "light");
  };
  return (
    <button
      className={compact ? "theme-toggle compact" : "theme-toggle"}
      onClick={toggle}
      aria-label={dark ? "Use light mode" : "Use dark mode"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
