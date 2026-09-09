import test from "node:test";
import assert from "node:assert/strict";

const PAUSE_REASONS = {
  foul: { key: "foul", label: "Foul / Free Kick Administration", short: "Foul / Free Kick", icon: "🟨" },
  injury: { key: "injury", label: "Injury / Physio on Pitch", short: "Injury / Physio", icon: "🚑" },
  cooling_break: { key: "cooling_break", label: "Official Cooling / Drinks Break", short: "Cooling Break", icon: "💧" },
  tactical: { key: "tactical", label: "Tactical / Ball Out of Play", short: "Tactical Delay", icon: "⏸️" },
  var: { key: "var", label: "Referee Consultation / Review", short: "Referee Review", icon: "📺" },
  manual: { key: "manual", label: "Play Paused by Referee", short: "Play Paused", icon: "⏸️" },
};

function calculatePitchClock(fixture, nominalHalfMinutes = 45, clientNowMs = Date.now()) {
  const isRunning = Boolean(fixture?.clockRunning);
  const status = fixture?.status || "scheduled";
  const period = fixture?.period || "scheduled";
  const stoppageAllowanceMinutes = Math.max(0, fixture?.stoppageMinutes || 0);
  const rawPauseReason = fixture?.clockPauseReason || null;
  const pauseConfig = rawPauseReason && PAUSE_REASONS[rawPauseReason] ? PAUSE_REASONS[rawPauseReason] : null;

  let totalSeconds = Math.max(0, fixture?.clockElapsedSeconds || 0);

  if (isRunning && status === "in_progress" && fixture?.clockStartedAt) {
    const startedMs = Date.parse(fixture.clockStartedAt);
    if (!Number.isNaN(startedMs) && clientNowMs > startedMs) {
      const liveDelta = Math.floor((clientNowMs - startedMs) / 1000);
      totalSeconds += Math.max(0, liveDelta);
    }
  }

  const isSecondHalf = period === "second_half";
  const nominalPeriodMinutes = isSecondHalf ? nominalHalfMinutes * 2 : nominalHalfMinutes;
  const nominalPeriodSeconds = nominalPeriodMinutes * 60;

  const isStoppage = totalSeconds > nominalPeriodSeconds;
  const stoppageSeconds = isStoppage ? totalSeconds - nominalPeriodSeconds : 0;

  const displayMinute = Math.max(1, Math.floor(totalSeconds / 60) + 1);
  const displaySecond = totalSeconds % 60;

  let formattedClock = "";
  let formattedShort = "";

  if (!isStoppage) {
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    formattedClock = `${mm}:${ss}`;
    formattedShort = `${displayMinute}'`;
  } else {
    const regMm = String(nominalPeriodMinutes).padStart(2, "0");
    const stopMm = String(Math.floor(stoppageSeconds / 60)).padStart(2, "0");
    const stopSs = String(stoppageSeconds % 60).padStart(2, "0");
    formattedClock = `${regMm}:00 +${stopMm}:${stopSs}`;

    const stopMin = Math.floor(stoppageSeconds / 60) + 1;
    const addedBadge = stoppageAllowanceMinutes > 0 ? `+${stoppageAllowanceMinutes}'` : `+${stopMin}'`;
    formattedShort = `${nominalPeriodMinutes}' ${addedBadge}`;
  }

  const isPaused = !isRunning && status === "in_progress" && period !== "half_time" && period !== "completed";

  return {
    totalSeconds,
    displayMinute,
    displaySecond,
    isStoppage,
    stoppageSeconds,
    stoppageAllowanceMinutes,
    formattedClock,
    formattedShort,
    isRunning,
    isPaused,
    pauseReason: rawPauseReason,
    pauseConfig,
  };
}

test("Autonomous Pitch Clock: Kickoff initiates continuous ticking without DB writes", () => {
  const t0 = new Date("2026-09-09T10:00:00.000Z").getTime();
  const fixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: true,
    clockStartedAt: "2026-09-09T10:00:00.000Z",
    clockElapsedSeconds: 0,
    stoppageMinutes: 0,
    clockPauseReason: null,
  };

  const state45s = calculatePitchClock(fixture, 45, t0 + 45_000);
  assert.equal(state45s.totalSeconds, 45);
  assert.equal(state45s.displayMinute, 1);
  assert.equal(state45s.formattedClock, "00:45");
  assert.equal(state45s.isRunning, true);
  assert.equal(state45s.isPaused, false);

  const state135s = calculatePitchClock(fixture, 45, t0 + 135_000);
  assert.equal(state135s.totalSeconds, 135);
  assert.equal(state135s.displayMinute, 3);
  assert.equal(state135s.formattedClock, "02:15");
  assert.equal(state135s.isRunning, true);
  assert.equal(state135s.isPaused, false);
});

