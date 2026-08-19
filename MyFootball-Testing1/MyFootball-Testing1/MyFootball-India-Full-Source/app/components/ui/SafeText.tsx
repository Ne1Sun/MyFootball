"use client";

import React from "react";

/**
 * Safely truncates a string by Unicode grapheme clusters rather than UTF-16 code units.
 * This prevents corrupting Indic scripts (Hindi, Bengali, Malayalam, Marathi) and multi-byte emojis.
 */
export function safeTruncateGraphemes(str: string, maxGraphemes: number): string {
  if (!str) return "";
  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      // @ts-ignore
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      // @ts-ignore
      const segments = Array.from(segmenter.segment(str));
      if (segments.length <= maxGraphemes) return str;
      // @ts-ignore
      return segments.slice(0, maxGraphemes).map((s: any) => s.segment).join("") + "…";
    }
  } catch {
    // Fallback if Segmenter is not supported
  }
  return Array.from(str).slice(0, maxGraphemes).join("") + (str.length > maxGraphemes ? "…" : "");
}

/**
 * Generates an authentic 3-letter broadcast tricode abbreviation from a team name.
 */
export function getTeamTricode(name: string): string {
  if (!name) return "TBD";
  const cleaned = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 3).toUpperCase();
}

interface SafeTextProps {
  text: string;
  maxGraphemes?: number;
  className?: string;
}

export function SafeText({ text, maxGraphemes, className = "" }: SafeTextProps) {
  const displayText = maxGraphemes ? safeTruncateGraphemes(text, maxGraphemes) : text;
  return <span className={className}>{displayText}</span>;
}
