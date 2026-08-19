"use client";

import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Shield, TrendingUp, Trophy } from "lucide-react";
import type { Division, Entry, Fixture } from "../types";

export function StandingsView({
  divisions,
  entries,
  fixtures,
}: {
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
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

  // Group entries by groupName (e.g. Group A, Group B)
  const groupedStandings = useMemo(() => {
    if (!division) return {};

    const groups: Record<
      string,
      Array<{
        entry: Entry;
        p: number;
        w: number;
        d: number;
        l: number;
        gf: number;
        ga: number;
        gd: number;
        pts: number;
        form: Array<"W" | "D" | "L">;
      }>
    > = {};

    divisionEntries.forEach((entry) => {
      const gName = entry.groupName || "Group A";
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push({
        entry,
        p: 0,
        w: 0,
        d: 0,
        l: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        pts: 0,
        form: [],
      });
    });

    // Calculate match outcomes
    divisionFixtures
      .filter((f) => f.status === "completed")
      .forEach((fixture) => {
        for (const list of Object.values(groups)) {
          const home = list.find((item) => item.entry.id === fixture.homeEntryId);
          const away = list.find((item) => item.entry.id === fixture.awayEntryId);
          if (home && away) {
            home.p += 1;
            away.p += 1;
            home.gf += fixture.homeScore;
            home.ga += fixture.awayScore;
            away.gf += fixture.awayScore;
            away.ga += fixture.homeScore;

            if (fixture.homeScore > fixture.awayScore) {
              home.w += 1;
              away.l += 1;
              home.pts += division.winPoints;
              away.pts += division.lossPoints;
              home.form.push("W");
              away.form.push("L");
            } else if (fixture.homeScore < fixture.awayScore) {
              away.w += 1;
              home.l += 1;
              away.pts += division.winPoints;
              home.pts += division.lossPoints;
              away.form.push("W");
              home.form.push("L");
            } else {
              home.d += 1;
              away.d += 1;
              home.pts += division.drawPoints;
              away.pts += division.drawPoints;
              home.form.push("D");
              away.form.push("D");
            }
          }
        }
      });

    // Sort each group by Points -> GD -> GF
    for (const [groupName, list] of Object.entries(groups)) {
      list.forEach((item) => (item.gd = item.gf - item.ga));
      groups[groupName] = list.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    }

    return groups;
  }, [division, divisionEntries, divisionFixtures]);

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
                            <strong className="text-foreground">{row.entry.teamName}</strong>
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
