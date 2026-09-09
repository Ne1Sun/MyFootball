/**
 * AIFF / AFC / FIFA Group Standings & Disciplinary Tie-Breaking Engine
 *
 * Implements the official 6-tier tie-breaking protocol:
 * Tier 1: Greater number of points obtained in all group matches.
 * Tier 2: Greater number of points obtained in matches between the teams concerned (Head-to-head points).
 * Tier 3: Superior goal difference in matches between the teams concerned (Head-to-head GD).
 * Tier 4: Greater number of goals scored in matches between the teams concerned (Head-to-head GF).
 * Tier 5: If still equal after Tiers 2–4, reapply Tiers 2–4 exclusively to the subset of teams still tied.
 *         If still equal:
 *         Tier 5a: Superior goal difference in all group matches (Overall GD).
 *         Tier 5b: Greater number of goals scored in all group matches (Overall GF).
 * Tier 6: Fair Play disciplinary ranking across all group matches (fewer penalty points).
 * Tier 7: Drawing of lots / stable seed fallback.
 */

export interface GroupTeamEntry {
  id: string;
  divisionId: string;
  teamId?: string;
  teamName?: string;
  clubName?: string;
  groupName?: string;
  seed?: number | null;
  city?: string;
}

export interface GroupFixtureMatch {
  id: string;
  divisionId: string;
  homeEntryId: string;
  awayEntryId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  stage?: string;
}

export interface MatchEventRecord {
  id: string;
  fixtureId: string;
  entryId: string;
  type: string; // "yellow_card" | "red_card" | etc.
  playerId?: string | null;
  matchMinute?: number;
}

export interface TeamStandingsRow {
  entry: GroupTeamEntry;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  fairPlayScore: number;
  yellowCards: number;
  redCards: number;
  form: Array<"W" | "D" | "L">;
  tieBreakerReason?: string;
}

/**
 * Calculates Fair Play disciplinary score for a team based on yellow/red card events.
 * AIFF / FIFA Matrix:
 * - Yellow card: -1 pt
 * - Indirect red card (second yellow card): -3 pts
 * - Direct red card: -4 pts
 * - Yellow card + direct red card: -5 pts
 *
 * Higher score (closer to 0) means better disciplinary record.
 */
export function calculateFairPlayScore(
  teamEntryId: string,
  events: MatchEventRecord[],
  fixtureIds: string[] = []
): { score: number; yellowCards: number; redCards: number } {
  const fixtureIdSet = fixtureIds.length > 0 ? new Set(fixtureIds) : null;
  const teamEvents = events.filter(
    (e) => e.entryId === teamEntryId && (!fixtureIdSet || fixtureIdSet.has(e.fixtureId))
  );

  let yellowCards = 0;
  let redCards = 0;
  let penaltyPoints = 0;

  // Group events by fixture and player to accurately identify 2nd yellows vs direct reds
  const fixturePlayerMap = new Map<string, { yellows: number; reds: number }>();

  for (const e of teamEvents) {
    if (e.type !== "yellow_card" && e.type !== "red_card") continue;
    const playerKey = `${e.fixtureId}_${e.playerId || "unknown"}`;
    const stats = fixturePlayerMap.get(playerKey) || { yellows: 0, reds: 0 };

    if (e.type === "yellow_card") {
      stats.yellows += 1;
      yellowCards += 1;
    } else if (e.type === "red_card") {
      stats.reds += 1;
      redCards += 1;
    }
    fixturePlayerMap.set(playerKey, stats);
  }

  for (const stats of fixturePlayerMap.values()) {
    if (stats.yellows === 1 && stats.reds === 0) {
      penaltyPoints += 1; // 1 yellow
    } else if (stats.yellows >= 2 && stats.reds === 0) {
      penaltyPoints += 3; // 2nd yellow (indirect red)
    } else if (stats.yellows === 0 && stats.reds >= 1) {
      penaltyPoints += 4; // direct red
    } else if (stats.yellows >= 1 && stats.reds >= 1) {
      penaltyPoints += 5; // yellow + direct red
    }
  }

  return {
    score: -penaltyPoints,
    yellowCards,
    redCards,
  };
}

/**
 * Computes base match record statistics (P, W, D, L, GF, GA, GD, PTS) from completed fixtures.
 */
