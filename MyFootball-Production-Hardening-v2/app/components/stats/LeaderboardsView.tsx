"use client";

import { useMemo, useState } from "react";
import {
  Award,
  CircleDot,
  Crown,
  Flame,
  Medal,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type { Division, Entry, Fixture, MatchEvent, Player } from "../types";

export function LeaderboardsView({
  divisions,
  entries,
  fixtures,
  events,
  players,
}: {
  divisions: Division[];
  entries: Entry[];
  fixtures: Fixture[];
  events: MatchEvent[];
  players: Player[];
}) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(divisions[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"scorers" | "assists" | "cleansheets" | "discipline">("scorers");

  const division = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];

  const divisionEntries = useMemo(() => {
    if (!division) return [];
    return entries.filter((e) => e.divisionId === division.id);
  }, [entries, division]);

  const divisionFixtures = useMemo(() => {
    if (!division) return [];
    return fixtures.filter((f) => f.divisionId === division.id);
  }, [fixtures, division]);

  const divisionFixtureIds = useMemo(() => new Set(divisionFixtures.map((f) => f.id)), [divisionFixtures]);

  const divisionEvents = useMemo(() => {
    return events.filter((e) => divisionFixtureIds.has(e.fixtureId));
  }, [events, divisionFixtureIds]);

  // --- 1. Golden Boot (Top Scorers) ---
  const topScorers = useMemo(() => {
    const map = new Map<string, { name: string; teamName: string; clubName: string; goals: number; penalties: number }>();

    divisionEvents.forEach((ev) => {
      if (ev.type === "goal" || ev.type === "penalty_goal") {
        const key = ev.playerId || ev.playerName;
        const entry = entries.find((e) => e.id === ev.entryId);
        const existing = map.get(key) || {
          name: ev.playerName,
          teamName: entry?.teamName || "Team",
          clubName: entry?.clubName || "",
          goals: 0,
          penalties: 0,
        };
        existing.goals += 1;
        if (ev.type === "penalty_goal") existing.penalties += 1;
        map.set(key, existing);
      }
    });

    return [...map.values()].sort((a, b) => b.goals - a.goals || a.penalties - b.penalties);
  }, [divisionEvents, entries]);

  // --- 2. Top Playmakers (Assists) ---
  const topAssists = useMemo(() => {
    const map = new Map<string, { name: string; teamName: string; assists: number }>();

    divisionEvents.forEach((ev) => {
      if (ev.assistPlayerName) {
        const key = ev.assistPlayerId || ev.assistPlayerName;
        const entry = entries.find((e) => e.id === ev.entryId);
        const existing = map.get(key) || {
          name: ev.assistPlayerName,
          teamName: entry?.teamName || "Team",
          assists: 0,
        };
        existing.assists += 1;
        map.set(key, existing);
      }
    });

    return [...map.values()].sort((a, b) => b.assists - a.assists);
  }, [divisionEvents, entries]);

  // --- 3. Clean Sheets (Golden Glove) ---
  const cleanSheets = useMemo(() => {
    const map = new Map<string, { gkName: string; teamName: string; cleanSheets: number; conceded: number }>();

    const completed = divisionFixtures.filter((f) => f.status === "completed");
    completed.forEach((f) => {
      const homeEntry = entries.find((e) => e.id === f.homeEntryId);
      const awayEntry = entries.find((e) => e.id === f.awayEntryId);

      if (homeEntry) {
        const key = homeEntry.id;
        const gk = players.find((p) => p.clubId === homeEntry.clubId && p.position === "GK") || players.find((p) => p.position === "GK");
        const existing = map.get(key) || {
          gkName: gk ? `#${gk.jerseyNumber} ${gk.name}` : `${homeEntry.teamName} Goalkeeper`,
          teamName: homeEntry.teamName,
          cleanSheets: 0,
          conceded: 0,
        };
        existing.conceded += f.awayScore;
        if (f.awayScore === 0) existing.cleanSheets += 1;
        map.set(key, existing);
      }

      if (awayEntry) {
        const key = awayEntry.id;
        const gk = players.find((p) => p.clubId === awayEntry.clubId && p.position === "GK") || players.find((p) => p.position === "GK");
        const existing = map.get(key) || {
          gkName: gk ? `#${gk.jerseyNumber} ${gk.name}` : `${awayEntry.teamName} Goalkeeper`,
          teamName: awayEntry.teamName,
          cleanSheets: 0,
          conceded: 0,
        };
        existing.conceded += f.homeScore;
        if (f.homeScore === 0) existing.cleanSheets += 1;
        map.set(key, existing);
      }
    });

    return [...map.values()].sort((a, b) => b.cleanSheets - a.cleanSheets || a.conceded - b.conceded);
  }, [divisionFixtures, entries, players]);

  // --- 4. Fair Play & Discipline ---
  const disciplineRanking = useMemo(() => {
    const map = new Map<string, { teamName: string; yellows: number; reds: number; points: number }>();

    divisionEntries.forEach((entry) => {
      map.set(entry.id, { teamName: entry.teamName, yellows: 0, reds: 0, points: 0 });
    });

    divisionEvents.forEach((ev) => {
      const existing = map.get(ev.entryId);
      if (existing) {
        if (ev.type === "yellow_card") {
          existing.yellows += 1;
          existing.points += 1;
        } else if (ev.type === "red_card") {
          existing.reds += 1;
          existing.points += 3;
        }
      }
    });

    return [...map.values()].sort((a, b) => a.points - b.points); // lowest points = most disciplined
  }, [divisionEntries, divisionEvents]);

  // --- 5. POTM Awards ---
  const potmWinners = useMemo(() => {
    return divisionFixtures.filter((f) => f.potmPlayerName);
  }, [divisionFixtures]);

  return (
    <div className="space-y-6">
      {/* Header & Division Selector */}
      <div className="panel-card flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">
            <Award size={24} />
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Tournament Stats & Honors
            </span>
            <div className="flex items-center gap-2">
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="font-bold text-lg bg-transparent border-none focus:outline-none cursor-pointer text-foreground"
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id} className="bg-popover text-popover-foreground">
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats Sub-Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("scorers")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "scorers"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🥇 Golden Boot
          </button>
          <button
            onClick={() => setActiveTab("assists")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "assists"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎯 Playmaker
          </button>
          <button
            onClick={() => setActiveTab("cleansheets")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "cleansheets"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🧤 Clean Sheets
          </button>
          <button
            onClick={() => setActiveTab("discipline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "discipline"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🛡️ Fair Play
          </button>
        </div>
      </div>

      {/* 1. Golden Boot Tab */}
      {activeTab === "scorers" && (
        <div className="space-y-6">
          {/* Top 3 Podium Cards */}
          {topScorers.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Silver #2 */}
              <div className="panel-card p-5 rounded-2xl bg-card border border-border text-center space-y-2 order-2 md:order-1">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-300/20 text-slate-400 font-bold flex items-center justify-center text-lg">
                  🥈
                </div>
                <h3 className="font-extrabold text-base text-foreground">{topScorers[1].name}</h3>
                <span className="text-xs text-muted-foreground">{topScorers[1].teamName}</span>
                <div className="pt-2 font-mono font-black text-2xl text-primary">{topScorers[1].goals} Goals</div>
              </div>

              {/* Gold #1 */}
              <div className="panel-card p-6 rounded-2xl bg-gradient-to-b from-amber-500/15 to-card border border-amber-500/40 text-center space-y-2 order-1 md:order-2 shadow-lg shadow-amber-500/5">
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/20 text-amber-500 font-black flex items-center justify-center text-2xl">
                  🥇
                </div>
                <div className="flex items-center justify-center gap-1 text-amber-500 text-xs font-bold uppercase tracking-wider">
                  <Crown size={14} /> Golden Boot Leader
                </div>
                <h3 className="font-black text-lg sm:text-xl text-foreground">{topScorers[0].name}</h3>
                <span className="text-xs font-semibold text-muted-foreground">{topScorers[0].teamName}</span>
                <div className="pt-2 font-mono font-black text-3xl text-amber-500">{topScorers[0].goals} Goals</div>
              </div>

              {/* Bronze #3 */}
              <div className="panel-card p-5 rounded-2xl bg-card border border-border text-center space-y-2 order-3">
                <div className="w-10 h-10 mx-auto rounded-full bg-amber-700/20 text-amber-700 font-bold flex items-center justify-center text-lg">
                  🥉
                </div>
                <h3 className="font-extrabold text-base text-foreground">{topScorers[2].name}</h3>
                <span className="text-xs text-muted-foreground">{topScorers[2].teamName}</span>
                <div className="pt-2 font-mono font-black text-2xl text-primary">{topScorers[2].goals} Goals</div>
              </div>
            </div>
          )}

          {/* Full Scorers Table */}
          <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
            <h3 className="font-bold text-base text-foreground">Top Goalscorers Ranking</h3>
            {topScorers.length === 0 ? (
              <div className="text-sm text-muted-foreground italic py-8 text-center">
                No goals scored yet in this division.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Player</th>
                      <th className="py-2.5 px-3">Team / Club</th>
                      <th className="py-2.5 px-3 text-right">Penalties</th>
                      <th className="py-2.5 px-3 text-right">Total Goals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {topScorers.map((item, index) => (
                      <tr key={index} className="hover:bg-muted/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-muted-foreground">{index + 1}</td>
                        <td className="py-3 px-3 font-bold text-foreground flex items-center gap-1.5">
                          {index === 0 && <Crown size={14} className="text-amber-500" />}
                          {item.name}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{item.teamName}</td>
                        <td className="py-3 px-3 text-right font-mono text-muted-foreground">{item.penalties}</td>
                        <td className="py-3 px-3 text-right font-mono font-black text-primary text-base">
                          {item.goals}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Top Playmakers (Assists) Tab */}
      {activeTab === "assists" && (
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
          <h3 className="font-bold text-base text-foreground">Top Playmakers (Assists)</h3>
          {topAssists.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-8 text-center">
              No assists recorded yet in this division.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Player</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3 text-right">Assists</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topAssists.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-muted-foreground">{index + 1}</td>
                      <td className="py-3 px-3 font-bold text-foreground">{item.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{item.teamName}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-blue-500 text-base">
                        {item.assists}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. Clean Sheets Tab */}
      {activeTab === "cleansheets" && (
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
          <h3 className="font-bold text-base text-foreground">Golden Glove (Clean Sheets)</h3>
          {cleanSheets.length === 0 ? (
            <div className="text-sm text-muted-foreground italic py-8 text-center">
              Awaiting completed matches.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Team / Goalkeeper</th>
                    <th className="py-2.5 px-3 text-right">Goals Conceded</th>
                    <th className="py-2.5 px-3 text-right">Clean Sheets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cleanSheets.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-muted-foreground">{index + 1}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground">{item.gkName}</div>
                        <div className="text-xs text-muted-foreground">{item.teamName}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-muted-foreground">{item.conceded}</td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-500 text-base">
                        {item.cleanSheets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Discipline & Fair Play Tab */}
      {activeTab === "discipline" && (
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-foreground">Fair Play & Discipline Table</h3>
              <p className="text-xs text-muted-foreground">
                Ranked by lowest penalty points (Yellow = 1 pt, Red = 3 pts).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground text-left">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-3 text-center">🟨 Yellow Cards</th>
                  <th className="py-2.5 px-3 text-center">🟥 Red Cards</th>
                  <th className="py-2.5 px-3 text-right">Discipline Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {disciplineRanking.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-muted-foreground">{index + 1}</td>
                    <td className="py-3 px-3 font-bold text-foreground flex items-center gap-1.5">
                      {index === 0 && <Shield size={15} className="text-emerald-500" />}
                      {item.teamName}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-amber-500 font-bold">{item.yellows}</td>
                    <td className="py-3 px-3 text-center font-mono text-rose-500 font-bold">{item.reds}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-foreground">
                      {item.points} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POTM Awards Reel */}
      {potmWinners.length > 0 && (
        <div className="panel-card rounded-2xl p-5 bg-card border border-border space-y-3">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-amber-500 fill-amber-500" />
            <h3 className="font-bold text-base text-foreground">Player of the Match Highlights</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {potmWinners.map((f) => (
              <div
                key={f.id}
                className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-3"
              >
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                    {f.roundName}
                  </span>
                  <div className="font-extrabold text-sm text-foreground mt-0.5">{f.potmPlayerName}</div>
                </div>
                <Award size={24} className="text-amber-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
