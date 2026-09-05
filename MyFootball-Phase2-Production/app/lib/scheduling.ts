export type SchedulePairing = {
  round: number;
  roundName: string;
  stage: "group" | "knockout";
  bracketRound?: string;
  bracketIndex?: number;
  home: string;
  away: string;
};

export type ScheduleRules = {
  startDate: string;
  durationDays: number;
  firstKickoffTime: string;
  dayEndTime: string;
  matchDurationMinutes: number;
  bufferMinutes: number;
  minimumRestMinutes: number;
  pitchCount: number;
  longBreakAfterMatches: number;
  longBreakMinutes: number;
};

export type BlockedSlot = {
  fixtureId?: string;
  kickoffAt: string;
  pitch: number;
  durationMinutes: number;
  bufferMinutes: number;
  homeEntryId?: string;
  awayEntryId?: string;
};

export type ScheduledPairing = SchedulePairing & {
  kickoffAt: string;
  pitch: number;
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dateAfter = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
};

export const indiaTime = (date: string, time: string) =>
  new Date(`${date}T${time}:00+05:30`).getTime();

export function roundRobinPairings(
  entryIds: string[],
  options: { labelPrefix?: string; legs?: number } = {},
): SchedulePairing[] {
  const ids = [...entryIds];
  if (ids.length < 2) return [];
  const rotation: Array<string | null> = [...ids];
  if (rotation.length % 2) rotation.push(null);
  const roundCount = rotation.length - 1;
  const firstLeg: SchedulePairing[] = [];
  const prefix = options.labelPrefix ? `${options.labelPrefix} - ` : "";

  for (let round = 0; round < roundCount; round += 1) {
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      if (!left || !right) continue;
      const swap = (round + index) % 2 === 1;
      firstLeg.push({
        round: round + 1,
        roundName: `${prefix}Round ${round + 1}`,
        stage: "group",
        home: swap ? right : left,
        away: swap ? left : right,
      });
    }
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  if ((options.legs ?? 1) !== 2) return firstLeg;
  return [
    ...firstLeg,
    ...firstLeg.map((pairing) => ({
      ...pairing,
      round: pairing.round + roundCount,
      roundName: `${prefix}Round ${pairing.round + roundCount}`,
      home: pairing.away,
      away: pairing.home,
    })),
  ];
}

function validateRules(rules: ScheduleRules) {
  const start = TIME.exec(rules.firstKickoffTime);
  const end = TIME.exec(rules.dayEndTime);
  if (!start || !end || indiaTime(rules.startDate, rules.dayEndTime) <= indiaTime(rules.startDate, rules.firstKickoffTime)) {
    throw new Error("Daily end time must be later than the first kick-off.");
  }
  if (rules.durationDays < 1 || rules.pitchCount < 1 || rules.matchDurationMinutes < 1) {
    throw new Error("Schedule duration, pitches and match duration must be positive.");
  }
  if (rules.bufferMinutes < 0 || rules.minimumRestMinutes < 0 || rules.longBreakMinutes < 0) {
    throw new Error("Schedule breaks and rest periods cannot be negative.");
  }
}

