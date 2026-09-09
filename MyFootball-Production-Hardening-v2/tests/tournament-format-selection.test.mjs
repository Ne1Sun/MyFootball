import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTeamFormat,
  getDefaultFormatSquadSize,
  getDefaultFormatMatchDuration,
  getRecommendedHalftime,
  getFormatDurationPresets,
  validateMatchDuration,
} from "../app/lib/competition.ts";

import { validateSquadEligibility } from "../app/lib/squad-rules.ts";

/* -------------------------------------------------------------------------- */
/* 1. Format Normalization & Safe Defaults                                    */
/* -------------------------------------------------------------------------- */

test("normalizeTeamFormat preserves standard format identifiers", () => {
  assert.equal(normalizeTeamFormat("5v5"), "5v5");
  assert.equal(normalizeTeamFormat("7v7"), "7v7");
  assert.equal(normalizeTeamFormat("11v11"), "11v11");
});

test("normalizeTeamFormat handles grassroots alias variations", () => {
  assert.equal(normalizeTeamFormat("5-a-side"), "5v5");
  assert.equal(normalizeTeamFormat("5aside"), "5v5");
  assert.equal(normalizeTeamFormat("5"), "5v5");
  assert.equal(normalizeTeamFormat("7-a-side"), "7v7");
  assert.equal(normalizeTeamFormat("7aside"), "7v7");
  assert.equal(normalizeTeamFormat("7"), "7v7");
});

test("normalizeTeamFormat safely collapses invalid, missing, or hostile input to 11v11", () => {
  assert.equal(normalizeTeamFormat(null), "11v11");
  assert.equal(normalizeTeamFormat(undefined), "11v11");
  assert.equal(normalizeTeamFormat(""), "11v11");
  assert.equal(normalizeTeamFormat("99v99"), "11v11");
  assert.equal(normalizeTeamFormat("0v0"), "11v11");
  assert.equal(normalizeTeamFormat("'; DROP TABLE tournaments; --"), "11v11");
  assert.equal(normalizeTeamFormat({}), "11v11");
  assert.equal(normalizeTeamFormat(["5v5"]), "11v11");
});

test("getDefaultFormatSquadSize provides adaptive squad ceilings", () => {
  assert.equal(getDefaultFormatSquadSize("5v5"), 10);
  assert.equal(getDefaultFormatSquadSize("7v7"), 14);
  assert.equal(getDefaultFormatSquadSize("11v11"), 18);
});

test("getDefaultFormatMatchDuration provides standard regulation match lengths", () => {
  assert.equal(getDefaultFormatMatchDuration("5v5"), 40);
  assert.equal(getDefaultFormatMatchDuration("7v7"), 50);
  assert.equal(getDefaultFormatMatchDuration("11v11"), 90);
});

/* -------------------------------------------------------------------------- */
/* 2. Squad Lineup Invariants by Match Format                                 */
/* -------------------------------------------------------------------------- */

const samplePlayers = [
  { id: "p1", name: "Player 1", jerseyNumber: 1, position: "GK", dateOfBirth: "2010-05-15" },
  { id: "p2", name: "Player 2", jerseyNumber: 2, position: "DEF", dateOfBirth: "2010-06-12" },
  { id: "p3", name: "Player 3", jerseyNumber: 3, position: "DEF", dateOfBirth: "2010-03-20" },
  { id: "p4", name: "Player 4", jerseyNumber: 4, position: "MID", dateOfBirth: "2010-07-08" },
  { id: "p5", name: "Player 5", jerseyNumber: 5, position: "MID", dateOfBirth: "2010-01-25" },
  { id: "p6", name: "Player 6", jerseyNumber: 6, position: "FWD", dateOfBirth: "2010-09-30" },
  { id: "p7", name: "Player 7", jerseyNumber: 7, position: "FWD", dateOfBirth: "2010-11-18" },
  { id: "p8", name: "Player 8", jerseyNumber: 8, position: "MID", dateOfBirth: "2010-04-05" },
  { id: "p9", name: "Player 9", jerseyNumber: 9, position: "FWD", dateOfBirth: "2010-08-14" },
  { id: "p10", name: "Player 10", jerseyNumber: 10, position: "MID", dateOfBirth: "2010-02-19" },
  { id: "p11", name: "Player 11", jerseyNumber: 11, position: "DEF", dateOfBirth: "2010-10-10" },
  { id: "p12", name: "Player 12", jerseyNumber: 12, position: "GK", dateOfBirth: "2010-12-01" },
];

