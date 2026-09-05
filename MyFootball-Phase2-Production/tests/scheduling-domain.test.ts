import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTournamentSchedule,
  roundRobinPairings,
  scheduleConflict,
} from "../app/lib/scheduling.ts";
import { validateTournamentTransition } from "../app/lib/tournament-domain.ts";

const rules = {
  startDate: "2026-10-10",
  durationDays: 2,
  firstKickoffTime: "09:00",
  dayEndTime: "18:00",
  matchDurationMinutes: 60,
  bufferMinutes: 15,
  minimumRestMinutes: 60,
  pitchCount: 2,
  longBreakAfterMatches: 0,
  longBreakMinutes: 0,
};

test("round-robin rounds never schedule a team twice and support two legs", () => {
  const pairings = roundRobinPairings(["a", "b", "c", "d"], { legs: 2 });
  assert.equal(pairings.length, 12);
  for (const round of new Set(pairings.map((pairing) => pairing.round))) {
    const teams = pairings.filter((pairing) => pairing.round === round).flatMap((pairing) => [pairing.home, pairing.away]);
    assert.equal(new Set(teams).size, teams.length);
  }
  const first = pairings[0];
  assert.ok(pairings.some((pairing) => pairing.home === first.away && pairing.away === first.home));
});

test("generated schedules enforce team rest while using parallel pitches", () => {
  const pairings = roundRobinPairings(["a", "b", "c", "d"]);
  const schedule = buildTournamentSchedule(pairings, rules);
  assert.equal(schedule.length, 6);
  assert.equal(new Set(schedule.filter((item) => item.round === 1).map((item) => item.kickoffAt)).size, 1);
  const aMatches = schedule.filter((item) => item.home === "a" || item.away === "a");
  for (let index = 1; index < aMatches.length; index += 1) {
    const gap = new Date(aMatches[index].kickoffAt).getTime() - new Date(aMatches[index - 1].kickoffAt).getTime();
    assert.ok(gap >= 120 * 60_000);
  }
});

test("pitch bookings from another division are treated as unavailable", () => {
  const schedule = buildTournamentSchedule(
    [{ round: 1, roundName: "Final", stage: "knockout", home: "a", away: "b" }],
    { ...rules, pitchCount: 1 },
    [{ kickoffAt: "2026-10-10T03:30:00.000Z", pitch: 1, durationMinutes: 60, bufferMinutes: 15 }],
  );
  assert.equal(schedule[0].kickoffAt, "2026-10-10T04:45:00.000Z");
});

test("future knockout rounds respect rest from the completed round", () => {
  const schedule = buildTournamentSchedule(
    [{ round: 1, roundName: "Final", stage: "knockout", home: "a", away: "b" }],
    { ...rules, startDate: "2026-10-11", durationDays: 2, minimumRestMinutes: 1440 },
    [{
      kickoffAt: "2026-10-10T12:30:00.000Z",
      pitch: 1,
      durationMinutes: 60,
      bufferMinutes: 15,
      homeEntryId: "a",
      awayEntryId: "c",
    }],
  );
  assert.equal(schedule[0].kickoffAt, "2026-10-12T03:30:00.000Z");
});

test("rescheduling rejects pitch clashes and insufficient team rest", () => {
  const existing = [{
    id: "existing",
    kickoffAt: "2026-10-10T03:30:00.000Z",
    pitch: 1,
    homeEntryId: "a",
    awayEntryId: "c",
    durationMinutes: 60,
    bufferMinutes: 15,
    status: "scheduled",
  }];
  assert.match(scheduleConflict({
    fixtureId: "candidate",
    kickoffAt: "2026-10-10T04:00:00.000Z",
    pitch: 1,
    homeEntryId: "b",
    awayEntryId: "d",
    durationMinutes: 60,
    minimumRestMinutes: 60,
    bufferMinutes: 15,
  }, existing) || "", /pitch/i);
  assert.match(scheduleConflict({
    fixtureId: "candidate",
    kickoffAt: "2026-10-10T04:45:00.000Z",
    pitch: 2,
    homeEntryId: "a",
    awayEntryId: "d",
    durationMinutes: 60,
    minimumRestMinutes: 60,
    bufferMinutes: 15,
  }, existing) || "", /rest/i);
});

test("tournament lifecycle blocks skipping scheduling and premature completion", () => {
  assert.throws(() => validateTournamentTransition({
    current: "registration_closed",
    next: "live",
    hasFixtures: false,
    allCompetitionFixturesComplete: false,
    registrationDeadlinePassed: false,
  }), /cannot move|generate fixtures/i);
  assert.throws(() => validateTournamentTransition({
    current: "live",
    next: "completed",
    hasFixtures: true,
    allCompetitionFixturesComplete: false,
    registrationDeadlinePassed: true,
  }), /must be completed/i);
});