export function computeBaseStandings(
  entries: GroupTeamEntry[],
  completedFixtures: GroupFixtureMatch[],
  events: MatchEventRecord[] = [],
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0
): Map<string, TeamStandingsRow> {
  const map = new Map<string, TeamStandingsRow>();
  const completedFixtureIds = completedFixtures.map((f) => f.id);

  for (const entry of entries) {
    const fp = calculateFairPlayScore(entry.id, events, completedFixtureIds);
    map.set(entry.id, {
      entry,
      p: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
      fairPlayScore: fp.score,
      yellowCards: fp.yellowCards,
      redCards: fp.redCards,
      form: [],
    });
  }

  for (const f of completedFixtures) {
    const home = map.get(f.homeEntryId);
    const away = map.get(f.awayEntryId);
    if (!home || !away) continue;

    home.p += 1;
    away.p += 1;
    home.gf += f.homeScore;
    home.ga += f.awayScore;
    away.gf += f.awayScore;
    away.ga += f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.w += 1;
      away.l += 1;
      home.pts += winPoints;
      away.pts += lossPoints;
      home.form.push("W");
      away.form.push("L");
    } else if (f.homeScore < f.awayScore) {
      away.w += 1;
      home.l += 1;
      away.pts += winPoints;
      home.pts += lossPoints;
      away.form.push("W");
      away.form.push("L");
    } else {
      home.d += 1;
      away.d += 1;
      home.pts += drawPoints;
      away.pts += drawPoints;
      home.form.push("D");
      away.form.push("D");
    }
  }

  for (const row of map.values()) {
    row.gd = row.gf - row.ga;
  }

  return map;
}

interface MiniLeagueStats {
  pts: number;
  gd: number;
  gf: number;
}

/**
 * Computes head-to-head statistics exclusively for matches between a tied subset of teams.
 */
function computeHeadToHeadMiniLeague(
  teamIds: string[],
  completedFixtures: GroupFixtureMatch[],
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0
): Map<string, MiniLeagueStats> {
  const set = new Set(teamIds);
  const statsMap = new Map<string, MiniLeagueStats>();
  for (const id of teamIds) {
    statsMap.set(id, { pts: 0, gd: 0, gf: 0 });
  }

  // Only consider matches where BOTH teams are in the tied set
  const headToHeadMatches = completedFixtures.filter(
    (f) => set.has(f.homeEntryId) && set.has(f.awayEntryId)
  );

  for (const f of headToHeadMatches) {
    const home = statsMap.get(f.homeEntryId)!;
    const away = statsMap.get(f.awayEntryId)!;

    home.gf += f.homeScore;
    home.gd += f.homeScore - f.awayScore;
    away.gf += f.awayScore;
    away.gd += f.awayScore - f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.pts += winPoints;
      away.pts += lossPoints;
    } else if (f.homeScore < f.awayScore) {
      away.pts += winPoints;
      home.pts += lossPoints;
    } else {
      home.pts += drawPoints;
      away.pts += drawPoints;
    }
  }

  return statsMap;
}

/**
 * Resolves ties within a cluster of teams having identical overall points.
 * Implements recursive AIFF subset re-application (Tiers 2-4 -> 5 -> 6 -> 7).
 */
