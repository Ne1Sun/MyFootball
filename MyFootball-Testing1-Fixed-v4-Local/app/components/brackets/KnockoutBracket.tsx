"use client";

import { useMemo, useState, useRef } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  FastForward,
  Filter,
  Flame,
  Layers,
  LoaderCircle,
  Play,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import type { Division, Entry, Fixture } from "../types";

/**
 * Grapheme-safe string truncation that never splits Indic combining characters
 * or multi-code-point grapheme clusters (Devanagari, Bengali, Tamil, etc.).
 */
export function getGraphemeSafeText(str: string, maxGraphemes: number): string {
  if (!str) return "";
  try {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      const segments = Array.from(segmenter.segment(str), (segment) => segment.segment);
      return segments.slice(0, maxGraphemes).join("");
    }
  } catch {
    // Fallback
  }
  return Array.from(str).slice(0, maxGraphemes).join("");
}

/**
 * SEC-03: Safe 3-letter uppercase tricode generator or grapheme-safe text
 * that doesn't split Indic scripts.
 */
export function getSafeTricode(name: string): string {
  if (!name || !name.trim()) return "TBD";
  const trimmed = name.trim();

  // Check if Latin/alphanumeric
  const isAscii = /^[\x00-\x7F]+$/.test(trimmed);

  if (isAscii) {
    // Split into words, ignore common club noise words if we have enough distinct words
    const words = trimmed
      .split(/[\s\-_]+/)
      .filter((w) => Boolean(w) && !/^(fc|sc|club|cf|afc|united|city|the)$/i.test(w));

    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    } else if (words.length === 2) {
      const w1 = words[0];
      const w2 = words[1];
      const code = (w1.slice(0, 2) + w2.slice(0, 1)).toUpperCase();
      return code.length === 3 ? code : (w1[0] + w2.slice(0, 2)).toUpperCase();
    } else {
      const cleanWord = (words[0] || trimmed).replace(/[^a-zA-Z0-9]/g, "");
      return cleanWord.slice(0, 3).toUpperCase().padEnd(3, "X");
    }
  }

  // Non-ASCII / Indic script: Use grapheme-safe extraction of up to 3 grapheme clusters
  return getGraphemeSafeText(trimmed, 3);
}

export type KnockoutRoundStage = {
  id: string;
  title: string;
  shortTitle: string;
  order: number;
  fixtures: Fixture[];
  isChampionship?: boolean;
};