test("5v5 division allows valid 5-player lineup with exactly 1 GK", () => {
  const division = {
    id: "div-5v5",
    name: "U-16 Futsal Cup",
    teamFormat: "5v5",
    maxSquadSize: 10,
  };

  const squad = [
    { playerId: "p1", isStarting: true }, // GK
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: true },
    { playerId: "p5", isStarting: true },
    { playerId: "p6", isStarting: false }, // sub
  ];

  const result = validateSquadEligibility(division, squad, samplePlayers, 2026);
  assert.equal(result.valid, true);
  assert.equal(result.startingCount, 5);
  assert.equal(result.substituteCount, 1);
  assert.equal(result.goalkeeperCount, 1);
});

test("5v5 division rejects starting lineup exceeding 5 players", () => {
  const division = {
    id: "div-5v5",
    name: "U-16 Futsal Cup",
    teamFormat: "5v5",
    maxSquadSize: 10,
  };

  const squad = [
    { playerId: "p1", isStarting: true }, // GK
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: true },
    { playerId: "p5", isStarting: true },
    { playerId: "p6", isStarting: true }, // 6th starter!
  ];

  const result = validateSquadEligibility(division, squad, samplePlayers, 2026);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((err) => err.includes("Maximum is 5 for 5v5 match format")));
});

test("7v7 division allows 7 starters and rejects 8 starters", () => {
  const division = {
    id: "div-7v7",
    name: "Senior 7v7 Grassroots League",
    teamFormat: "7v7",
    maxSquadSize: 14,
  };

  const validSquad = [
    { playerId: "p1", isStarting: true }, // GK
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: true },
    { playerId: "p5", isStarting: true },
    { playerId: "p6", isStarting: true },
    { playerId: "p7", isStarting: true },
  ];

  const validResult = validateSquadEligibility(division, validSquad, samplePlayers, 2026);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.startingCount, 7);

  const invalidSquad = [
    ...validSquad,
    { playerId: "p8", isStarting: true }, // 8th starter!
  ];

  const invalidResult = validateSquadEligibility(division, invalidSquad, samplePlayers, 2026);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.some((err) => err.includes("Maximum is 7 for 7v7 match format")));
});

test("11v11 division allows 11 starters and rejects 12 starters", () => {
  const division = {
    id: "div-11v11",
    name: "U-17 Premier Division",
    teamFormat: "11v11",
    maxSquadSize: 20,
  };

  const validSquad = [
    { playerId: "p1", isStarting: true }, // GK
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: true },
    { playerId: "p5", isStarting: true },
    { playerId: "p6", isStarting: true },
    { playerId: "p7", isStarting: true },
    { playerId: "p8", isStarting: true },
    { playerId: "p9", isStarting: true },
    { playerId: "p10", isStarting: true },
    { playerId: "p11", isStarting: true },
  ];

  const validResult = validateSquadEligibility(division, validSquad, samplePlayers, 2026);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.startingCount, 11);

  const invalidSquad = [
    ...validSquad,
    { playerId: "p12", isStarting: true, positionOverride: "FWD" }, // 12th starter
  ];

  const invalidResult = validateSquadEligibility(division, invalidSquad, samplePlayers, 2026);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.some((err) => err.includes("Maximum is 11 for 11v11 match format")));
});

