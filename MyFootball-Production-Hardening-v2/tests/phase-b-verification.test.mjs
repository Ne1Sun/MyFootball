import assert from "node:assert/strict";
import test from "node:test";

import {
  getBracketCapacity,
  generateFoldedSeeds,
  buildKnockoutTree,
} from "../app/lib/bracket-tree.ts";

import {
  resolveGroupStandings,
  calculateFairPlayScore,
} from "../app/lib/standings-engine.ts";

import {
  computeSubstitutionState,
  validateSubstitutionAttempt,
} from "../app/lib/substitution-rules.ts";

import {
  validateSquadEligibility,
  extractAgeLimitFromDivisionName,
  computeCutoffDate,
  isPlayerAgeEligible,
} from "../app/lib/squad-rules.ts";

/* -------------------------------------------------------------------------- */
/* 1. Knockout Bracket Tree & Folded Seeding Tests                           */
/* -------------------------------------------------------------------------- */

test("bracket capacity computes smallest power of 2 >= N capped at 64", () => {
  assert.equal(getBracketCapacity(2), 2);
  assert.equal(getBracketCapacity(3), 4);
  assert.equal(getBracketCapacity(5), 8);
  assert.equal(getBracketCapacity(7), 8);
  assert.equal(getBracketCapacity(8), 8);
  assert.equal(getBracketCapacity(9), 16);
  assert.equal(getBracketCapacity(17), 32);
  assert.equal(getBracketCapacity(33), 64);
  assert.equal(getBracketCapacity(65), 64);
});