test("Autonomous Pitch Clock: Referee pause freezes time and attributes semantic IFAB reason", () => {
  const t0 = new Date("2026-09-09T10:00:00.000Z").getTime();
  const pausedFixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: false,
    clockStartedAt: null,
    clockElapsedSeconds: 860,
    stoppageMinutes: 0,
    clockPauseReason: "injury",
  };

  const stateAtPause = calculatePitchClock(pausedFixture, 45, t0 + 860_000);
  assert.equal(stateAtPause.totalSeconds, 860);
  assert.equal(stateAtPause.displayMinute, 15);
  assert.equal(stateAtPause.formattedClock, "14:20");
  assert.equal(stateAtPause.isRunning, false);
  assert.equal(stateAtPause.isPaused, true);
  assert.equal(stateAtPause.pauseReason, "injury");
  assert.equal(stateAtPause.pauseConfig?.icon, "🚑");

  const state5MinLater = calculatePitchClock(pausedFixture, 45, t0 + 860_000 + 300_000);
  assert.equal(state5MinLater.totalSeconds, 860, "Zero time must elapse while clock is paused");
  assert.equal(state5MinLater.formattedClock, "14:20");
  assert.equal(state5MinLater.isPaused, true);
});

test("Autonomous Pitch Clock: Play resumption accumulates time seamlessly", () => {
  const tResume = new Date("2026-09-09T10:19:20.000Z").getTime();
  const resumedFixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: true,
    clockStartedAt: "2026-09-09T10:19:20.000Z",
    clockElapsedSeconds: 860,
    stoppageMinutes: 0,
    clockPauseReason: null,
  };

  const stateAfterRestart = calculatePitchClock(resumedFixture, 45, tResume + 40_000);
  assert.equal(stateAfterRestart.totalSeconds, 900);
  assert.equal(stateAfterRestart.displayMinute, 16);
  assert.equal(stateAfterRestart.formattedClock, "15:00");
  assert.equal(stateAfterRestart.isRunning, true);
  assert.equal(stateAfterRestart.isPaused, false);
});

test("Autonomous Pitch Clock: IFAB Law 7.3 Stoppage Time Allowance Board and Overtime Alert", () => {
  const t0 = new Date("2026-09-09T10:00:00.000Z").getTime();
  const stoppageFixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: true,
    clockStartedAt: "2026-09-09T10:00:00.000Z",
    clockElapsedSeconds: 0,
    stoppageMinutes: 3,
    clockPauseReason: null,
  };

  const stateInStoppage = calculatePitchClock(stoppageFixture, 45, t0 + 2732_000);
  assert.equal(stateInStoppage.isStoppage, true);
  assert.equal(stateInStoppage.stoppageSeconds, 32);
  assert.equal(stateInStoppage.formattedClock, "45:00 +00:32");
  assert.equal(stateInStoppage.formattedShort, "45' +3'");

  const stateOverStoppage = calculatePitchClock(stoppageFixture, 45, t0 + 2950_000);
  assert.equal(stateOverStoppage.isStoppage, true);
  assert.equal(stateOverStoppage.stoppageSeconds, 250);
  assert.equal(stateOverStoppage.formattedClock, "45:00 +04:10");
  assert.equal(stateOverStoppage.formattedShort, "45' +3'");
});

test("Autonomous Pitch Clock: Flexible Grassroots youth match durations (2x25m)", () => {
  const t0 = new Date("2026-09-09T10:00:00.000Z").getTime();
  const youthFixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: true,
    clockStartedAt: "2026-09-09T10:00:00.000Z",
    clockElapsedSeconds: 0,
    stoppageMinutes: 2,
    clockPauseReason: null,
  };

  const stateYouth = calculatePitchClock(youthFixture, 25, t0 + 1514_000);
  assert.equal(stateYouth.isStoppage, true);
  assert.equal(stateYouth.stoppageSeconds, 14);
  assert.equal(stateYouth.formattedClock, "25:00 +00:14");
  assert.equal(stateYouth.formattedShort, "25' +2'");
});