test("squad pre-registration allows 0 designated starters across all formats", () => {
  for (const fmt of ["5v5", "7v7", "11v11"]) {
    const division = {
      id: `div-${fmt}`,
      name: `Tournament ${fmt}`,
      teamFormat: fmt,
      maxSquadSize: 18,
    };

    const roster = [
      { playerId: "p1", isStarting: false },
      { playerId: "p2", isStarting: false },
      { playerId: "p3", isStarting: false },
    ];

    const result = validateSquadEligibility(division, roster, samplePlayers, 2026);
    assert.equal(result.valid, true, `Expected valid roster registration for ${fmt}`);
    assert.equal(result.startingCount, 0);
  }
});

test("legacy division without teamFormat defaults safely to 11 starters ceiling", () => {
  const legacyDivision = {
    id: "legacy-div",
    name: "Legacy Mumbai Cup",
    maxSquadSize: 18,
  };

  const squad11 = [
    { playerId: "p1", isStarting: true },
    { playerId: "p2", isStarting: true },
    { playerId: "p3", isStarting: true },
    { playerId: "p4", isStarting: true },
    { playerId: "p5", isStarting: true },
    { playerId: "p6", isStarting: true },
    { playerId: "p7", isStarting: true },
    { playerId: "p8", isStarting: true },
    { playerId: "p9", isStarting: true },
    { playerId: "p10", isStarting: true },
    { playerId: "p11", isStarting: true },
  ];

  const result = validateSquadEligibility(legacyDivision, squad11, samplePlayers, 2026);
  assert.equal(result.valid, true);
  assert.equal(result.startingCount, 11);
});

/* -------------------------------------------------------------------------- */
/* 3. Custom Match Duration & Halftime Regulation Rules                       */
/* -------------------------------------------------------------------------- */

test("validateMatchDuration accepts even positive integers within [10, 180] minutes", () => {
  const validDurations = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 180];
  for (const duration of validDurations) {
    const result = validateMatchDuration(duration);
    assert.equal(result.valid, true, `Duration ${duration} should be valid`);
    assert.equal(result.value, duration);
    assert.equal(result.error, undefined);
  }

  // String numeric representation with trimming resilience
  assert.deepEqual(validateMatchDuration("60"), { valid: true, value: 60 });
  assert.deepEqual(validateMatchDuration(" 90 "), { valid: true, value: 90 });
});

test("validateMatchDuration strictly rejects odd positive integers violating divisibility by 2 invariant", () => {
  const oddDurations = [15, 25, 33, 45, 75, 91, 105];
  for (const duration of oddDurations) {
    const result = validateMatchDuration(duration);
    assert.equal(result.valid, false, `Odd duration ${duration} must be rejected`);
    assert.ok(result.error, "Error message must be present");
    assert.ok(
      result.error.includes("cleanly divisible by 2"),
      `Error message should specify divisibility by 2 invariant, got: ${result.error}`
    );
    assert.ok(
      result.error.includes(`${duration / 2} min halves are not permitted`),
      `Error should state that non-integer halves are prohibited`
    );
    assert.ok(
      result.error.includes(`Suggested: ${duration - 1} min or ${duration + 1} min`),
      `Error should offer nearest even alternatives`
    );
  }

  // Odd string numbers are also rejected
  const stringOdd = validateMatchDuration("45");
  assert.equal(stringOdd.valid, false);
  assert.ok(stringOdd.error.includes("cleanly divisible by 2"));
});

test("validateMatchDuration rejects floating point decimal durations", () => {
  const decimalDurations = [40.5, 45.2, 89.9, 12.345, 90.0001];
  for (const duration of decimalDurations) {
    const result = validateMatchDuration(duration);
    assert.equal(result.valid, false, `Decimal duration ${duration} must be rejected`);
    assert.equal(
      result.error,
      "Match duration must be a whole integer without decimals."
    );
  }

  // String decimal representation
  const stringDecimal = validateMatchDuration("40.5");
  assert.equal(stringDecimal.valid, false);
  assert.equal(
    stringDecimal.error,
    "Match duration must be a whole integer without decimals."
  );
});