test("generateFoldedSeeds creates standard bracket seed pairings", () => {
  assert.deepEqual(generateFoldedSeeds(4), [1, 4, 2, 3]);
  assert.deepEqual(generateFoldedSeeds(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const seeds16 = generateFoldedSeeds(16);
  assert.equal(seeds16.length, 16);
  // Seed 1 pairs with 16, seed 4 pairs with 13 (top half)
  // Seed 2 pairs with 15, seed 3 pairs with 14 (bottom half)
  assert.equal(seeds16[0], 1);
  assert.equal(seeds16[1], 16);
  assert.equal(seeds16[4], 4);
  assert.equal(seeds16[5], 13);
  assert.equal(seeds16[8], 2);
  assert.equal(seeds16[9], 15);
});

test("buildKnockoutTree generates valid trees with byes and parent slots", () => {
  // 5 teams -> capacity 8 (Quarter-Finals: 4 matches, Semi-Finals: 2, Final: 1, 3rd Place: 1)
  const entries5 = ["team-1", "team-2", "team-3", "team-4", "team-5"];
  const blueprints5 = buildKnockoutTree(entries5);

  const qfMatches = blueprints5.filter((b) => b.bracketRound === "quarter_final");
  const sfMatches = blueprints5.filter((b) => b.bracketRound === "semi_final");
  const finalMatch = blueprints5.filter((b) => b.bracketRound === "final");
  const bronzeMatch = blueprints5.filter((b) => b.bracketRound === "third_place");

  assert.equal(qfMatches.length, 4, "8-bracket must have 4 quarter-finals");
  assert.equal(sfMatches.length, 2, "8-bracket must have 2 semi-finals");
  assert.equal(finalMatch.length, 1, "Must have 1 grand final");
  assert.equal(bronzeMatch.length, 1, "Must have 1 third place playoff");

  // 3 byes (seeds 1, 2, 3 receive byes against vacant 8, 7, 6)
  const byeMatches = qfMatches.filter((m) => m.isByeMatch);
  assert.equal(byeMatches.length, 3, "5 teams in 8-bracket must produce exactly 3 byes");

  // Verified auto-advancing teams for byes
  for (const bye of byeMatches) {
    assert.ok(bye.advancingEntryId, "Bye match must designate advancing entry ID");
    assert.ok(entries5.includes(bye.advancingEntryId), "Advancing team must be one of the entered teams");
  }
});

/* -------------------------------------------------------------------------- */
/* 2. AIFF 6-Tier Group Standings & Fair Play Engine Tests                    */
/* -------------------------------------------------------------------------- */

test("calculateFairPlayScore accurately applies FIFA/AIFF deduction matrix", () => {
  // Yellow (-1), 2nd Yellow (-3), Direct Red (-4), Yellow+Direct Red (-5)
  const events = [
    { id: "e1", fixtureId: "fix-1", entryId: "team-A", type: "yellow_card", playerId: "p1" },
    { id: "e2", fixtureId: "fix-1", entryId: "team-A", type: "yellow_card", playerId: "p2" },
    { id: "e3", fixtureId: "fix-1", entryId: "team-A", type: "yellow_card", playerId: "p2" }, // p2 gets 2nd yellow
    { id: "e4", fixtureId: "fix-2", entryId: "team-B", type: "red_card", playerId: "p3" }, // direct red
  ];

  const fpA = calculateFairPlayScore("team-A", events);
  // p1: 1 yellow = -1
  // p2: 2 yellows = -3
  // Total penalty = 4, score = -4
  assert.equal(fpA.score, -4);
  assert.equal(fpA.yellowCards, 3);

  const fpB = calculateFairPlayScore("team-B", events);
  // p3: direct red = -4
  assert.equal(fpB.score, -4);
  assert.equal(fpB.redCards, 1);
});

test("resolveGroupStandings resolves 3-way tie via Head-to-Head mini-league", () => {
  const entries = [
    { id: "A", divisionId: "div-1", teamName: "Team Alpha", groupName: "Group A" },
    { id: "B", divisionId: "div-1", teamName: "Team Beta", groupName: "Group A" },
    { id: "C", divisionId: "div-1", teamName: "Team Gamma", groupName: "Group A" },
    { id: "D", divisionId: "div-1", teamName: "Team Delta", groupName: "Group A" },
  ];

  // A beats B (2-0), B beats C (1-0), C beats A (2-1)
  // Everyone beats D (3-0)
  // Overall Points: A (6), B (6), C (6), D (0)
  // Head-to-Head mini-league among A, B, C:
  // A vs B: 2-0, A vs C: 1-2 -> A: 3 pts, GF 3, GA 2, GD +1
  // C vs A: 2-1, C vs B: 0-1 -> C: 3 pts, GF 2, GA 2, GD 0
  // B vs A: 0-2, B vs C: 1-0 -> B: 3 pts, GF 1, GA 2, GD -1
  const fixtures = [
    { id: "f1", divisionId: "div-1", homeEntryId: "A", awayEntryId: "B", homeScore: 2, awayScore: 0, status: "completed" },
    { id: "f2", divisionId: "div-1", homeEntryId: "B", awayEntryId: "C", homeScore: 1, awayScore: 0, status: "completed" },
    { id: "f3", divisionId: "div-1", homeEntryId: "C", awayEntryId: "A", homeScore: 2, awayScore: 1, status: "completed" },
    { id: "f4", divisionId: "div-1", homeEntryId: "A", awayEntryId: "D", homeScore: 3, awayScore: 0, status: "completed" },
    { id: "f5", divisionId: "div-1", homeEntryId: "B", awayEntryId: "D", homeScore: 3, awayScore: 0, status: "completed" },
    { id: "f6", divisionId: "div-1", homeEntryId: "C", awayEntryId: "D", homeScore: 3, awayScore: 0, status: "completed" },
  ];

  const standings = resolveGroupStandings(entries, fixtures, []);
  const groupA = standings["Group A"];

  assert.equal(groupA[0].entry.id, "A", "Team A must be 1st (H2H GD +1)");
  assert.equal(groupA[1].entry.id, "C", "Team C must be 2nd (H2H GD 0)");
  assert.equal(groupA[2].entry.id, "B", "Team B must be 3rd (H2H GD -1)");
  assert.equal(groupA[3].entry.id, "D", "Team D must be 4th (0 pts)");
});

test("resolveGroupStandings breaks identical records via Fair Play score", () => {
  const entries = [
    { id: "X", divisionId: "div-1", teamName: "Club X", groupName: "Group 1" },
    { id: "Y", divisionId: "div-1", teamName: "Club Y", groupName: "Group 1" },
  ];

  // Match: X vs Y 1 - 1
  const fixtures = [
    { id: "m1", divisionId: "div-1", homeEntryId: "X", awayEntryId: "Y", homeScore: 1, awayScore: 1, status: "completed" },
  ];

  // X has 1 yellow card (-1)
  // Y has 1 direct red card (-4)
  const events = [
    { id: "e1", fixtureId: "m1", entryId: "X", type: "yellow_card", playerId: "px" },
    { id: "e2", fixtureId: "m1", entryId: "Y", type: "red_card", playerId: "py" },
  ];

  const standings = resolveGroupStandings(entries, fixtures, events);
  const table = standings["Group 1"];

  assert.equal(table[0].entry.id, "X", "Club X should rank 1st due to superior Fair Play (-1 vs -4)");
  assert.equal(table[1].entry.id, "Y", "Club Y should rank 2nd");
  assert.equal(table[1].tieBreakerReason, "Fair Play Disciplinary Record");
});

/* -------------------------------------------------------------------------- */
/* 3. IFAB Law 3 Substitution State Machine Tests                             */
/* -------------------------------------------------------------------------- */

test("substitution state tracks maximum 5 substitutions and 3 in-play windows", () => {
  const teamId = "team-sub-test";

  // Scenario:
  // Sub 1: min 25 (first_half) -> Window 1
  // Sub 2: min 45 (half_time) -> Half-Time Exemption (no window consumed)
  // Sub 3: min 60 (second_half) -> Window 2
  // Sub 4: min 60 (second_half) -> Shares Window 2!
  // Sub 5: min 78 (second_half) -> Window 3
  const events = [
    { id: "s1", entryId: teamId, matchMinute: 25, matchPeriod: "first_half", type: "substitution" },
    { id: "s2", entryId: teamId, matchMinute: 45, matchPeriod: "half_time", type: "substitution" },
    { id: "s3", entryId: teamId, matchMinute: 60, matchPeriod: "second_half", type: "substitution" },
    { id: "s4", entryId: teamId, matchMinute: 60, matchPeriod: "second_half", type: "substitution" },
    { id: "s5", entryId: teamId, matchMinute: 78, matchPeriod: "second_half", type: "substitution" },
  ];

  const state = computeSubstitutionState(teamId, events, "second_half");
  assert.equal(state.usedSubs, 5, "Should have used 5 substitutions");
  assert.equal(state.remainingSubs, 0, "0 subs remaining");
  assert.equal(state.usedWindows, 3, "Should have used exactly 3 in-play windows (25', 60', 78')");
  assert.equal(state.remainingWindows, 0, "0 windows remaining");

  // Attempting 6th sub must be rejected
  const attempt6 = validateSubstitutionAttempt(teamId, events, 85, "second_half");
  assert.equal(attempt6.allowed, false, "6th substitution must be rejected");
  assert.match(attempt6.reason, /Maximum of 5 substitutions reached/);
});

test("substitution rejects 4th in-play window even if remaining substitutions exist", () => {
  const teamId = "team-window-test";

  // Team made only 3 substitutions, but each at a distinct in-play stoppage:
  // Sub 1: min 15 (first_half) -> Window 1
  // Sub 2: min 55 (second_half) -> Window 2
  // Sub 3: min 70 (second_half) -> Window 3
  const events = [
    { id: "s1", entryId: teamId, matchMinute: 15, matchPeriod: "first_half", type: "substitution" },
    { id: "s2", entryId: teamId, matchMinute: 55, matchPeriod: "second_half", type: "substitution" },
    { id: "s3", entryId: teamId, matchMinute: 70, matchPeriod: "second_half", type: "substitution" },
  ];

  const state = computeSubstitutionState(teamId, events, "second_half");
  assert.equal(state.usedSubs, 3);
  assert.equal(state.usedWindows, 3);
  assert.equal(state.isWindowExhausted, true);

  // Attempt 4th substitution at min 85 (new in-play stoppage)
  const attempt = validateSubstitutionAttempt(teamId, events, 85, "second_half");
  assert.equal(attempt.allowed, false, "4th in-play window must be rejected under IFAB Law 3");
  assert.match(attempt.reason, /All 3 in-play substitution windows exhausted/);

  // BUT if a sub is added at min 70 (same stoppage as Sub 3), it should be ALLOWED!
  const sharedWindowAttempt = validateSubstitutionAttempt(teamId, events, 70, "second_half");
  assert.equal(sharedWindowAttempt.allowed, true, "Sub at same stoppage shares window and must be allowed");
});

/* -------------------------------------------------------------------------- */
/* 4. AIFF Youth Squad & Starting XI Invariant Tests                          */
/* -------------------------------------------------------------------------- */

test("extractAgeLimitFromDivisionName correctly parses age limits", () => {
  assert.equal(extractAgeLimitFromDivisionName("Under-15 Boys Championship"), 15);
  assert.equal(extractAgeLimitFromDivisionName("U17 Youth League"), 17);
  assert.equal(extractAgeLimitFromDivisionName("U-13 Grassroots Cup"), 13);
  assert.equal(extractAgeLimitFromDivisionName("Open Senior Division"), null);
});

test("isPlayerAgeEligible enforces AIFF birthdate cutoffs", () => {
  const cutoff = computeCutoffDate(15, 2026); // "2011-01-01"
  assert.equal(cutoff, "2011-01-01");

  // Born in May 2011 -> eligible
  assert.equal(isPlayerAgeEligible("2011-05-14", cutoff).eligible, true);
  // Born in Jan 2011 -> eligible
  assert.equal(isPlayerAgeEligible("2011-01-01", cutoff).eligible, true);
  // Born in Dec 2010 -> overage (ineligible)
  const overage = isPlayerAgeEligible("2010-12-31", cutoff);
  assert.equal(overage.eligible, false);
  assert.match(overage.reason, /overage/);
});

test("validateSquadEligibility enforces exactly 1 GK, unique jerseys, and age cutoffs", () => {
  const division = {
    id: "div-u15",
    name: "Under-15 Championship",
    maxSquadSize: 18,
    requirePlayers: true,
  };

  const clubPlayers = [
    { id: "p1", name: "GK Ramesh", jerseyNumber: 1, position: "GK", dateOfBirth: "2011-04-10" },
    { id: "p2", name: "Defender Amit", jerseyNumber: 4, position: "DEF", dateOfBirth: "2011-06-15" },
    { id: "p3", name: "Midfielder Sunil", jerseyNumber: 8, position: "MID", dateOfBirth: "2011-08-20" },
    { id: "p4", name: "Forward Bhaichung", jerseyNumber: 10, position: "FWD", dateOfBirth: "2011-03-01" },
    { id: "p5", name: "Overage Player", jerseyNumber: 11, position: "FWD", dateOfBirth: "2009-01-01" },
  ];

  // Case A: Valid 4-player lineup with 1 GK, unique jerseys, eligible age
  const validSquad = [
    { playerId: "p1", isStarting: true },
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: false },
  ];
  const resValid = validateSquadEligibility(division, validSquad, clubPlayers, 2026);
  assert.equal(resValid.valid, true, "Eligible squad must pass");
  assert.equal(resValid.goalkeeperCount, 1);

  // Case B: Zero Goalkeepers in starting XI
  const noGkSquad = [
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
  ];
  const resNoGk = validateSquadEligibility(division, noGkSquad, clubPlayers, 2026);
  assert.equal(resNoGk.valid, false, "Squad without GK must fail");
  assert.match(resNoGk.errors[0], /exactly 1 Goalkeeper/);

  // Case C: Duplicate jersey numbers
  const dupJerseySquad = [
    { playerId: "p1", isStarting: true, jerseyNumberOverride: 10 },
    { playerId: "p2", isStarting: true, jerseyNumberOverride: 10 }, // duplicate #10
  ];
  const resDup = validateSquadEligibility(division, dupJerseySquad, clubPlayers, 2026);
  assert.equal(resDup.valid, false, "Squad with duplicate jerseys must fail");
  assert.ok(resDup.errors.some((e) => e.includes("Duplicate jersey number")));

  // Case D: Overage player included
  const overageSquad = [
    { playerId: "p1", isStarting: true },
    { playerId: "p5", isStarting: true }, // p5 born 2009 in U15
  ];
  const resOverage = validateSquadEligibility(division, overageSquad, clubPlayers, 2026);
  assert.equal(resOverage.valid, false, "Overage player must fail");
  assert.ok(resOverage.errors.some((e) => e.includes("overage")));
});
