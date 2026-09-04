"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_EVENT = "myfootball-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getDarkSnapshot() {
  return document.documentElement.dataset.theme === "dark";
}

export default function ThemeToggle({
  compact = false,
}: {
  compact?: boolean;
}) {
  const dark = useSyncExternalStore(subscribe, getDarkSnapshot, () => false);
  const toggle = () => {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("myfootball-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event(THEME_EVENT));
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