export function KnockoutBracket({
  divisions,
  entries,
  fixtures,
  onSaveAction,
  onOpenMatchday,
}: {
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  onSaveAction: (payload: Record<string, unknown>) => Promise<boolean>;
  onOpenMatchday: (fixtureId: string) => void;
}) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(divisions[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const division = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];

  // Filter knockout fixtures for the selected division
  const knockoutFixtures = useMemo(() => {
    if (!division) return [];
    return fixtures.filter(
      (f) => f.divisionId === division.id && (f.stage === "knockout" || Boolean(f.bracketRound))
    );
  }, [fixtures, division]);
  const groupFixtures = useMemo(() => {
    if (!division) return [];
    return fixtures.filter((fixture) => fixture.divisionId === division.id && fixture.stage === "group");
  }, [fixtures, division]);
  const canGenerateKnockout =
    division?.format === "group_knockout" &&
    groupFixtures.length > 0 &&
    groupFixtures.every((fixture) => fixture.status === "completed");
  const pendingByeCount = useMemo(() => {
    try {
      const parsed = JSON.parse(division?.knockoutByeEntryIds || "[]");
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [division]);

  // SEC-02: Dynamically organize every supported 2–128 team knockout round.
  const bracketStages = useMemo(() => {
    if (knockoutFixtures.length === 0) return [];

    const r128: Fixture[] = [];
    const r64: Fixture[] = [];
    const r32: Fixture[] = [];
    const r16: Fixture[] = [];
    const qf: Fixture[] = [];
    const sf: Fixture[] = [];
    const finalFix: Fixture[] = [];
    const bronzeFix: Fixture[] = [];
    const otherKnockouts: Record<string, Fixture[]> = {};

    for (const f of knockoutFixtures) {
      const bRound = (f.bracketRound || "").toLowerCase();
      const rName = (f.roundName || "").toLowerCase();

      if (bRound === "round_of_128" || bRound === "r128" || rName.includes("round of 128") || rName.includes("r128")) {
        r128.push(f);
      } else if (bRound === "round_of_64" || bRound === "r64" || rName.includes("round of 64") || rName.includes("r64")) {
        r64.push(f);
      } else if (bRound === "round_of_32" || bRound === "r32" || rName.includes("round of 32") || rName.includes("r32")) {
        r32.push(f);
      } else if (bRound === "round_of_16" || bRound === "r16" || rName.includes("round of 16") || rName.includes("r16")) {
        r16.push(f);
      } else if (
        bRound === "quarter_final" ||
        bRound === "quarter_finals" ||
        bRound === "qf" ||
        rName.includes("quarter") ||
        rName.includes("qf")
      ) {
        qf.push(f);
      } else if (
        bRound === "semi_final" ||
        bRound === "semi_finals" ||
        bRound === "sf" ||
        rName.includes("semi") ||
        rName.includes("sf")
      ) {
        sf.push(f);
      } else if (bRound === "third_place" || rName.includes("3rd place") || rName.includes("third place") || rName.includes("bronze")) {
        bronzeFix.push(f);
      } else if (bRound === "final" || rName.includes("final") || rName.includes("championship")) {
        finalFix.push(f);
      } else {
        const key = f.roundName || `Knockout Round ${f.roundNumber || 1}`;
        if (!otherKnockouts[key]) otherKnockouts[key] = [];
        otherKnockouts[key].push(f);
      }
    }

    const stages: KnockoutRoundStage[] = [];

    if (r128.length > 0) {
      stages.push({
        id: "round_of_128",
        title: "Round of 128",
        shortTitle: "R128",
        order: 1,
        fixtures: r128.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    if (r64.length > 0) {
      stages.push({
        id: "round_of_64",
        title: "Round of 64",
        shortTitle: "R64",
        order: 2,
        fixtures: r64.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    // Round of 32 (32 teams -> 16 matches)
    if (r32.length > 0) {
      stages.push({
        id: "round_of_32",
        title: "Round of 32",
        shortTitle: "R32",
        order: 3,
        fixtures: r32.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    // Round of 16 (16 teams -> 8 matches)
    if (r16.length > 0) {
      stages.push({
        id: "round_of_16",
        title: "Round of 16",
        shortTitle: "R16",
        order: 4,
        fixtures: r16.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    // Quarter-Finals (8 teams -> 4 matches)
    if (qf.length > 0) {
      stages.push({
        id: "quarter_final",
        title: "Quarter-Finals",
        shortTitle: "Quarters",
        order: 5,
        fixtures: qf.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    // Semi-Finals (4 teams -> 2 matches)
    if (sf.length > 0) {
      stages.push({
        id: "semi_final",
        title: "Semi-Finals",
        shortTitle: "Semis",
        order: 6,
        fixtures: sf.sort((a, b) => (a.bracketMatchIndex ?? 0) - (b.bracketMatchIndex ?? 0)),
      });
    }

    // Championship Stage (Grand Final & 3rd Place)
    const champFixtures = [...finalFix, ...bronzeFix];
    if (champFixtures.length > 0) {
      stages.push({
        id: "championship",
        title: "Championship Matches",
        shortTitle: "Finals",
        order: 7,
        fixtures: champFixtures,
        isChampionship: true,
      });
    }

    // If other custom knockout rounds were present
    let customOrder = 8;
    for (const [key, cFix] of Object.entries(otherKnockouts)) {
      stages.push({
        id: `custom_${customOrder}`,
        title: key,
        shortTitle: key.slice(0, 10),
        order: customOrder++,
        fixtures: cFix,
      });
    }

    return stages.sort((a, b) => a.order - b.order);
  }, [knockoutFixtures]);

  const handleAdvanceWinner = async (fixture: Fixture, winningEntryId: string, losingEntryId: string) => {
    const winner = entries.find((e) => e.id === winningEntryId);
    const winnerName = winner?.teamName || "Selected Team";
    if (!confirm(`Confirm ${winnerName} as the winner and advance them to the next bracket round?`)) return;
    setBusy(true);
    try {
      await onSaveAction({
        action: "advanceBracketWinner",
        fixtureId: fixture.id,
        winningEntryId,
        losingEntryId,
        homeScorePenalties: fixture.homeScorePenalties,
        awayScorePenalties: fixture.awayScorePenalties,
      });
    } finally {
      setBusy(false);
    }
  };

  const scrollToStage = (stageId: string) => {
    if (!scrollContainerRef.current) return;
    const stageEl = scrollContainerRef.current.querySelector(`#stage-col-${stageId}`);
    if (stageEl) {
      stageEl.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    }
  };

  const renderMatchCard = (fixture: Fixture, title: string, isChampionStage = false) => {
    const home = entries.find((e) => e.id === fixture.homeEntryId);
    const away = entries.find((e) => e.id === fixture.awayEntryId);

    const isCompleted = fixture.status === "completed";
    const isLive = fixture.status === "in_progress";

    const homeWon =
      isCompleted &&
      (fixture.homeScore > fixture.awayScore ||
        (fixture.homeScore === fixture.awayScore && fixture.homeScorePenalties > fixture.awayScorePenalties));
    const awayWon =
      isCompleted &&
      (fixture.awayScore > fixture.homeScore ||
        (fixture.homeScore === fixture.awayScore && fixture.awayScorePenalties > fixture.homeScorePenalties));

    const homeTricode = home ? getSafeTricode(home.teamName) : "TBD";
    const awayTricode = away ? getSafeTricode(away.teamName) : "TBD";

    const isGrandFinal = fixture.bracketRound === "final" || title.toLowerCase().includes("final");
    const isThirdPlace = fixture.bracketRound === "third_place" || title.toLowerCase().includes("3rd");

    return (
      <div
        key={fixture.id}
        className={`relative rounded-2xl p-4 transition shadow-md border ${
          isGrandFinal
            ? "bg-gradient-to-br from-amber-500/10 via-background to-card border-amber-500/40 shadow-amber-500/10 hover:border-amber-500"
            : isThirdPlace
            ? "bg-card border-amber-600/30 hover:border-amber-500/40"
            : isLive
            ? "bg-card border-rose-500/50 shadow-rose-500/10 animate-in fade-in"
            : "bg-card border-border hover:border-primary/40 hover:shadow-lg"
        }`}
      >
        {/* Match Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60 text-xs">
          <span className="font-bold text-foreground/90 flex items-center gap-1.5 truncate">
            {isGrandFinal ? (
              <Crown size={14} className="text-amber-500 shrink-0" />
            ) : isThirdPlace ? (
              <Award size={14} className="text-amber-600 shrink-0" />
            ) : (
              <Swords size={13} className="text-muted-foreground shrink-0" />
            )}
            <span className="truncate">{title}</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isLive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-500 animate-pulse border border-rose-500/30">
                LIVE {fixture.matchClockMinute}&apos;
              </span>
            )}
            {isCompleted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                FINAL
              </span>
            )}
            {!isLive && !isCompleted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground">
                Pitch {fixture.pitch}
              </span>
            )}
          </div>
        </div>

        {/* Team Rows */}
        <div className="space-y-2">
          {/* Home Team */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-xl transition ${
              homeWon
                ? "bg-emerald-500/15 border border-emerald-500/30 text-foreground font-bold"
                : "bg-muted/40 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Shield size={16} className={`shrink-0 ${homeWon ? "text-emerald-500" : "text-muted-foreground"}`} />
              <span className="truncate text-xs sm:text-sm font-semibold" title={home?.teamName || "TBD"}>
                {home?.teamName || "TBD (Awaiting Match)"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-sm shrink-0">
              {fixture.homeScorePenalties > 0 && (
                <span className="text-[10px] text-muted-foreground">({fixture.homeScorePenalties}p)</span>
              )}
              <span className="w-6 text-center">{isCompleted || isLive ? fixture.homeScore : "-"}</span>
            </div>
          </div>

          {/* Away Team */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-xl transition ${
              awayWon
                ? "bg-emerald-500/15 border border-emerald-500/30 text-foreground font-bold"
                : "bg-muted/40 text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <Shield size={16} className={`shrink-0 ${awayWon ? "text-emerald-500" : "text-muted-foreground"}`} />
              <span className="truncate text-xs sm:text-sm font-semibold" title={away?.teamName || "TBD"}>
                {away?.teamName || "TBD (Awaiting Match)"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono font-bold text-sm shrink-0">
              {fixture.awayScorePenalties > 0 && (
                <span className="text-[10px] text-muted-foreground">({fixture.awayScorePenalties}p)</span>
              )}
              <span className="w-6 text-center">{isCompleted || isLive ? fixture.awayScore : "-"}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between gap-2">
          <button
            onClick={() => onOpenMatchday(fixture.id)}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 min-h-[32px]"
          >
            <Play size={12} fill="currentColor" /> Open Match Center
          </button>

          {!fixture.winnerEntryId && home && away && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAdvanceWinner(fixture, home.id, away.id)}
                disabled={busy}
                title={`Advance ${home.teamName}`}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-emerald-500/20 hover:text-emerald-600 font-bold transition flex items-center gap-1 border border-border min-h-[32px]"
              >
                <span>Adv {homeTricode}</span>
              </button>
              <button
                onClick={() => handleAdvanceWinner(fixture, away.id, home.id)}
                disabled={busy}
                title={`Advance ${away.teamName}`}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-emerald-500/20 hover:text-emerald-600 font-bold transition flex items-center gap-1 border border-border min-h-[32px]"
              >
                <span>Adv {awayTricode}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Division Selector */}
      <div className="panel-card flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold shrink-0">
            <Trophy size={24} />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">
              Tournament Elimination Tree
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="font-bold text-base sm:text-lg bg-transparent border-none focus:outline-none cursor-pointer text-foreground"
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id} className="bg-popover text-popover-foreground">
                    {d.name} ({d.format.replace("_", " ").toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3.5 py-2 rounded-xl border border-border">
          <Sparkles size={14} className="text-amber-500 shrink-0" />
          <span>
            Automatic winner progression for 2 to 128-team knockout brackets
            {pendingByeCount > 0 ? ` · ${pendingByeCount} seeded ${pendingByeCount === 1 ? "bye" : "byes"}` : ""}
          </span>
        </div>
      </div>

      {knockoutFixtures.length === 0 ? (
        <div className="empty-card text-center p-12 rounded-3xl bg-card border border-border space-y-3">
          <Trophy size={40} className="mx-auto text-muted-foreground/60" />
          <h3 className="text-lg font-bold text-foreground">No Knockout Bracket Generated</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {division?.format === "group_knockout"
              ? canGenerateKnockout
                ? "The group stage is complete. Generate the seeded knockout stage from the final standings."
                : "Complete every group match to unlock automatic knockout qualification."
              : "Generate fixtures for this division to construct the knockout tree."}
          </p>
          {canGenerateKnockout && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSaveAction({ action: "generateKnockoutStage", divisionId: division.id });
                } finally {
                  setBusy(false);
                }
              }}
              className="button primary mx-auto"
            >
              {busy ? <LoaderCircle className="spin" size={16} /> : <FastForward size={16} />}
              Generate knockout stage
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Stage Jump Bar */}
          {bracketStages.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:hidden">
              <span className="text-[11px] font-bold text-muted-foreground uppercase shrink-0 flex items-center gap-1">
                <Filter size={12} /> Jump:
              </span>
              {bracketStages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => scrollToStage(stage.id)}
                  className="px-3 py-1.5 rounded-lg bg-muted text-xs font-bold whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition border border-border"
                >
                  {stage.shortTitle} ({stage.fixtures.length})
                </button>
              ))}
            </div>
          )}

          {/* Horizontal Smooth-Scrolling Tree Layout with Sticky Headers */}
          <div
            ref={scrollContainerRef}
            className="relative overflow-x-auto scroll-smooth pb-6 pt-1 snap-x snap-mandatory rounded-2xl"
          >
            <div className="flex items-start gap-6 min-w-max px-1">
              {bracketStages.map((stage, sIdx) => {
                const isLastStage = sIdx === bracketStages.length - 1;
                return (
                  <div key={stage.id} className="flex items-center gap-6">
                    {/* Stage Column */}
                    <div
                      id={`stage-col-${stage.id}`}
                      className="w-[280px] sm:w-[320px] shrink-0 space-y-4 snap-start"
                    >
                      {/* Sticky Stage Header */}
                      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2.5 px-3.5 rounded-xl border border-border shadow-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {stage.isChampionship ? (
                            <Crown size={15} className="text-amber-500" />
                          ) : (
                            <Layers size={15} className="text-primary" />
                          )}
                          <strong className="text-xs uppercase tracking-wider font-extrabold text-foreground">
                            {stage.title}
                          </strong>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {stage.fixtures.length} {stage.fixtures.length === 1 ? "Match" : "Matches"}
                        </span>
                      </div>

                      {/* Matches List */}
                      <div className="space-y-4">
                        {stage.fixtures.map((fix, fIdx) => {
                          const isFinal = fix.bracketRound === "final" || fix.roundName?.toLowerCase().includes("grand final");
                          const isThird = fix.bracketRound === "third_place" || fix.roundName?.toLowerCase().includes("3rd");
                          const title = isFinal
                            ? "🏆 Grand Championship Final"
                            : isThird
                            ? "🥉 3rd Place Playoff"
                            : fix.roundName || `${stage.shortTitle} Match ${fIdx + 1}`;

                          return renderMatchCard(fix, title, stage.isChampionship);
                        })}
                      </div>
                    </div>

                    {/* Stage Connector Arrow/Indicator */}
                    {!isLastStage && (
                      <div className="hidden md:flex flex-col items-center justify-center space-y-2 shrink-0 px-1">
                        <div className="w-8 h-8 rounded-full bg-muted/80 border border-border flex items-center justify-center text-muted-foreground">
                          <ChevronRight size={16} />
                        </div>
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/60">
                          Advances
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