test("validateMatchDuration strictly enforces domain boundary constraints (< 10 and > 180)", () => {
  const belowMinimum = [0, -2, -10, 8, 9, -90];
  for (const duration of belowMinimum) {
    const result = validateMatchDuration(duration);
    assert.equal(result.valid, false, `Duration ${duration} below 10 must be rejected`);
    assert.equal(result.error, "Match duration must be at least 10 minutes.");
  }

  const aboveMaximum = [182, 200, 1000, 9999];
  for (const duration of aboveMaximum) {
    const result = validateMatchDuration(duration);
    assert.equal(result.valid, false, `Duration ${duration} above 180 must be rejected`);
    assert.equal(result.error, "Match duration cannot exceed 180 minutes.");
  }
});

test("validateMatchDuration handles safe fallbacks and hostile/corrupt inputs", () => {
  // Safe fallbacks: undefined, null, empty string
  assert.deepEqual(validateMatchDuration(undefined), { valid: true, value: 90 });
  assert.deepEqual(validateMatchDuration(null), { valid: true, value: 90 });
  assert.deepEqual(validateMatchDuration(""), { valid: true, value: 90 });

  // Custom fallback propagation
  assert.deepEqual(validateMatchDuration(undefined, 40), { valid: true, value: 40 });
  assert.deepEqual(validateMatchDuration(null, 50), { valid: true, value: 50 });
  assert.deepEqual(validateMatchDuration("", 70), { valid: true, value: 70 });

  // Hostile / non-numeric inputs
  const corruptInputs = ["invalid", "abc", NaN, Infinity, -Infinity, {}, [], "'; DROP TABLE;"];
  for (const input of corruptInputs) {
    const result = validateMatchDuration(input);
    assert.equal(result.valid, false, `Input ${String(input)} must be rejected`);
    assert.equal(result.error, "Match duration must be a valid number in minutes.");
  }
});

test("getRecommendedHalftime provides adaptive recovery intervals based on match duration", () => {
  // T <= 40 -> 5 minutes
  assert.equal(getRecommendedHalftime(20), 5);
  assert.equal(getRecommendedHalftime(30), 5);
  assert.equal(getRecommendedHalftime(40), 5);

  // 40 < T <= 60 -> 10 minutes
  assert.equal(getRecommendedHalftime(42), 10);
  assert.equal(getRecommendedHalftime(50), 10);
  assert.equal(getRecommendedHalftime(60), 10);

  // T > 60 -> 15 minutes
  assert.equal(getRecommendedHalftime(70), 15);
  assert.equal(getRecommendedHalftime(80), 15);
  assert.equal(getRecommendedHalftime(90), 15);
  assert.equal(getRecommendedHalftime(100), 15);
  assert.equal(getRecommendedHalftime(120), 15);
});

test("getFormatDurationPresets supplies format-tailored even duration options", () => {
  assert.deepEqual(getFormatDurationPresets("5v5"), [20, 30, 40, 50]);
  assert.deepEqual(getFormatDurationPresets("7v7"), [40, 50, 60, 70]);
  assert.deepEqual(getFormatDurationPresets("11v11"), [60, 70, 80, 90]);

  // Ensure every single preset option satisfies the divisibility by 2 invariant
  for (const fmt of ["5v5", "7v7", "11v11"]) {
    const presets = getFormatDurationPresets(fmt);
    for (const duration of presets) {
      assert.ok(Number.isInteger(duration), `Preset ${duration} in ${fmt} must be an integer`);
      assert.equal(duration % 2, 0, `Preset ${duration} in ${fmt} must be divisible by 2`);
      assert.ok(duration >= 10 && duration <= 180, `Preset ${duration} must be in [10, 180]`);
      const validation = validateMatchDuration(duration);
      assert.equal(validation.valid, true, `Preset ${duration} must pass validation`);
    }
  }
});
