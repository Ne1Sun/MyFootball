"use client";

import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Shield, TrendingUp, Trophy } from "lucide-react";
import type { Division, Entry, Fixture, MatchEvent } from "../types";
import { resolveGroupStandings } from "../../lib/standings-engine";

export function StandingsView({
  divisions,
  entries,
  fixtures,
  events = [],
}: {
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  events?: MatchEvent[];
}) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(divisions[0]?.id || "");

  const division = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];

  const divisionEntries = useMemo(() => {
    if (!division) return [];
    return entries.filter((e) => e.divisionId === division.id && e.status === "approved");
  }, [entries, division]);

  const divisionFixtures = useMemo(() => {
    if (!division) return [];
    return fixtures.filter((f) => f.divisionId === division.id && f.stage === "group");
  }, [fixtures, division]);

  // Resolve official AIFF 6-tier group standings
  const groupedStandings = useMemo(() => {
    if (!division) return {};

    return resolveGroupStandings(
      divisionEntries.map((e) => ({
        id: e.id,
        divisionId: e.divisionId,
        teamId: e.teamId,
        teamName: e.teamName,
        clubName: e.clubName,
        groupName: e.groupName,
        seed: e.seed,
        city: e.city,
      })),
      divisionFixtures.map((f) => ({
        id: f.id,
        divisionId: f.divisionId,
        homeEntryId: f.homeEntryId,
        awayEntryId: f.awayEntryId,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        status: f.status,
        stage: f.stage,
      })),
      events.map((ev) => ({
        id: ev.id,
        fixtureId: ev.fixtureId,
        entryId: ev.entryId,
        type: ev.type,
        playerId: ev.playerId,
        matchMinute: ev.matchMinute,
      })),
      division.winPoints,
      division.drawPoints,
      division.lossPoints
    );
  }, [division, divisionEntries, divisionFixtures, events]);

  const getFormPill = (result: "W" | "D" | "L") => {
    switch (result) {
      case "W":
        return <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center justify-center">W</span>;
      case "D":
        return <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-center justify-center">D</span>;
      case "L":
        return <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[10px] flex items-center justify-center">L</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Division Selector */}
      <div className="panel-card flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
            <BarChart3 size={24} />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Tournament Tables & Standings
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="font-bold text-lg bg-transparent border-none focus:outline-none cursor-pointer text-foreground"
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

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border">
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>Top 2 teams qualify for the Championship Knockout Stage</span>
        </div>
      </div>

      {/* Standings Tables by Group */}
      {Object.entries(groupedStandings).map(([groupName, rows]) => (
        <div key={groupName} className="panel-card rounded-2xl p-5 bg-card border border-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-primary" />
              <h3 className="font-extrabold text-base text-foreground">{groupName} Table</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {rows.length} Teams
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                  <th className="py-2.5 px-3">Pos</th>
                  <th className="py-2.5 px-3">Team / Club</th>
                  <th className="py-2.5 px-3 text-center">P</th>
                  <th className="py-2.5 px-3 text-center">W</th>
                  <th className="py-2.5 px-3 text-center">D</th>
                  <th className="py-2.5 px-3 text-center">L</th>
                  <th className="py-2.5 px-3 text-center">GF</th>
                  <th className="py-2.5 px-3 text-center">GA</th>
                  <th className="py-2.5 px-3 text-center">GD</th>
                  <th className="py-2.5 px-3 text-right">Pts</th>
                  <th className="py-2.5 px-3 text-center" title="Fair Play Disciplinary Score (Fewer penalty cards)">FP</th>
                  <th className="py-2.5 px-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => {
                  const qualifies = index < (division?.teamsAdvancingPerGroup || 2);
                  return (
                    <tr
                      key={row.entry.id}
                      className={`transition ${
                        qualifies ? "bg-emerald-500/5 hover:bg-emerald-500/10 font-semibold" : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                              qualifies
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black"
                                : "text-muted-foreground"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className={qualifies ? "text-emerald-500" : "text-muted-foreground"} />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <strong className="text-foreground">{row.entry.teamName}</strong>
                              {row.tieBreakerReason && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20" title={`Tie-break: ${row.tieBreakerReason}`}>
                                  {row.tieBreakerReason}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{row.entry.clubName} • {row.entry.city}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{row.p}</td>
                      <td className="py-3 px-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{row.w}</td>
                      <td className="py-3 px-3 text-center font-mono text-amber-600 dark:text-amber-400">{row.d}</td>
                      <td className="py-3 px-3 text-center font-mono text-rose-600 dark:text-rose-400">{row.l}</td>
                      <td className="py-3 px-3 text-center font-mono text-muted-foreground">{row.gf}</td>
                      <td className="py-3 px-3 text-center font-mono text-muted-foreground">{row.ga}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-primary text-base">
                        {row.pts}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-xs text-muted-foreground" title={`Fair Play score: ${row.fairPlayScore}`}>
                        {row.fairPlayScore}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {row.form.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            row.form.slice(-5).map((res, i) => <span key={i}>{getFormPill(res)}</span>)
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