export function buildTournamentSchedule(
  pairings: SchedulePairing[],
  rules: ScheduleRules,
  blockedSlots: BlockedSlot[] = [],
): ScheduledPairing[] {
  validateRules(rules);
  const durationMs = rules.matchDurationMinutes * 60_000;
  const bufferMs = rules.bufferMinutes * 60_000;
  const restMs = rules.minimumRestMinutes * 60_000;
  const blocked = blockedSlots
    .map((slot) => ({
      ...slot,
      start: new Date(slot.kickoffAt).getTime(),
      end: new Date(slot.kickoffAt).getTime() + (slot.durationMinutes + slot.bufferMinutes) * 60_000,
    }))
    .filter((slot) => Number.isFinite(slot.start) && Number.isFinite(slot.end));
  const pitchAvailable = Array.from({ length: rules.pitchCount }, () => indiaTime(rules.startDate, rules.firstKickoffTime));
  const teamReady = new Map<string, number>();
  for (const slot of blocked) {
    const readyAt = slot.start + slot.durationMinutes * 60_000 + restMs;
    for (const entryId of [slot.homeEntryId, slot.awayEntryId]) {
      if (entryId) teamReady.set(entryId, Math.max(teamReady.get(entryId) ?? 0, readyAt));
    }
  }
  const pitchDailyCount = new Map<string, number>();
  const scheduled: ScheduledPairing[] = [];
  let roundFloor = indiaTime(rules.startDate, rules.firstKickoffTime);

  const candidateForPitch = (pitch: number, notBefore: number) => {
    for (let dayIndex = 0; dayIndex < rules.durationDays; dayIndex += 1) {
      const date = dateAfter(rules.startDate, dayIndex);
      const dayStart = indiaTime(date, rules.firstKickoffTime);
      const dayEnd = indiaTime(date, rules.dayEndTime);
      let candidate = Math.max(notBefore, pitchAvailable[pitch - 1], dayStart);
      let moved = true;
      while (moved) {
        moved = false;
        for (const slot of blocked) {
          if (slot.pitch === pitch && candidate < slot.end && candidate + durationMs + bufferMs > slot.start) {
            candidate = slot.end;
            moved = true;
          }
        }
      }
      if (candidate + durationMs <= dayEnd) return { candidate, dayIndex };
    }
    return null;
  };

  const rounds = [...new Set(pairings.map((pairing) => pairing.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    const roundPairings = pairings.filter((pairing) => pairing.round === round);
    const seen = new Set<string>();
    for (const pairing of roundPairings) {
      if (!pairing.home || !pairing.away || pairing.home === pairing.away || seen.has(pairing.home) || seen.has(pairing.away)) {
        throw new Error(`Round ${round} contains a duplicate or invalid team pairing.`);
      }
      seen.add(pairing.home);
      seen.add(pairing.away);
    }

    let latestRoundEnd = roundFloor;
    for (const pairing of roundPairings) {
      const teamFloor = Math.max(teamReady.get(pairing.home) ?? 0, teamReady.get(pairing.away) ?? 0);
      const notBefore = Math.max(roundFloor, teamFloor);
      const candidates = Array.from({ length: rules.pitchCount }, (_, index) => {
        const pitch = index + 1;
        const result = candidateForPitch(pitch, notBefore);
        return result ? { pitch, ...result } : null;
      }).filter((item): item is { pitch: number; candidate: number; dayIndex: number } => Boolean(item));
      candidates.sort((a, b) => a.candidate - b.candidate || a.pitch - b.pitch);
      const selected = candidates[0];
      if (!selected) {
        throw new Error(`The schedule does not fit within ${rules.durationDays} day(s). Add pitches, extend daily hours, or increase the tournament duration.`);
      }

      const end = selected.candidate + durationMs;
      const countKey = `${selected.dayIndex}:${selected.pitch}`;
      const pitchCount = (pitchDailyCount.get(countKey) ?? 0) + 1;
      pitchDailyCount.set(countKey, pitchCount);
      const longBreak =
        rules.longBreakAfterMatches > 0 && pitchCount % rules.longBreakAfterMatches === 0
          ? rules.longBreakMinutes * 60_000
          : 0;
      pitchAvailable[selected.pitch - 1] = end + bufferMs + longBreak;
      teamReady.set(pairing.home, end + restMs);
      teamReady.set(pairing.away, end + restMs);
      latestRoundEnd = Math.max(latestRoundEnd, end);
      scheduled.push({ ...pairing, kickoffAt: new Date(selected.candidate).toISOString(), pitch: selected.pitch });
    }
    roundFloor = latestRoundEnd;
  }
  return scheduled;
}

export function nextScheduleDateAfter(iso: string, weekendOnly: boolean) {
  const date = new Date(iso);
  const india = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  let next = dateAfter(
    `${india.getUTCFullYear()}-${String(india.getUTCMonth() + 1).padStart(2, "0")}-${String(india.getUTCDate()).padStart(2, "0")}`,
    1,
  );
  if (!weekendOnly) return next;
  while (![0, 6].includes(new Date(`${next}T00:00:00Z`).getUTCDay())) next = dateAfter(next, 1);
  return next;
}

export function scheduleConflict(
  candidate: { fixtureId: string; kickoffAt: string; pitch: number; homeEntryId: string; awayEntryId: string; durationMinutes: number; minimumRestMinutes: number; bufferMinutes: number },
  existing: Array<{ id: string; kickoffAt: string; pitch: number; homeEntryId: string; awayEntryId: string; durationMinutes: number; bufferMinutes: number; status: string }>,
) {
  const start = new Date(candidate.kickoffAt).getTime();
  const end = start + candidate.durationMinutes * 60_000;
  for (const fixture of existing) {
    if (fixture.id === candidate.fixtureId || ["cancelled", "postponed"].includes(fixture.status)) continue;
    const otherStart = new Date(fixture.kickoffAt).getTime();
    const otherEnd = otherStart + fixture.durationMinutes * 60_000;
    if (fixture.pitch === candidate.pitch && start < otherEnd + fixture.bufferMinutes * 60_000 && end + candidate.bufferMinutes * 60_000 > otherStart) {
      return "That pitch is already occupied during the selected time.";
    }
    const sameTeam = [fixture.homeEntryId, fixture.awayEntryId].some((id) => id === candidate.homeEntryId || id === candidate.awayEntryId);
    if (sameTeam) {
      const rest = candidate.minimumRestMinutes * 60_000;
      if (!(start >= otherEnd + rest || otherStart >= end + rest)) {
        return "One of the teams would not receive the required minimum rest.";
      }
    }
  }
  return null;
}
