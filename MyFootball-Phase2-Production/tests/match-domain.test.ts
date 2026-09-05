import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateShootout,
  canStartShootout,
  deriveKnockoutResult,
  validateMatchTransition,
  type MatchSnapshot,
} from "../app/lib/match-domain.ts";

const match = (overrides: Partial<MatchSnapshot> = {}): MatchSnapshot => ({
  stage: "knockout",
  status: "in_progress",
  period: "second_half",
  homeEntryId: "home",
  awayEntryId: "away",
  homeScore: 1,
  awayScore: 0,
  homeScorePenalties: 0,
  awayScorePenalties: 0,
  ...overrides,
});

test("derives a knockout winner from the verified score", () => {
  assert.deepEqual(deriveKnockoutResult(match()), {
    winnerEntryId: "home",
    loserEntryId: "away",
  });
});

test("rejects a level knockout result without a shootout winner", () => {
  assert.throws(
    () => deriveKnockoutResult(match({ homeScore: 1, awayScore: 1 })),
    /cannot finish level/i,
  );
});

test("permits shootouts only for tied active knockout matches after normal time", () => {
  assert.equal(canStartShootout(match({ homeScore: 2, awayScore: 2 })), true);
  assert.equal(canStartShootout(match({ stage: "group", homeScore: 2, awayScore: 2 })), false);
  assert.equal(canStartShootout(match({ period: "first_half", homeScore: 2, awayScore: 2 })), false);
});

test("blocks impossible match state transitions", () => {
  assert.doesNotThrow(() =>
    validateMatchTransition(
      match({ status: "scheduled", period: "scheduled" }),
      "in_progress",
      "first_half",
    ),
  );
  assert.throws(
    () => validateMatchTransition(match({ status: "scheduled", period: "scheduled" }), "completed", "completed"),
    /invalid match transition/i,
  );
});

test("finishes a five-kick shootout only when the result is mathematically decided", () => {
  const state = calculateShootout([
    { isHome: true, scored: true },
    { isHome: false, scored: false },
    { isHome: true, scored: true },
    { isHome: false, scored: false },
    { isHome: true, scored: true },
    { isHome: false, scored: false },
  ]);
  assert.equal(state.isFinished, true);
  assert.equal(state.winner, "home");
});