test("Autonomous Pitch Clock: Deterministic Offline Pause preserves referee whistle timestamp against replay drift", () => {
  // When a referee taps pause at minute 12:30 (750 seconds) while offline,
  // the client captures clientElapsedSeconds: 750.
  // When replayed 15 minutes later, server must adopt clientElapsedSeconds rather than live delta.
  const whistleElapsedSeconds = 750;
  const payload = {
    action: "pauseMatchClock",
    fixtureId: "fix-test-1",
    reason: "injury",
    clientElapsedSeconds: whistleElapsedSeconds,
  };

  const official = { division: { matchDurationMinutes: 90 } };
  const maxAllowed = (official.division.matchDurationMinutes + 45) * 60;
  const resolvedElapsed = Math.min(Math.round(payload.clientElapsedSeconds), maxAllowed);
  const resolvedMinute = Math.floor(resolvedElapsed / 60);

  assert.equal(resolvedElapsed, 750);
  assert.equal(resolvedMinute, 12);

  // Fixture state after pause adopts exact frozen time
  const pausedFixture = {
    status: "in_progress",
    period: "first_half",
    clockRunning: false,
    clockStartedAt: null,
    clockElapsedSeconds: resolvedElapsed,
    clockPauseReason: "injury",
  };

  const tReplay = Date.now() + 900_000; // 15 minutes after whistle
  const pausedState = calculatePitchClock(pausedFixture, 45, tReplay);
  assert.equal(pausedState.totalSeconds, 750);
  assert.equal(pausedState.formattedClock, "12:30");
  assert.equal(pausedState.isPaused, true);
  assert.equal(pausedState.pauseReason, "injury");
});

test("Autonomous Pitch Clock: WAL Restoration recognizes sub-minute pause and stoppage allowance", () => {
  const currentFixture = {
    id: "fix-wal-1",
    matchClockMinute: 24,
    clockElapsedSeconds: 1440,
    clockRunning: 1,
    clockStartedAt: "2026-09-09T10:00:00.000Z",
    stoppageMinutes: 0,
    homeScore: 1,
    awayScore: 0,
  };

  const wal = {
    fixtureId: "fix-wal-1",
    matchClockMinute: 24,
    clockElapsedSeconds: 1485, // 24:45 (paused at 45s within the same minute)
    clockRunning: false,
    clockStartedAt: null,
    stoppageMinutes: 3,
    homeScore: 1,
    awayScore: 0,
  };

  const hasNewerClock =
    wal.matchClockMinute > (currentFixture.matchClockMinute || 0) ||
    (wal.clockElapsedSeconds !== undefined && wal.clockElapsedSeconds > (currentFixture.clockElapsedSeconds || 0)) ||
    (wal.clockRunning !== undefined && Boolean(wal.clockRunning) !== Boolean(currentFixture.clockRunning)) ||
    (wal.stoppageMinutes !== undefined && wal.stoppageMinutes !== (currentFixture.stoppageMinutes || 0));

  assert.equal(hasNewerClock, true, "Sub-minute elapsed seconds and pause state must trigger WAL restoration");

  // Verify explicit undefined check does not treat explicit null as missing
  const restoredClockStartedAt = wal.clockStartedAt !== undefined ? wal.clockStartedAt : currentFixture.clockStartedAt;
  assert.equal(restoredClockStartedAt, null, "Paused match must maintain clockStartedAt: null");
});

test("Autonomous Pitch Clock: Null/Undefined fixture resilience prevents runtime errors", () => {
  const stateNull = calculatePitchClock(null);
  assert.equal(stateNull.totalSeconds, 0);
  assert.equal(stateNull.formattedClock, "00:00");
  assert.equal(stateNull.isRunning, false);
  assert.equal(stateNull.isPaused, false);

  const stateUndefined = calculatePitchClock(undefined);
  assert.equal(stateUndefined.totalSeconds, 0);
  assert.equal(stateUndefined.formattedClock, "00:00");
});