function breakTie(
  tiedRows: TeamStandingsRow[],
  completedFixtures: GroupFixtureMatch[],
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0
): TeamStandingsRow[] {
  if (tiedRows.length <= 1) return tiedRows;

  const teamIds = tiedRows.map((r) => r.entry.id);
  const h2h = computeHeadToHeadMiniLeague(teamIds, completedFixtures, winPoints, drawPoints, lossPoints);

  // Compare using Tiers 2-4
  const sorted = [...tiedRows].sort((a, b) => {
    const aH2H = h2h.get(a.entry.id)!;
    const bH2H = h2h.get(b.entry.id)!;

    // Tier 2: Head-to-Head Points
    if (bH2H.pts !== aH2H.pts) {
      return bH2H.pts - aH2H.pts;
    }
    // Tier 3: Head-to-Head Goal Difference
    if (bH2H.gd !== aH2H.gd) {
      return bH2H.gd - aH2H.gd;
    }
    // Tier 4: Head-to-Head Goals Scored
    if (bH2H.gf !== aH2H.gf) {
      return bH2H.gf - aH2H.gf;
    }
    return 0;
  });

  // Check if Tiers 2-4 resolved all or some ties
  // Group into subgroups by identical H2H (pts, gd, gf)
  const subGroups = new Map<string, TeamStandingsRow[]>();
  for (const row of sorted) {
    const stats = h2h.get(row.entry.id)!;
    const key = `${stats.pts}_${stats.gd}_${stats.gf}`;
    const group = subGroups.get(key) || [];
    group.push(row);
    subGroups.set(key, group);
  }

  // If H2H broke some teams apart (e.g. 3 teams reduced to 1 distinct and 2 tied),
  // reapply to smaller tied groups (Tier 5)
  if (subGroups.size > 1) {
    const result: TeamStandingsRow[] = [];
    for (const group of subGroups.values()) {
      if (group.length === 1) {
        group[0].tieBreakerReason = "H2H Record";
        result.push(group[0]);
      } else {
        // Recursively reapply to the smaller tied subset
        const resolvedSubset = breakTie(group, completedFixtures, winPoints, drawPoints, lossPoints);
        result.push(...resolvedSubset);
      }
    }
    return result;
  }

  // If Tiers 2-4 were completely equal for all teams in the cluster:
  // Proceed to Tier 5a (Overall GD), Tier 5b (Overall GF), Tier 6 (Fair Play), Tier 7 (Seed/Name)
  const remainingSorted = [...tiedRows].sort((a, b) => {
    // Tier 5a: Overall GD
    if (b.gd !== a.gd) return b.gd - a.gd;
    // Tier 5b: Overall GF
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Tier 6: Fair Play Score (higher is better)
    if (b.fairPlayScore !== a.fairPlayScore) return b.fairPlayScore - a.fairPlayScore;
    // Tier 7: Stable fallback (seed or name)
    const seedA = a.entry.seed ?? 999;
    const seedB = b.entry.seed ?? 999;
    if (seedA !== seedB) return seedA - seedB;
    return (a.entry.teamName || a.entry.id).localeCompare(b.entry.teamName || b.entry.id);
  });

  // Assign tie breaker reason
  for (let i = 0; i < remainingSorted.length; i++) {
    const curr = remainingSorted[i];
    const prev = remainingSorted[i - 1];
    if (prev && prev.pts === curr.pts) {
      if (prev.gd !== curr.gd) curr.tieBreakerReason = "Overall Goal Difference";
      else if (prev.gf !== curr.gf) curr.tieBreakerReason = "Overall Goals Scored";
      else if (prev.fairPlayScore !== curr.fairPlayScore) curr.tieBreakerReason = "Fair Play Disciplinary Record";
      else curr.tieBreakerReason = "Tournament Seeding / Draw";
    }
  }

  return remainingSorted;
}

/**
 * Main Entry Point: Resolves group standings for a division according to the official AIFF 6-tier protocol.
 */
export function resolveGroupStandings(
  entries: GroupTeamEntry[],
  fixtures: GroupFixtureMatch[],
  events: MatchEventRecord[] = [],
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0
): Record<string, TeamStandingsRow[]> {
  const completedFixtures = fixtures.filter((f) => f.status === "completed");
  const baseMap = computeBaseStandings(entries, completedFixtures, events, winPoints, drawPoints, lossPoints);

  // Group by groupName (e.g. "Group A", "Group B")
  const groups: Record<string, TeamStandingsRow[]> = {};
  for (const row of baseMap.values()) {
    const gName = row.entry.groupName || "Group A";
    if (!groups[gName]) groups[gName] = [];
    groups[gName].push(row);
  }

  const resolvedGroups: Record<string, TeamStandingsRow[]> = {};

  for (const [groupName, groupRows] of Object.entries(groups)) {
    // 1. Group rows by Tier 1 points
    const pointsMap = new Map<number, TeamStandingsRow[]>();
    for (const row of groupRows) {
      const list = pointsMap.get(row.pts) || [];
      list.push(row);
      pointsMap.set(row.pts, list);
    }

    // 2. Sort point tiers descending
    const sortedPoints = Array.from(pointsMap.keys()).sort((a, b) => b - a);

    const finalGroupOrder: TeamStandingsRow[] = [];

    // 3. For each point cluster, break ties using AIFF Tiers 2–7
    for (const pts of sortedPoints) {
      const tiedCluster = pointsMap.get(pts)!;
      if (tiedCluster.length === 1) {
        finalGroupOrder.push(tiedCluster[0]);
      } else {
        const groupMatches = completedFixtures.filter((f) => {
          const home = baseMap.get(f.homeEntryId);
          const away = baseMap.get(f.awayEntryId);
          return home?.entry.groupName === groupName && away?.entry.groupName === groupName;
        });
        const resolvedTie = breakTie(tiedCluster, groupMatches, winPoints, drawPoints, lossPoints);
        finalGroupOrder.push(...resolvedTie);
      }
    }

    resolvedGroups[groupName] = finalGroupOrder;
  }

  return resolvedGroups;
}
