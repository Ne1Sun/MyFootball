import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  announcements,
  auditLogs,
  clubs,
  clubStaffAssignments,
  divisions,
  entries,
  fixtureOfficials,
  fixtures,
  matchEvents,
  players,
  schedulePolicies,
  shootoutKicks,
  squadMembers,
  teams,
  tournaments,
  users,
} from "../../../db/schema";
import { apiError, requireApiUser } from "../../lib/server";
import {
  canStartShootout,
  calculateShootout,
  deriveKnockoutResult,
  validateMatchTransition,
  type MatchSnapshot,
} from "../../lib/match-domain";
import {
  buildTournamentSchedule,
  nextScheduleDateAfter,
  roundRobinPairings,
  scheduleConflict,
  type BlockedSlot,
  type SchedulePairing,
} from "../../lib/scheduling";
import {
  tournamentEndDate,
  validateTournamentTransition,
  type TournamentStatus,
} from "../../lib/tournament-domain";

type Payload = Record<string, unknown> & { action?: string };

const clean = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const entryStatuses = new Set(["pending", "approved", "rejected", "withdrawn"]);
const paymentStatuses = new Set(["unpaid", "pending", "paid", "refunded", "waived"]);
const fixtureStatuses = new Set(["scheduled", "in_progress", "completed"]);
const tournamentStatuses = new Set([
  "draft",
  "registration_open",
  "registration_closed",
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);
const matchPeriods = new Set([
  "scheduled",
  "first_half",
  "half_time",
  "second_half",
  "extra_time",
  "penalties",
  "completed",
]);
const eventTypes = new Set([
  "goal",
  "penalty_goal",
  "own_goal",
  "yellow_card",
  "red_card",
  "substitution",
  "penalty_miss",
]);
const playerPositions = new Set(["GK", "DEF", "MID", "FWD"]);
const staffRoles = new Set(["coach", "manager", "assistant_coach"]);
const assignmentStatuses = new Set(["active", "revoked"]);
const officialStatuses = new Set(["assigned", "revoked"]);
const normalizedEmail = (value: unknown) => clean(value, 254).toLowerCase();

const validDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const validPhone = (value: string) => value.replace(/\D/g, "").length >= 10;

const registrationCloseValue = (value: unknown) => {
  const raw = clean(value, 40);
  if (!raw) return null;
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)
    ? `${raw.length === 16 ? raw + ":00" : raw}+05:30`
    : raw;
  const parsed = new Date(zoned);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
};

const timeValue = (value: unknown, fallback: string) => {
  const parsed = clean(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed) ? parsed : fallback;
};

const boundedInteger = (value: unknown, fallback: number, minimum: number, maximum: number) =>
  Math.round(Math.max(minimum, Math.min(maximum, numberValue(value, fallback))));

const schedulePolicyValues = (payload: Payload) => ({
  firstKickoffTime: timeValue(payload.startTime, "09:00"),
  dayEndTime: timeValue(payload.dayEndTime, "20:00"),
  matchDurationMinutes: boundedInteger(payload.matchDurationMinutes, 90, 20, 180),
  bufferMinutes: boundedInteger(payload.bufferMinutes, 15, 0, 120),
  minimumRestMinutes: boundedInteger(payload.minimumRestMinutes, 60, 0, 1440),
  pitchCount: boundedInteger(payload.pitches, 2, 1, 12),
  longBreakAfterMatches: boundedInteger(payload.longBreakAfterMatches, 0, 0, 20),
  longBreakMinutes: boundedInteger(payload.longBreakMinutes, 0, 0, 240),
  leagueLegs: boundedInteger(payload.leagueLegs, 1, 1, 2),
  knockoutWeekendOnly: Boolean(payload.knockoutWeekendOnly),
  updatedAt: new Date().toISOString(),
});

const defaultSchedulePolicy = (divisionId: string) => ({
  id: "",
  divisionId,
  firstKickoffTime: "09:00",
  dayEndTime: "20:00",
  matchDurationMinutes: 90,
  bufferMinutes: 15,
  minimumRestMinutes: 60,
  pitchCount: 1,
  longBreakAfterMatches: 0,
  longBreakMinutes: 0,
  leagueLegs: 1,
  knockoutWeekendOnly: false,
  updatedAt: "",
});

async function tournamentFixtureState(tournamentId: string) {
  const db = getDb();
  const divisionRows = await db.select().from(divisions).where(eq(divisions.tournamentId, tournamentId));
  const divisionIds = divisionRows.map((division) => division.id);
  const fixtureRows = divisionIds.length
    ? await db.select().from(fixtures).where(inArray(fixtures.divisionId, divisionIds))
    : [];
  const allCompetitionFixturesComplete =
    divisionRows.length > 0 &&
    divisionRows.every((division) => {
      const divisionFixtures = fixtureRows.filter((fixture) => fixture.divisionId === division.id);
      if (!divisionFixtures.length || divisionFixtures.some((fixture) => fixture.status !== "completed")) return false;
      if (division.format === "round_robin") return true;
      return divisionFixtures.some((fixture) => fixture.bracketRound === "final" && fixture.status === "completed");
    });
  return {
    hasFixtures: fixtureRows.length > 0,
    allCompetitionFixturesComplete,
    fixtures: fixtureRows,
    divisions: divisionRows,
  };
}

async function syncTournamentLifecycle(tournamentId: string) {
  const db = getDb();
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  if (!tournament || ["completed", "cancelled"].includes(tournament.status)) return;
  const state = await tournamentFixtureState(tournamentId);
  if (state.allCompetitionFixturesComplete) {
    await db.update(tournaments).set({ status: "completed", updatedAt: new Date().toISOString() }).where(eq(tournaments.id, tournamentId));
    return;
  }
  if (state.fixtures.some((fixture) => fixture.status === "in_progress") && tournament.status !== "live") {
    await db.update(tournaments).set({ status: "live", updatedAt: new Date().toISOString() }).where(eq(tournaments.id, tournamentId));
  }
}

type KnockoutPairing = {
  round: number;
  roundName: string;
  stage: "knockout";
  bracketRound: string;
  bracketIndex: number;
  home: string;
  away: string;
};

const knockoutRoundBySize: Record<number, string> = {
  2: "final",
  4: "semi_final",
  8: "quarter_final",
  16: "round_of_16",
  32: "round_of_32",
  64: "round_of_64",
  128: "round_of_128",
};

const knockoutRoundLabel = (round: string) => {
  if (round === "final") return "Grand Final";
  if (round === "semi_final") return "Semi-Final";
  if (round === "quarter_final") return "Quarter-Final";
  return round.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const initialKnockoutBracket = (seededEntryIds: string[]) => {
  const total = seededEntryIds.length;
  if (total < 2 || total > 128) {
    throw new Error("Knockout brackets support between 2 and 128 teams.");
  }
  const bracketSize = 2 ** Math.ceil(Math.log2(total));
  const bracketRound = knockoutRoundBySize[bracketSize];
  const byeCount = bracketSize - total;
  const byeEntryIds = seededEntryIds.slice(0, byeCount);
  const playingEntryIds = seededEntryIds.slice(byeCount);
  const label = knockoutRoundLabel(bracketRound);
  const pairings: KnockoutPairing[] = [];

  for (let index = 0; index < playingEntryIds.length / 2; index += 1) {
    pairings.push({
      round: 1,
      roundName: bracketRound === "final" ? label : `${label} ${index + 1}`,
      stage: "knockout",
      bracketRound,
      bracketIndex: index + 1,
      home: playingEntryIds[index],
      away: playingEntryIds[playingEntryIds.length - 1 - index],
    });
  }

  return { pairings, byeEntryIds, bracketSize, bracketRound };
};

async function ownedTournament(tournamentId: string, email: string) {
  const [row] = await getDb()
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.id, tournamentId),
        eq(tournaments.organizerEmail, email),
      ),
    )
    .limit(1);
  return row;
}

async function ownedDivision(divisionId: string, email: string) {
  const [row] = await getDb()
    .select({ division: divisions, tournament: tournaments })
    .from(divisions)
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .where(
      and(eq(divisions.id, divisionId), eq(tournaments.organizerEmail, email)),
    )
    .limit(1);
  return row;
}

async function manageableClub(clubId: string, email: string) {
  const [row] = await getDb()
    .select({ club: clubs })
    .from(clubs)
    .leftJoin(teams, eq(teams.clubId, clubs.id))
    .leftJoin(entries, eq(entries.teamId, teams.id))
    .leftJoin(divisions, eq(divisions.id, entries.divisionId))
    .leftJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .leftJoin(clubStaffAssignments, eq(clubStaffAssignments.clubId, clubs.id))
    .where(
      and(
        eq(clubs.id, clubId),
        or(
          eq(clubs.ownerEmail, email),
          eq(tournaments.organizerEmail, email),
          and(
            eq(clubStaffAssignments.userEmail, email),
            eq(clubStaffAssignments.status, "active"),
          ),
        ),
      ),
    )
    .limit(1);
  return row?.club;
}

async function manageableEntry(entryId: string, email: string) {
  const [row] = await getDb()
    .select({ entry: entries, division: divisions, club: clubs })
    .from(entries)
    .innerJoin(teams, eq(entries.teamId, teams.id))
    .innerJoin(clubs, eq(teams.clubId, clubs.id))
    .innerJoin(divisions, eq(entries.divisionId, divisions.id))
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .leftJoin(clubStaffAssignments, eq(clubStaffAssignments.clubId, clubs.id))
    .where(
      and(
        eq(entries.id, entryId),
        or(
          eq(clubs.ownerEmail, email),
          eq(tournaments.organizerEmail, email),
          and(
            eq(clubStaffAssignments.userEmail, email),
            eq(clubStaffAssignments.status, "active"),
          ),
        ),
      ),
    )
    .limit(1);
  return row;
}

async function ownedFixture(fixtureId: string, email: string) {
  const [row] = await getDb()
    .select({ fixture: fixtures })
    .from(fixtures)
    .innerJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .where(
      and(
        eq(fixtures.id, fixtureId),
        eq(tournaments.organizerEmail, email),
      ),
    )
    .limit(1);
  return row?.fixture;
}

async function manageableFixture(fixtureId: string, email: string) {
  const [row] = await getDb()
    .select({ fixture: fixtures, tournamentId: tournaments.id })
    .from(fixtures)
    .innerJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .leftJoin(fixtureOfficials, eq(fixtureOfficials.fixtureId, fixtures.id))
    .where(
      and(
        eq(fixtures.id, fixtureId),
        or(
          eq(tournaments.organizerEmail, email),
          and(
            eq(fixtureOfficials.userEmail, email),
            eq(fixtureOfficials.status, "assigned"),
          ),
        ),
      ),
    )
    .limit(1);
  return row;
}

async function tournamentIdForFixture(fixtureId: string) {
  const [row] = await getDb()
    .select({ tournamentId: tournaments.id })
    .from(fixtures)
    .innerJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  return row?.tournamentId ?? null;
}

async function writeAudit(input: {
  tournamentId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorEmail: string;
  before?: unknown;
  after?: unknown;
}) {
  await getDb().insert(auditLogs).values({
    id: crypto.randomUUID(),
    tournamentId: input.tournamentId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorEmail: input.actorEmail,
    beforeJson: JSON.stringify(input.before ?? {}),
    afterJson: JSON.stringify(input.after ?? {}),
  });
}

function matchSnapshot(
  fixture: typeof fixtures.$inferSelect,
  changes: Partial<Pick<typeof fixtures.$inferSelect, "homeScore" | "awayScore" | "homeScorePenalties" | "awayScorePenalties" | "status" | "period">> = {},
): MatchSnapshot {
  return {
    stage: fixture.stage,
    status: changes.status ?? fixture.status,
    period: changes.period ?? fixture.period,
    homeEntryId: fixture.homeEntryId,
    awayEntryId: fixture.awayEntryId,
    homeScore: changes.homeScore ?? fixture.homeScore,
    awayScore: changes.awayScore ?? fixture.awayScore,
    homeScorePenalties: changes.homeScorePenalties ?? fixture.homeScorePenalties,
    awayScorePenalties: changes.awayScorePenalties ?? fixture.awayScorePenalties,
  };
}

async function progressKnockoutRound(currentFix: typeof fixtures.$inferSelect) {
  const currentRound = currentFix.bracketRound;
  const nextRoundByCurrent: Record<string, string> = {
    round_of_128: "round_of_64",
    round_of_64: "round_of_32",
    round_of_32: "round_of_16",
    round_of_16: "quarter_final",
    quarter_final: "semi_final",
    semi_final: "final",
  };
  const nextRound = currentRound ? nextRoundByCurrent[currentRound] : undefined;
  if (!currentRound || !nextRound) return 0;

  const db = getDb();
  const completedRound = await db
    .select()
    .from(fixtures)
    .where(
      and(
        eq(fixtures.divisionId, currentFix.divisionId),
        eq(fixtures.bracketRound, currentRound),
      ),
    )
    .orderBy(asc(fixtures.bracketMatchIndex));
  if (
    !completedRound.length ||
    completedRound.some(
      (match) =>
        match.status !== "completed" ||
        !match.winnerEntryId ||
        !match.loserEntryId,
    )
  ) return 0;

  const [alreadyGenerated] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.divisionId, currentFix.divisionId),
        eq(fixtures.bracketRound, nextRound),
      ),
    )
    .limit(1);
  if (alreadyGenerated) return 0;

  const [divisionConfig] = await db
    .select({
      includeThirdPlace: divisions.includeThirdPlace,
      knockoutByeEntryIds: divisions.knockoutByeEntryIds,
    })
    .from(divisions)
    .where(eq(divisions.id, currentFix.divisionId))
    .limit(1);
  let byeEntryIds: string[] = [];
  try {
    const parsed = JSON.parse(divisionConfig?.knockoutByeEntryIds || "[]");
    if (Array.isArray(parsed)) {
      byeEntryIds = parsed.filter(
        (entryId): entryId is string => typeof entryId === "string",
      );
    }
  } catch {
    byeEntryIds = [];
  }
  const [storedPolicy] = await db
    .select()
    .from(schedulePolicies)
    .where(eq(schedulePolicies.divisionId, currentFix.divisionId))
    .limit(1);
  const policy = storedPolicy ?? defaultSchedulePolicy(currentFix.divisionId);

  const latestKickoff = Math.max(
    ...completedRound.map((match) => new Date(match.kickoffAt).getTime()),
  );
  const nextDate = nextScheduleDateAfter(
    new Date(Number.isFinite(latestKickoff) ? latestKickoff : Date.now()).toISOString(),
    policy.knockoutWeekendOnly,
  );
  const winners = completedRound.map((match) => match.winnerEntryId as string);
  const losers = completedRound.map((match) => match.loserEntryId as string);
  const nextEntrants = byeEntryIds.length ? [...byeEntryIds, ...winners] : winners;
  const nextPairings: SchedulePairing[] = [];

  if (nextRound === "final") {
    if (divisionConfig?.includeThirdPlace && losers.length === 2) {
      nextPairings.push({
        round: 1,
        roundName: "3rd Place Playoff",
        stage: "knockout",
        bracketRound: "third_place",
        bracketIndex: 1,
        home: losers[0],
        away: losers[1],
      });
    }
    if (nextEntrants.length === 2) {
      nextPairings.push({
        round: nextPairings.length ? 2 : 1,
        roundName: "Grand Final",
        stage: "knockout",
        bracketRound: "final",
        bracketIndex: 1,
        home: nextEntrants[0],
        away: nextEntrants[1],
      });
    }
  } else {
    const label = knockoutRoundLabel(nextRound);
    const entrants = byeEntryIds.length
      ? nextEntrants.slice(0, nextEntrants.length / 2).flatMap((entryId, index) => [
          entryId,
          nextEntrants[nextEntrants.length - 1 - index],
        ])
      : nextEntrants;
    for (let index = 0; index + 1 < entrants.length; index += 2) {
      nextPairings.push({
        round: 1,
        roundName: `${label} ${index / 2 + 1}`,
        stage: "knockout",
        bracketRound: nextRound,
        bracketIndex: index / 2 + 1,
        home: entrants[index],
        away: entrants[index + 1],
      });
    }
  }
  if (!nextPairings.length) return 0;

  const [tournamentConfig] = await db
    .select({ id: tournaments.id, startDate: tournaments.startDate, durationDays: tournaments.durationDays })
    .from(divisions)
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .where(eq(divisions.id, currentFix.divisionId))
    .limit(1);
  if (!tournamentConfig) return 0;
  const tournamentEnd = tournamentEndDate(tournamentConfig.startDate, tournamentConfig.durationDays);
  const remainingDays = Math.round(
    (Date.parse(`${tournamentEnd}T00:00:00Z`) - Date.parse(`${nextDate}T00:00:00Z`)) / 86_400_000,
  ) + 1;
  const tournamentDivisionIds = (await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentConfig.id))).map((item) => item.id);
  const tournamentFixtures = tournamentDivisionIds.length
    ? await db.select().from(fixtures).where(inArray(fixtures.divisionId, tournamentDivisionIds))
    : [];
  const tournamentPolicies = tournamentDivisionIds.length
    ? await db.select().from(schedulePolicies).where(inArray(schedulePolicies.divisionId, tournamentDivisionIds))
    : [];
  const policyByDivision = new Map(tournamentPolicies.map((item) => [item.divisionId, item]));
  const blockedSlots: BlockedSlot[] = tournamentFixtures
    .filter((fixture) => !["cancelled", "postponed"].includes(fixture.status))
    .map((fixture) => {
      const fixturePolicy = policyByDivision.get(fixture.divisionId) ?? defaultSchedulePolicy(fixture.divisionId);
      return {
        fixtureId: fixture.id,
        kickoffAt: fixture.kickoffAt,
        pitch: fixture.pitch,
        durationMinutes: fixturePolicy.matchDurationMinutes,
        bufferMinutes: fixturePolicy.bufferMinutes,
        homeEntryId: fixture.homeEntryId,
        awayEntryId: fixture.awayEntryId,
      };
    });
  const scheduledPairings = buildTournamentSchedule(nextPairings, {
    startDate: nextDate,
    durationDays: remainingDays,
    firstKickoffTime: policy.firstKickoffTime,
    dayEndTime: policy.dayEndTime,
    matchDurationMinutes: policy.matchDurationMinutes,
    bufferMinutes: policy.bufferMinutes,
    minimumRestMinutes: policy.minimumRestMinutes,
    pitchCount: policy.pitchCount,
    longBreakAfterMatches: policy.longBreakAfterMatches,
    longBreakMinutes: policy.longBreakMinutes,
  }, blockedSlots);
  const newFixtures: Array<typeof fixtures.$inferInsert> = scheduledPairings.map((pairing) => ({
    id: crypto.randomUUID(),
    divisionId: currentFix.divisionId,
    roundNumber: currentFix.roundNumber + 1,
    roundName: pairing.roundName,
    stage: "knockout",
    bracketRound: pairing.bracketRound,
    bracketMatchIndex: pairing.bracketIndex,
    homeEntryId: pairing.home,
    awayEntryId: pairing.away,
    kickoffAt: pairing.kickoffAt,
    pitch: pairing.pitch,
  }));
  if (byeEntryIds.length) {
    await db.batch([
      db
        .update(divisions)
        .set({ knockoutByeEntryIds: "[]" })
        .where(eq(divisions.id, currentFix.divisionId)),
      db.insert(fixtures).values(newFixtures),
    ]);
  } else {
    await db.insert(fixtures).values(newFixtures);
  }
  return newFixtures.length;
}

async function completeFixture(
  fixture: typeof fixtures.$inferSelect,
  actorEmail: string,
  changes: Partial<Pick<typeof fixtures.$inferSelect, "homeScorePenalties" | "awayScorePenalties" | "potmPlayerId" | "potmPlayerName" | "refereeNotes" | "matchClockMinute">> = {},
) {
  if (fixture.status !== "in_progress") {
    throw new Error("Only an in-progress match can be completed.");
  }
  const completedSnapshot = matchSnapshot(fixture, {
    status: "completed",
    period: "completed",
    homeScorePenalties: changes.homeScorePenalties ?? fixture.homeScorePenalties,
    awayScorePenalties: changes.awayScorePenalties ?? fixture.awayScorePenalties,
  });
  const result = fixture.stage === "knockout"
    ? deriveKnockoutResult(completedSnapshot)
    : { winnerEntryId: null, loserEntryId: null };
  const after = {
    status: "completed",
    period: "completed",
    matchClockMinute: Math.max(90, changes.matchClockMinute ?? fixture.matchClockMinute),
    clockRunning: false,
    clockStartedAt: null,
    homeScorePenalties: completedSnapshot.homeScorePenalties,
    awayScorePenalties: completedSnapshot.awayScorePenalties,
    winnerEntryId: result.winnerEntryId,
    loserEntryId: result.loserEntryId,
    ...(changes.potmPlayerId !== undefined ? { potmPlayerId: changes.potmPlayerId } : {}),
    ...(changes.potmPlayerName !== undefined ? { potmPlayerName: changes.potmPlayerName } : {}),
    ...(changes.refereeNotes !== undefined ? { refereeNotes: changes.refereeNotes } : {}),
  };
  await getDb().update(fixtures).set(after).where(eq(fixtures.id, fixture.id));
  await writeAudit({
    tournamentId: await tournamentIdForFixture(fixture.id),
    entityType: "fixture",
    entityId: fixture.id,
    action: "match_completed",
    actorEmail,
    before: matchSnapshot(fixture),
    after: completedSnapshot,
  });
  const tournamentId = await tournamentIdForFixture(fixture.id);
  let progressionWarning: string | null = null;
  if (fixture.stage === "knockout") {
    try {
      await progressKnockoutRound(fixture);
    } catch (error) {
      progressionWarning = error instanceof Error ? error.message : "The next knockout round needs organizer attention.";
      await writeAudit({
        tournamentId,
        entityType: "division",
        entityId: fixture.divisionId,
        action: "knockout_progression_blocked",
        actorEmail,
        after: { reason: progressionWarning },
      });
    }
  }
  if (tournamentId) await syncTournamentLifecycle(tournamentId);
  return { progressionWarning };
}

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const db = getDb();
    const tournamentRows = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.organizerEmail, user.email))
      .orderBy(desc(tournaments.createdAt));

    if (!tournamentRows.length) {
      return Response.json({
        profile: user,
        tournaments: [],
        divisions: [],
        entries: [],
        fixtures: [],
        events: [],
        announcements: [],
        players: [],
        squadMembers: [],
        clubStaffAssignments: [],
        fixtureOfficials: [],
        shootoutKicks: [],
        auditLogs: [],
        schedulePolicies: [],
      });
    }

    const tournamentIds = tournamentRows.map((row) => row.id);
    const divisionRows = await db
      .select()
      .from(divisions)
      .where(inArray(divisions.tournamentId, tournamentIds))
      .orderBy(asc(divisions.createdAt));
    const divisionIds = divisionRows.map((row) => row.id);
    const schedulePolicyRows = divisionIds.length
      ? await db.select().from(schedulePolicies).where(inArray(schedulePolicies.divisionId, divisionIds))
      : [];

    const entryRows = divisionIds.length
      ? await db
          .select({
            id: entries.id,
            divisionId: entries.divisionId,
            teamId: entries.teamId,
            clubId: clubs.id,
            status: entries.status,
            paymentStatus: entries.paymentStatus,
            amountPaise: entries.amountPaise,
            seed: entries.seed,
            groupName: entries.groupName,
            notes: entries.notes,
            registeredAt: entries.registeredAt,
            teamName: teams.name,
            clubName: clubs.name,
            city: clubs.city,
            contactName: clubs.contactName,
            contactPhone: clubs.contactPhone,
          })
          .from(entries)
          .innerJoin(teams, eq(entries.teamId, teams.id))
          .innerJoin(clubs, eq(teams.clubId, clubs.id))
          .where(inArray(entries.divisionId, divisionIds))
          .orderBy(desc(entries.registeredAt))
      : [];

    const entryIds = entryRows.map((e) => e.id);
    const clubIds = [...new Set(entryRows.map((e) => e.clubId))];

    // Fetch players belonging to these clubs
    const playerRows = clubIds.length
      ? await db
          .select()
          .from(players)
          .where(inArray(players.clubId, clubIds))
          .orderBy(asc(players.jerseyNumber), asc(players.name))
      : [];

    // Fetch squad members assigned to these entries
    const squadRows = entryIds.length
      ? await db
          .select()
          .from(squadMembers)
          .where(inArray(squadMembers.entryId, entryIds))
      : [];

    const fixtureRows = divisionIds.length
      ? await db
          .select()
          .from(fixtures)
          .where(inArray(fixtures.divisionId, divisionIds))
          .orderBy(asc(fixtures.kickoffAt), asc(fixtures.pitch))
      : [];
    const fixtureIds = fixtureRows.map((row) => row.id);

    const clubStaffRows = clubIds.length
      ? await db
          .select()
          .from(clubStaffAssignments)
          .where(inArray(clubStaffAssignments.clubId, clubIds))
          .orderBy(asc(clubStaffAssignments.userEmail))
      : [];
    const fixtureOfficialRows = fixtureIds.length
      ? await db
          .select()
          .from(fixtureOfficials)
          .where(inArray(fixtureOfficials.fixtureId, fixtureIds))
      : [];
    const shootoutRows = fixtureIds.length
      ? await db
          .select()
          .from(shootoutKicks)
          .where(inArray(shootoutKicks.fixtureId, fixtureIds))
          .orderBy(asc(shootoutKicks.sequence))
      : [];

    const eventRows = fixtureIds.length
      ? await db
          .select()
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, fixtureIds))
          .orderBy(desc(matchEvents.matchMinute), desc(matchEvents.createdAt))
      : [];

    const announcementRows = await db
      .select()
      .from(announcements)
      .where(inArray(announcements.tournamentId, tournamentIds))
      .orderBy(desc(announcements.createdAt));
    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(inArray(auditLogs.tournamentId, tournamentIds))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    return Response.json({
      profile: user,
      tournaments: tournamentRows,
      divisions: divisionRows,
      entries: entryRows,
      fixtures: fixtureRows,
      events: eventRows,
      announcements: announcementRows,
      players: playerRows,
      squadMembers: squadRows,
      clubStaffAssignments: clubStaffRows,
      fixtureOfficials: fixtureOfficialRows,
      shootoutKicks: shootoutRows,
      auditLogs: auditRows,
      schedulePolicies: schedulePolicyRows,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const payload = (await request.json()) as Payload;
    const db = getDb();

    if (payload.action === "setProfile") {
      const role = clean(payload.role, 20);
      if (role !== "fan" && role !== "organizer") {
        return Response.json(
          { error: "Choose Fan or Organizer." },
          { status: 400 },
        );
      }
      await db
        .update(users)
        .set({
          role,
          preferredState: clean(payload.preferredState, 100),
          preferredCity: clean(payload.preferredCity, 100),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.email, user.email));
      return Response.json({ ok: true });
    }

    if (payload.action === "updateLocation") {
      const tournamentId = clean(payload.tournamentId, 50);
      if (!(await ownedTournament(tournamentId, user.email)))
        return Response.json(
          { error: "Tournament not found" },
          { status: 404 },
        );
      const venueName = clean(payload.venueName);
      const addressLine1 = clean(payload.addressLine1, 300);
      const locality = clean(payload.locality, 120);
      const city = clean(payload.city, 100);
      const state = clean(payload.state, 100);
      const postalCode = clean(payload.postalCode, 10);
      const latitude = clean(payload.latitude, 20);
      const longitude = clean(payload.longitude, 20);
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (
        !venueName ||
        !addressLine1 ||
        !locality ||
        !city ||
        !state ||
        !/^\d{6}$/.test(postalCode) ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180
      ) {
        return Response.json(
          {
            error:
              "Complete the exact address, 6-digit PIN code and valid map coordinates.",
          },
          { status: 400 },
        );
      }
      await db
        .update(tournaments)
        .set({
          venueName,
          addressLine1,
          locality,
          city,
          state,
          postalCode,
          latitude,
          longitude,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tournaments.id, tournamentId));
      return Response.json({ ok: true });
    }

    if (payload.action === "updateTournament") {
      const tournamentId = clean(payload.tournamentId, 50);
      const existingTournament = await ownedTournament(tournamentId, user.email);
      if (!existingTournament) {
        return Response.json({ error: "Tournament not found" }, { status: 404 });
      }

      const name = clean(payload.name);
      const organizedBy = clean(payload.organizedBy);
      const city = clean(payload.city, 100);
      const venueName = clean(payload.venueName);
      const addressLine1 = clean(payload.addressLine1, 300);
      const locality = clean(payload.locality, 120);
      const state = clean(payload.state, 100);
      const postalCode = clean(payload.postalCode, 10);
      const latitude = clean(payload.latitude, 20);
      const longitude = clean(payload.longitude, 20);
      const startDate = clean(payload.startDate, 10);
      const contactName = clean(payload.contactName, 100);
      const contactPhone = clean(payload.contactPhone, 20);
      const status = clean(payload.status, 30);
      const registrationClosesAt = registrationCloseValue(payload.registrationClosesAt);
      const durationDays = boundedInteger(payload.durationDays, existingTournament.durationDays, 1, 60);
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (
        !name ||
        !organizedBy ||
        !city ||
        !venueName ||
        !addressLine1 ||
        !locality ||
        !state ||
        !startDate ||
        !contactName
      ) {
        return Response.json(
          { error: "Complete the tournament, organizer, venue, date and contact details." },
          { status: 400 },
        );
      }
      if (!validDate(startDate)) {
        return Response.json({ error: "Enter a valid tournament start date." }, { status: 400 });
      }
      if (!validPhone(contactPhone)) {
        return Response.json({ error: "Enter a valid organizer phone number." }, { status: 400 });
      }
      if (!tournamentStatuses.has(status)) {
        return Response.json({ error: "Select a valid tournament status." }, { status: 400 });
      }
      if (registrationClosesAt === undefined) {
        return Response.json({ error: "Enter a valid registration deadline." }, { status: 400 });
      }
      if (
        registrationClosesAt &&
        new Date(registrationClosesAt).getTime() > new Date(`${startDate}T23:59:59+05:30`).getTime()
      ) {
        return Response.json(
          { error: "Registration must close on or before the tournament starts." },
          { status: 400 },
        );
      }
      if (
        !/^\d{6}$/.test(postalCode) ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180
      ) {
        return Response.json(
          { error: "Enter a valid 6-digit PIN code and map coordinates." },
          { status: 400 },
        );
      }

      const fixtureState = await tournamentFixtureState(tournamentId);
      if (status === "cancelled" && existingTournament.status !== "cancelled") {
        return Response.json(
          { error: "Use the cancellation workflow so the reason is recorded in the audit trail." },
          { status: 409 },
        );
      }
      if (
        fixtureState.hasFixtures &&
        (startDate !== existingTournament.startDate || durationDays < existingTournament.durationDays)
      ) {
        return Response.json(
          { error: "Reset the unstarted schedule before changing the start date or shortening the tournament." },
          { status: 409 },
        );
      }
      try {
        validateTournamentTransition({
          current: existingTournament.status as TournamentStatus,
          next: status as TournamentStatus,
          hasFixtures: fixtureState.hasFixtures,
          allCompetitionFixturesComplete: fixtureState.allCompetitionFixturesComplete,
          registrationDeadlinePassed: Boolean(
            registrationClosesAt && new Date(registrationClosesAt).getTime() <= Date.now(),
          ),
        });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Invalid tournament status change." },
          { status: 409 },
        );
      }

      await db
        .update(tournaments)
        .set({
          name,
          organizedBy,
          city,
          venueName,
          addressLine1,
          locality,
          state,
          postalCode,
          latitude,
          longitude,
          startDate,
          durationDays,
          status,
          contactName,
          contactPhone,
          registrationClosesAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tournaments.id, tournamentId));

      await writeAudit({
        tournamentId,
        entityType: "tournament",
        entityId: tournamentId,
        action: "tournament_updated",
        actorEmail: user.email,
        before: existingTournament,
        after: { name, startDate, durationDays, status, registrationClosesAt },
      });

      return Response.json({ ok: true });
    }

    if (payload.action === "createTournament") {
      const name = clean(payload.name);
      const city = clean(payload.city, 100);
      const venueName = clean(payload.venueName);
      const addressLine1 = clean(payload.addressLine1, 300);
      const locality = clean(payload.locality, 120);
      const state = clean(payload.state, 100);
      const postalCode = clean(payload.postalCode, 10);
      const latitude = clean(payload.latitude, 20);
      const longitude = clean(payload.longitude, 20);
      const startDate = clean(payload.startDate, 10);
      const ageGroups = Array.isArray(payload.ageGroups)
        ? [...new Set(payload.ageGroups.map((item) => clean(item, 50)).filter(Boolean))]
        : [];
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (
        !name ||
        !city ||
        !venueName ||
        !addressLine1 ||
        !locality ||
        !state ||
        !postalCode ||
        !startDate ||
        !ageGroups.length
      ) {
        return Response.json(
          {
            error:
              "Tournament, exact venue address, location and at least one division are required.",
          },
          { status: 400 },
        );
      }
      if (!validDate(startDate)) {
        return Response.json({ error: "Enter a valid tournament start date." }, { status: 400 });
      }
      const contactPhone = clean(payload.contactPhone, 20);
      if (!validPhone(contactPhone)) {
        return Response.json({ error: "Enter a valid organizer phone number." }, { status: 400 });
      }
      const registrationClosesAt = registrationCloseValue(payload.registrationClosesAt);
      if (
        registrationClosesAt === undefined ||
        (registrationClosesAt &&
          new Date(registrationClosesAt).getTime() > new Date(`${startDate}T23:59:59+05:30`).getTime())
      ) {
        return Response.json(
          { error: "Registration must close on or before the tournament starts." },
          { status: 400 },
        );
      }
      if (
        !/^\d{6}$/.test(postalCode) ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180
      ) {
        return Response.json(
          { error: "Enter a valid 6-digit PIN code and map coordinates." },
          { status: 400 },
        );
      }

      const tournamentId = crypto.randomUUID();
      const tournament = {
        id: tournamentId,
        organizerEmail: user.email,
        name,
        organizedBy: clean(payload.organizedBy) || user.displayName,
        city,
        venueName,
        addressLine1,
        locality,
        state,
        postalCode,
        latitude,
        longitude,
        startDate,
        durationDays: Math.round(Math.max(
          1,
          Math.min(60, numberValue(payload.durationDays, 2)),
        )),
        status: "registration_open",
        contactName: clean(payload.contactName, 100) || user.displayName,
        contactPhone,
        registrationClosesAt: registrationClosesAt || null,
      };
      const requestedFormat = clean(payload.format, 30) || "group_knockout";
      const format = ["group_knockout", "round_robin", "knockout"].includes(requestedFormat)
        ? requestedFormat
        : "group_knockout";
      const maxTeams = Math.round(Math.max(
        2,
        Math.min(128, numberValue(payload.maxTeams, 16)),
      ));
      const feePaise = Math.max(
        0,
        Math.round(numberValue(payload.feeRupees, 0) * 100),
      );
      const divisionRows = ageGroups.map((ageGroup) => ({
        id: crypto.randomUUID(),
        tournamentId,
        name: ageGroup,
        format,
        maxTeams,
        groupsCount: 2,
        teamsAdvancingPerGroup: 2,
        includeThirdPlace: Boolean(payload.includeThirdPlace),
        knockoutByeEntryIds: "[]",
        maxSquadSize: Math.round(Math.max(
          1,
          Math.min(50, numberValue(payload.maxSquadSize, 18)),
        )),
        feePaise,
        feeBasis: clean(payload.feeBasis, 20) || "per_team",
        requirePlayers: Boolean(payload.requirePlayers),
        requireDocuments: Boolean(
          payload.requirePlayers && payload.requireDocuments,
        ),
      }));
      await db.batch([
        db.insert(tournaments).values(tournament),
        db.insert(divisions).values(divisionRows),
      ]);
      return Response.json(
        { tournament, divisions: divisionRows },
        { status: 201 },
      );
    }

    if (payload.action === "updateDivision") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned) return Response.json({ error: "Division not found" }, { status: 404 });
      const [existingFixture] = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.divisionId, divisionId)).limit(1);
      if (existingFixture) {
        return Response.json({ error: "Reset the unstarted schedule before changing division rules." }, { status: 409 });
      }
      if (["live", "completed", "cancelled"].includes(owned.tournament.status)) {
        return Response.json({ error: "Division rules are locked for this tournament stage." }, { status: 409 });
      }
      const name = clean(payload.name, 80);
      const format = clean(payload.format, 30);
      const maxTeams = boundedInteger(payload.maxTeams, owned.division.maxTeams, 2, 128);
      const groupsCount = format === "group_knockout"
        ? boundedInteger(payload.groupsCount, owned.division.groupsCount, 2, 26)
        : 1;
      const teamsAdvancingPerGroup = format === "group_knockout"
        ? boundedInteger(payload.teamsAdvancingPerGroup, owned.division.teamsAdvancingPerGroup, 1, 32)
        : 1;
      const maxSquadSize = boundedInteger(payload.maxSquadSize, owned.division.maxSquadSize, 1, 50);
      const feePaise = Math.max(0, Math.round(numberValue(payload.feeRupees, owned.division.feePaise / 100) * 100));
      const winPoints = boundedInteger(payload.winPoints, owned.division.winPoints, 0, 10);
      const drawPoints = boundedInteger(payload.drawPoints, owned.division.drawPoints, 0, 10);
      const lossPoints = boundedInteger(payload.lossPoints, owned.division.lossPoints, 0, 10);
      if (!name || !["group_knockout", "knockout", "round_robin"].includes(format)) {
        return Response.json({ error: "Enter a division name and supported competition format." }, { status: 400 });
      }
      if (format === "group_knockout" && groupsCount * teamsAdvancingPerGroup > 128) {
        return Response.json({ error: "The configured group qualification would produce more than 128 knockout teams." }, { status: 400 });
      }
      const activeEntries = await db
        .select({ id: entries.id, groupName: entries.groupName })
        .from(entries)
        .where(and(eq(entries.divisionId, divisionId), inArray(entries.status, ["pending", "approved"])));
      if (activeEntries.length > maxTeams) {
        return Response.json({ error: `${activeEntries.length} active registrations already exceed the new ${maxTeams}-team limit.` }, { status: 409 });
      }
      if (format === "group_knockout") {
        const invalidGroup = activeEntries.find((entry) => {
          const letter = /^Group ([A-Z])$/.exec(entry.groupName)?.[1];
          return !letter || letter.charCodeAt(0) - 64 > groupsCount;
        });
        if (invalidGroup) {
          return Response.json({ error: "Move teams out of removed groups before reducing the group count." }, { status: 409 });
        }
      }
      const after = {
        name,
        format,
        maxTeams,
        groupsCount,
        teamsAdvancingPerGroup,
        maxSquadSize,
        feePaise,
        feeBasis: "per_team",
        requirePlayers: Boolean(payload.requirePlayers),
        requireDocuments: Boolean(payload.requirePlayers && payload.requireDocuments),
        winPoints,
        drawPoints,
        lossPoints,
        includeThirdPlace: format !== "round_robin" && Boolean(payload.includeThirdPlace),
      };
      try {
        await db.update(divisions).set(after).where(eq(divisions.id, divisionId));
      } catch {
        return Response.json({ error: "Another division already uses that name in this tournament." }, { status: 409 });
      }
      await writeAudit({
        tournamentId: owned.tournament.id,
        entityType: "division",
        entityId: divisionId,
        action: "division_rules_updated",
        actorEmail: user.email,
        before: owned.division,
        after,
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "addTeam") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned)
        return Response.json({ error: "Division not found" }, { status: 404 });
      if (
        owned.tournament.status !== "registration_open" ||
        (owned.tournament.registrationClosesAt && new Date(owned.tournament.registrationClosesAt).getTime() <= Date.now())
      ) {
        return Response.json({ error: "Registration is closed for this tournament." }, { status: 409 });
      }
      const teamName = clean(payload.teamName);
      const clubName = clean(payload.clubName) || teamName;
      const contactName = clean(payload.contactName, 100);
      const contactPhone = clean(payload.contactPhone, 20);
      if (!teamName || !contactName || !contactPhone || !validPhone(contactPhone)) {
        return Response.json(
          { error: "Team name, contact name and a valid phone number are required." },
          { status: 400 },
        );
      }
      const currentEntries = await db
        .select({ id: entries.id, status: entries.status })
        .from(entries)
        .where(eq(entries.divisionId, divisionId));
      const activeEntries = currentEntries.filter((entry) => ["pending", "approved"].includes(entry.status));
      if (activeEntries.length >= owned.division.maxTeams) {
        return Response.json(
          { error: "This division is full." },
          { status: 409 },
        );
      }
      const clubId = crypto.randomUUID();
      const teamId = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      const approved = Boolean(payload.approved);
      const requestedGroup = clean(payload.groupName, 20);
      const groupIndex = activeEntries.length % Math.max(1, owned.division.groupsCount);
      const groupName = requestedGroup || `Group ${String.fromCharCode(65 + groupIndex)}`;
      const paymentStatus = clean(payload.paymentStatus, 20) || "unpaid";
      if (!paymentStatuses.has(paymentStatus)) {
        return Response.json({ error: "Choose a valid payment status." }, { status: 400 });
      }

      await db.batch([
        db.insert(clubs).values({
          id: clubId,
          ownerEmail: user.email,
          name: clubName,
          organizationType: clean(payload.organizationType, 30) || "club",
          city: clean(payload.city, 100),
          contactName,
          contactPhone,
        }),
        db.insert(teams).values({ id: teamId, clubId, name: teamName }),
        db.insert(entries).values({
          id: entryId,
          divisionId,
          teamId,
          status: approved ? "approved" : "pending",
          paymentStatus,
          amountPaise: owned.division.feePaise,
          groupName,
          approvedAt: approved ? new Date().toISOString() : null,
        }),
      ]);
      return Response.json({ id: entryId, clubId }, { status: 201 });
    }

    if (payload.action === "updateEntry") {
      const entryId = clean(payload.entryId, 50);
      const [owned] = await db
        .select({ entry: entries, division: divisions, tournamentId: tournaments.id })
        .from(entries)
        .innerJoin(divisions, eq(entries.divisionId, divisions.id))
        .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
        .where(
          and(
            eq(entries.id, entryId),
            eq(tournaments.organizerEmail, user.email),
          ),
        )
        .limit(1);
      if (!owned)
        return Response.json({ error: "Entry not found" }, { status: 404 });
      const status = clean(payload.status, 20) || owned.entry.status;
      const paymentStatus =
        clean(payload.paymentStatus, 20) || owned.entry.paymentStatus;
      const groupName = clean(payload.groupName, 20) || owned.entry.groupName;
      let seed = owned.entry.seed;
      if (payload.seed !== undefined) {
        const rawSeed = clean(payload.seed, 10);
        seed = rawSeed ? Math.round(numberValue(rawSeed, 0)) : null;
      }

      if (!entryStatuses.has(status) || !paymentStatuses.has(paymentStatus)) {
        return Response.json({ error: "Invalid entry or payment status." }, { status: 400 });
      }
      if (seed !== null && (!Number.isInteger(seed) || seed < 1 || seed > owned.division.maxTeams)) {
        return Response.json({ error: `Seed must be between 1 and ${owned.division.maxTeams}, or left empty.` }, { status: 400 });
      }
      if (seed !== null && ["pending", "approved"].includes(status)) {
        const [duplicateSeed] = await db
          .select({ id: entries.id })
          .from(entries)
          .where(and(
            eq(entries.divisionId, owned.entry.divisionId),
            eq(entries.seed, seed),
            inArray(entries.status, ["pending", "approved"]),
          ))
          .limit(1);
        if (duplicateSeed && duplicateSeed.id !== entryId) {
          return Response.json({ error: `Seed ${seed} is already assigned to another team.` }, { status: 409 });
        }
      }
      const groupNumber = /^Group ([A-Z])$/.exec(groupName)?.[1]?.charCodeAt(0);
      if (
        !groupNumber ||
        groupNumber - 64 < 1 ||
        groupNumber - 64 > Math.max(1, owned.division.groupsCount)
      ) {
        return Response.json(
          { error: `Choose a group between Group A and Group ${String.fromCharCode(64 + Math.max(1, owned.division.groupsCount))}.` },
          { status: 400 },
        );
      }
      const [scheduledFixture] = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(eq(fixtures.divisionId, owned.entry.divisionId))
        .limit(1);
      if (
        scheduledFixture &&
        (status !== owned.entry.status || groupName !== owned.entry.groupName || seed !== owned.entry.seed)
      ) {
        return Response.json(
          { error: "Team approval and group placement are locked after fixture generation. Reset the unstarted schedule first." },
          { status: 409 },
        );
      }
      if (status === "approved" && owned.entry.status !== "approved") {
        const active = await db
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(
              eq(entries.divisionId, owned.entry.divisionId),
              inArray(entries.status, ["pending", "approved"]),
            ),
          );
        const otherActive = active.filter((entry) => entry.id !== entryId).length;
        if (otherActive >= owned.division.maxTeams) {
          return Response.json({ error: "This division has reached its team limit." }, { status: 409 });
        }
      }

      await db
        .update(entries)
        .set({
          status,
          paymentStatus,
          groupName,
          seed,
          approvedAt:
            status === "approved"
              ? owned.entry.status === "approved"
                ? owned.entry.approvedAt
                : new Date().toISOString()
              : null,
        })
        .where(eq(entries.id, entryId));
      await writeAudit({
        tournamentId: owned.tournamentId,
        entityType: "entry",
        entityId: entryId,
        action: "registration_updated",
        actorEmail: user.email,
        before: owned.entry,
        after: { status, paymentStatus, groupName, seed },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "assignClubStaff") {
      const clubId = clean(payload.clubId, 50);
      const userEmail = normalizedEmail(payload.userEmail);
      const role = clean(payload.role, 30) || "coach";
      const status = clean(payload.status, 20) || "active";
      const club = await manageableClub(clubId, user.email);
      if (!club) return Response.json({ error: "Club not found or access denied." }, { status: 404 });
      if (!/^\S+@\S+\.\S+$/.test(userEmail) || !staffRoles.has(role) || !assignmentStatuses.has(status)) {
        return Response.json({ error: "Enter a valid staff email, role and status." }, { status: 400 });
      }
      const [existing] = await db
        .select()
        .from(clubStaffAssignments)
        .where(
          and(
            eq(clubStaffAssignments.clubId, clubId),
            eq(clubStaffAssignments.userEmail, userEmail),
            eq(clubStaffAssignments.role, role),
          ),
        )
        .limit(1);
      if (existing) {
        await db.update(clubStaffAssignments).set({ status }).where(eq(clubStaffAssignments.id, existing.id));
      } else {
        await db.insert(clubStaffAssignments).values({
          id: crypto.randomUUID(),
          clubId,
          userEmail,
          role,
          status,
          assignedByEmail: user.email,
        });
      }
      const [scope] = await db
        .select({ tournamentId: tournaments.id })
        .from(teams)
        .innerJoin(entries, eq(entries.teamId, teams.id))
        .innerJoin(divisions, eq(divisions.id, entries.divisionId))
        .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
        .where(eq(teams.clubId, clubId))
        .limit(1);
      await writeAudit({
        tournamentId: scope?.tournamentId,
        entityType: "club",
        entityId: clubId,
        action: status === "active" ? "staff_assigned" : "staff_revoked",
        actorEmail: user.email,
        before: existing ?? {},
        after: { userEmail, role, status },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "assignFixtureOfficial") {
      const fixtureId = clean(payload.fixtureId, 50);
      const userEmail = normalizedEmail(payload.userEmail);
      const status = clean(payload.status, 20) || "assigned";
      const fixture = await ownedFixture(fixtureId, user.email);
      if (!fixture) return Response.json({ error: "Fixture not found or access denied." }, { status: 404 });
      if (!/^\S+@\S+\.\S+$/.test(userEmail) || !officialStatuses.has(status)) {
        return Response.json({ error: "Enter a valid referee email and assignment status." }, { status: 400 });
      }
      const [existing] = await db
        .select()
        .from(fixtureOfficials)
        .where(and(eq(fixtureOfficials.fixtureId, fixtureId), eq(fixtureOfficials.role, "referee")))
        .limit(1);
      if (existing) {
        await db.update(fixtureOfficials).set({ userEmail, status, assignedByEmail: user.email }).where(eq(fixtureOfficials.id, existing.id));
      } else {
        await db.insert(fixtureOfficials).values({
          id: crypto.randomUUID(),
          fixtureId,
          userEmail,
          role: "referee",
          status,
          assignedByEmail: user.email,
        });
      }
      await writeAudit({
        tournamentId: await tournamentIdForFixture(fixtureId),
        entityType: "fixture",
        entityId: fixtureId,
        action: status === "assigned" ? "referee_assigned" : "referee_revoked",
        actorEmail: user.email,
        before: existing ?? {},
        after: { userEmail, role: "referee", status },
      });
      return Response.json({ ok: true });
    }

    // --- PLAYER & SQUAD MANAGEMENT ACTIONS ---

    if (payload.action === "addPlayer") {
      const clubId = clean(payload.clubId, 50);
      const name = clean(payload.name, 100);
      const jerseyNumber = numberValue(payload.jerseyNumber, 0);
      const position = clean(payload.position, 10).toUpperCase() || "MID";
      const isCaptain = Boolean(payload.isCaptain);
      const dateOfBirth = clean(payload.dateOfBirth, 20) || null;

      const club = await manageableClub(clubId, user.email);
      if (!club) {
        return Response.json({ error: "Club not found or access denied" }, { status: 404 });
      }
      if (!name || !Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99 || !playerPositions.has(position)) {
        return Response.json({ error: "Club and player name are required" }, { status: 400 });
      }
      if (dateOfBirth && !validDate(dateOfBirth)) {
        return Response.json({ error: "Enter a valid date of birth." }, { status: 400 });
      }

      const playerId = crypto.randomUUID();
      const [jerseyTaken] = await db
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.clubId, clubId), eq(players.jerseyNumber, jerseyNumber)))
        .limit(1);
      if (jerseyTaken) {
        return Response.json({ error: `Jersey number ${jerseyNumber} is already used by this club.` }, { status: 409 });
      }
      const insertPlayer = db.insert(players).values({
          id: playerId,
          clubId,
          name,
          jerseyNumber,
          position,
          isCaptain,
          dateOfBirth,
        });
      if (isCaptain) {
        await db.batch([
          db.update(players).set({ isCaptain: false }).where(eq(players.clubId, clubId)),
          insertPlayer,
        ]);
      } else {
        await insertPlayer;
      }

      return Response.json({ id: playerId }, { status: 201 });
    }

    if (payload.action === "editPlayer") {
      const playerId = clean(payload.playerId, 50);
      const name = clean(payload.name, 100);
      const jerseyNumber = numberValue(payload.jerseyNumber, 0);
      const position = clean(payload.position, 10).toUpperCase() || "MID";
      const isCaptain = Boolean(payload.isCaptain);
      const dateOfBirth = clean(payload.dateOfBirth, 20) || null;

      const [existingPlayer] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (!existingPlayer || !(await manageableClub(existingPlayer.clubId, user.email))) {
        return Response.json({ error: "Player not found or access denied" }, { status: 404 });
      }
      if (!name || !Number.isInteger(jerseyNumber) || jerseyNumber < 1 || jerseyNumber > 99 || !playerPositions.has(position)) {
        return Response.json({ error: "Player ID and name are required" }, { status: 400 });
      }
      if (dateOfBirth && !validDate(dateOfBirth)) {
        return Response.json({ error: "Enter a valid date of birth." }, { status: 400 });
      }
      const [jerseyTaken] = await db
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.clubId, existingPlayer.clubId), eq(players.jerseyNumber, jerseyNumber)))
        .limit(1);
      if (jerseyTaken && jerseyTaken.id !== playerId) {
        return Response.json({ error: `Jersey number ${jerseyNumber} is already used by this club.` }, { status: 409 });
      }

      const updatePlayer = db.update(players).set({ name, jerseyNumber, position, isCaptain, dateOfBirth }).where(eq(players.id, playerId));
      if (isCaptain) {
        await db.batch([
          db.update(players).set({ isCaptain: false }).where(eq(players.clubId, existingPlayer.clubId)),
          updatePlayer,
        ]);
      } else {
        await updatePlayer;
      }

      return Response.json({ ok: true });
    }

    if (payload.action === "deletePlayer") {
      const playerId = clean(payload.playerId, 50);
      if (!playerId) return Response.json({ error: "Player ID required" }, { status: 400 });
      const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
      if (!player || !(await manageableClub(player.clubId, user.email))) {
        return Response.json({ error: "Player not found or access denied" }, { status: 404 });
      }
      await db.delete(players).where(eq(players.id, playerId));
      return Response.json({ ok: true });
    }

    if (payload.action === "updateSquad") {
      const entryId = clean(payload.entryId, 50);
      const squadList = Array.isArray(payload.squad) ? payload.squad : [];

      if (!entryId) return Response.json({ error: "Entry ID required" }, { status: 400 });

      const manageable = await manageableEntry(entryId, user.email);
      if (!manageable) {
        return Response.json({ error: "Squad not found or access denied" }, { status: 404 });
      }

      const normalized = squadList.map((item) => {
        const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
        return {
          playerId: clean(row.playerId, 50),
          isStarting: Boolean(row.isStarting),
          jerseyNumberOverride: row.jerseyNumber == null ? null : numberValue(row.jerseyNumber),
          positionOverride: clean(row.position, 10).toUpperCase() || null,
        };
      });
      const playerIds = normalized.map((item) => item.playerId);
      if (
        playerIds.some((id) => !id) ||
        new Set(playerIds).size !== playerIds.length ||
        normalized.length > manageable.division.maxSquadSize ||
        normalized.filter((item) => item.isStarting).length > 11
      ) {
        return Response.json(
          { error: `Squad must contain unique club players, no more than ${manageable.division.maxSquadSize} total and no more than 11 starters.` },
          { status: 400 },
        );
      }
      if (normalized.some((item) =>
        (item.jerseyNumberOverride !== null && (!Number.isInteger(item.jerseyNumberOverride) || item.jerseyNumberOverride < 1 || item.jerseyNumberOverride > 99)) ||
        (item.positionOverride !== null && !playerPositions.has(item.positionOverride))
      )) {
        return Response.json({ error: "Squad jersey overrides must be 1-99 and positions must be GK, DEF, MID or FWD." }, { status: 400 });
      }
      const validPlayers = playerIds.length
        ? await db.select({ id: players.id }).from(players).where(
            and(inArray(players.id, playerIds), eq(players.clubId, manageable.club.id)),
          )
        : [];
      if (validPlayers.length !== playerIds.length) {
        return Response.json({ error: "Every selected player must belong to this club." }, { status: 400 });
      }

      if (normalized.length > 0) {
        const rows = normalized.map((item) => ({
          id: crypto.randomUUID(),
          entryId,
          ...item,
        }));
        await db.batch([
          db.delete(squadMembers).where(eq(squadMembers.entryId, entryId)),
          db.insert(squadMembers).values(rows),
        ]);
      } else {
        await db.delete(squadMembers).where(eq(squadMembers.entryId, entryId));
      }

      return Response.json({ ok: true });
    }

    // --- FIXTURE & BRACKET GENERATION ACTIONS ---

    if (payload.action === "resetSchedule") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned) return Response.json({ error: "Division not found" }, { status: 404 });
      if (owned.tournament.status !== "scheduled") {
        return Response.json(
          { error: "Schedules can only be reset before the tournament goes live." },
          { status: 409 },
        );
      }
      const divisionFixtures = await db.select().from(fixtures).where(eq(fixtures.divisionId, divisionId));
      if (!divisionFixtures.length) {
        return Response.json({ error: "This division does not have a schedule to reset." }, { status: 409 });
      }
      if (divisionFixtures.some((fixture) => !["scheduled", "postponed"].includes(fixture.status))) {
        return Response.json(
          { error: "A schedule cannot be reset after a match has started or completed." },
          { status: 409 },
        );
      }
      const fixtureIds = divisionFixtures.map((fixture) => fixture.id);
      const [recordedEvent] = await db
        .select({ id: matchEvents.id })
        .from(matchEvents)
        .where(inArray(matchEvents.fixtureId, fixtureIds))
        .limit(1);
      if (recordedEvent) {
        return Response.json(
          { error: "This schedule contains recorded match events and cannot be reset." },
          { status: 409 },
        );
      }
      const state = await tournamentFixtureState(owned.tournament.id);
      const otherFixtures = state.fixtures.filter((fixture) => fixture.divisionId !== divisionId);
      await db.batch([
        db.delete(fixtures).where(eq(fixtures.divisionId, divisionId)),
        db.update(divisions).set({ knockoutByeEntryIds: "[]" }).where(eq(divisions.id, divisionId)),
        ...(otherFixtures.length === 0
          ? [db.update(tournaments).set({ status: "registration_closed", updatedAt: new Date().toISOString() }).where(eq(tournaments.id, owned.tournament.id))]
          : []),
      ]);
      await writeAudit({
        tournamentId: owned.tournament.id,
        entityType: "division",
        entityId: divisionId,
        action: "schedule_reset",
        actorEmail: user.email,
        before: { fixtureCount: divisionFixtures.length },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "retryKnockoutProgression") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned) return Response.json({ error: "Division not found" }, { status: 404 });
      if (!["scheduled", "live"].includes(owned.tournament.status)) {
        return Response.json({ error: "Knockout progression is not available at this tournament stage." }, { status: 409 });
      }
      const bracketFixtures = await db
        .select()
        .from(fixtures)
        .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.stage, "knockout")))
        .orderBy(desc(fixtures.roundNumber), asc(fixtures.bracketMatchIndex));
      const progressionRounds = new Set([
        "round_of_128",
        "round_of_64",
        "round_of_32",
        "round_of_16",
        "quarter_final",
        "semi_final",
      ]);
      const latestProgressionFixture = bracketFixtures.find((fixture) =>
        fixture.bracketRound && progressionRounds.has(fixture.bracketRound),
      );
      if (!latestProgressionFixture) {
        return Response.json({ error: "There is no completed knockout round waiting to advance." }, { status: 409 });
      }
      try {
        const created = await progressKnockoutRound(latestProgressionFixture);
        if (!created) {
          return Response.json({ error: "Finish the current round first, or refresh because the next round already exists." }, { status: 409 });
        }
        await writeAudit({
          tournamentId: owned.tournament.id,
          entityType: "division",
          entityId: divisionId,
          action: "knockout_progression_retried",
          actorEmail: user.email,
          after: { fixtureCount: created },
        });
        return Response.json({ ok: true, fixtureCount: created });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "The next round could not be scheduled." },
          { status: 409 },
        );
      }
    }

    if (payload.action === "postponeFixture") {
      const fixtureId = clean(payload.fixtureId, 50);
      const reason = clean(payload.reason, 500);
      const fixture = await ownedFixture(fixtureId, user.email);
      if (!fixture) return Response.json({ error: "Fixture not found" }, { status: 404 });
      if (fixture.status !== "scheduled") {
        return Response.json({ error: "Only a scheduled match can be postponed." }, { status: 409 });
      }
      if (reason.length < 8) {
        return Response.json({ error: "Give a short reason for postponing this match." }, { status: 400 });
      }
      await db.update(fixtures).set({ status: "postponed", clockRunning: false }).where(eq(fixtures.id, fixtureId));
      await writeAudit({
        tournamentId: await tournamentIdForFixture(fixtureId),
        entityType: "fixture",
        entityId: fixtureId,
        action: "fixture_postponed",
        actorEmail: user.email,
        before: { status: fixture.status, kickoffAt: fixture.kickoffAt },
        after: { status: "postponed", reason },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "rescheduleFixture") {
      const fixtureId = clean(payload.fixtureId, 50);
      const fixture = await ownedFixture(fixtureId, user.email);
      if (!fixture) return Response.json({ error: "Fixture not found" }, { status: 404 });
      if (!["scheduled", "postponed"].includes(fixture.status)) {
        return Response.json({ error: "Started or completed matches cannot be rescheduled." }, { status: 409 });
      }
      const owned = await ownedDivision(fixture.divisionId, user.email);
      if (!owned) return Response.json({ error: "Division not found" }, { status: 404 });
      const date = clean(payload.date, 10);
      const time = timeValue(payload.time, "");
      const pitch = boundedInteger(payload.pitch, fixture.pitch, 1, 12);
      const reason = clean(payload.reason, 500);
      if (!validDate(date) || !time || reason.length < 8) {
        return Response.json({ error: "Enter a valid date, time and reason for the schedule change." }, { status: 400 });
      }
      const endDate = tournamentEndDate(owned.tournament.startDate, owned.tournament.durationDays);
      if (date < owned.tournament.startDate || date > endDate) {
        return Response.json({ error: `Choose a date between ${owned.tournament.startDate} and ${endDate}.` }, { status: 400 });
      }
      const [storedPolicy] = await db.select().from(schedulePolicies).where(eq(schedulePolicies.divisionId, fixture.divisionId)).limit(1);
      const policy = storedPolicy ?? defaultSchedulePolicy(fixture.divisionId);
      const kickoffAt = new Date(`${date}T${time}:00+05:30`).toISOString();
      const kickoffEnd = new Date(kickoffAt).getTime() + policy.matchDurationMinutes * 60_000;
      const dailyEnd = new Date(`${date}T${policy.dayEndTime}:00+05:30`).getTime();
      if (
        pitch > policy.pitchCount ||
        time < policy.firstKickoffTime ||
        time >= policy.dayEndTime ||
        kickoffEnd > dailyEnd
      ) {
        return Response.json(
          { error: `Use pitches 1-${policy.pitchCount}; the full match must fit between ${policy.firstKickoffTime} and ${policy.dayEndTime}.` },
          { status: 400 },
        );
      }
      const tournamentDivisionIds = (await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.tournamentId, owned.tournament.id))).map((item) => item.id);
      const tournamentFixtures = tournamentDivisionIds.length
        ? await db.select().from(fixtures).where(inArray(fixtures.divisionId, tournamentDivisionIds))
        : [];
      const policyRows = tournamentDivisionIds.length
        ? await db.select().from(schedulePolicies).where(inArray(schedulePolicies.divisionId, tournamentDivisionIds))
        : [];
      const policyByDivision = new Map(policyRows.map((item) => [item.divisionId, item]));
      const conflict = scheduleConflict(
        {
          fixtureId,
          kickoffAt,
          pitch,
          homeEntryId: fixture.homeEntryId,
          awayEntryId: fixture.awayEntryId,
          durationMinutes: policy.matchDurationMinutes,
          minimumRestMinutes: policy.minimumRestMinutes,
          bufferMinutes: policy.bufferMinutes,
        },
        tournamentFixtures.map((item) => {
          const itemPolicy = policyByDivision.get(item.divisionId) ?? defaultSchedulePolicy(item.divisionId);
          return {
            id: item.id,
            kickoffAt: item.kickoffAt,
            pitch: item.pitch,
            homeEntryId: item.homeEntryId,
            awayEntryId: item.awayEntryId,
            durationMinutes: itemPolicy.matchDurationMinutes,
            bufferMinutes: itemPolicy.bufferMinutes,
            status: item.status,
          };
        }),
      );
      if (conflict) return Response.json({ error: conflict }, { status: 409 });
      await db.update(fixtures).set({ kickoffAt, pitch, status: "scheduled", period: "scheduled" }).where(eq(fixtures.id, fixtureId));
      await writeAudit({
        tournamentId: owned.tournament.id,
        entityType: "fixture",
        entityId: fixtureId,
        action: "fixture_rescheduled",
        actorEmail: user.email,
        before: { kickoffAt: fixture.kickoffAt, pitch: fixture.pitch, status: fixture.status },
        after: { kickoffAt, pitch, status: "scheduled", reason },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "generateFixtures") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned)
        return Response.json({ error: "Division not found" }, { status: 404 });
      const approvedEntries = await db
        .select({ id: entries.id, groupName: entries.groupName, seed: entries.seed })
        .from(entries)
        .where(
          and(
            eq(entries.divisionId, divisionId),
            eq(entries.status, "approved"),
          ),
        )
        .orderBy(sql`CASE WHEN ${entries.seed} IS NULL THEN 1 ELSE 0 END`, asc(entries.seed), asc(entries.registeredAt));
      if (approvedEntries.length < 2) {
        return Response.json(
          { error: "Approve at least two teams before generating fixtures." },
          { status: 400 },
        );
      }

      const unresolvedEntries = await db
        .select({ id: entries.id })
        .from(entries)
        .where(and(eq(entries.divisionId, divisionId), eq(entries.status, "pending")));
      if (unresolvedEntries.length) {
        return Response.json(
          { error: `Resolve all ${unresolvedEntries.length} pending registration(s) before publishing fixtures.` },
          { status: 409 },
        );
      }
      const deadlinePassed = Boolean(
        owned.tournament.registrationClosesAt &&
        new Date(owned.tournament.registrationClosesAt).getTime() <= Date.now(),
      );
      if (
        !["registration_closed", "scheduled"].includes(owned.tournament.status) &&
        !(owned.tournament.status === "registration_open" && deadlinePassed)
      ) {
        return Response.json(
          { error: "Close registration before generating the official schedule." },
          { status: 409 },
        );
      }

      const mode = clean(payload.mode, 20) || owned.division.format;
      const startDate = clean(payload.startDate, 10);
      const policy = schedulePolicyValues(payload);
      const includeThirdPlace = Boolean(payload.includeThirdPlace);
      const teamsAdvancingPerGroup = Math.max(
        1,
        Math.min(32, Math.round(numberValue(payload.teamsAdvancingPerGroup, owned.division.teamsAdvancingPerGroup))),
      );
      if (!startDate)
        return Response.json({ error: "A fixture date is required." }, { status: 400 });
      if (!["knockout", "group_knockout", "round_robin"].includes(mode)) {
        return Response.json({ error: "Choose a supported tournament format." }, { status: 400 });
      }

      const existingFixtures = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(eq(fixtures.divisionId, divisionId));
      if (existingFixtures.length > 0) {
        return Response.json(
          { error: "A schedule already exists. Delete or complete the existing fixtures before generating another one." },
          { status: 409 },
        );
      }

      const pairings: SchedulePairing[] = [];
      let byeEntryIds: string[] = [];
      let knockoutRoundCount = 0;

      if (mode === "knockout") {
        const initial = initialKnockoutBracket(approvedEntries.map((entry) => entry.id));
        pairings.push(...initial.pairings);
        byeEntryIds = initial.byeEntryIds;
        knockoutRoundCount = Math.log2(initial.bracketSize);
      } else if (mode === "group_knockout") {
        const groups: Record<string, string[]> = {};
        for (const entry of approvedEntries) {
          const gName = entry.groupName || "Group A";
          if (!groups[gName]) groups[gName] = [];
          groups[gName].push(entry.id);
        }

        if (Object.keys(groups).length < 2 || Object.values(groups).some((group) => group.length < 2)) {
          return Response.json(
            { error: "Group + knockout format requires at least two groups with two approved teams in each group." },
            { status: 400 },
          );
        }
        if (Object.values(groups).some((group) => group.length < teamsAdvancingPerGroup)) {
          return Response.json(
            { error: "Each group must contain at least as many teams as the number advancing to the cup stage." },
            { status: 400 },
          );
        }
        for (const [groupName, groupEntryIds] of Object.entries(groups).sort(([left], [right]) => left.localeCompare(right))) {
          pairings.push(...roundRobinPairings(groupEntryIds, { labelPrefix: groupName, legs: 1 }));
        }
      } else {
        pairings.push(...roundRobinPairings(
          approvedEntries.map((item) => item.id),
          { legs: policy.leagueLegs },
        ));
      }

      if (!validDate(startDate)) {
        return Response.json({ error: "Enter a valid fixture date and time." }, { status: 400 });
      }
      const tournamentEnd = tournamentEndDate(owned.tournament.startDate, owned.tournament.durationDays);
      if (startDate < owned.tournament.startDate || startDate > tournamentEnd) {
        return Response.json(
          { error: `Fixture scheduling must begin between ${owned.tournament.startDate} and ${tournamentEnd}.` },
          { status: 400 },
        );
      }
      if (mode === "knockout" && knockoutRoundCount > 1) {
        let finalRoundDate = startDate;
        for (let round = 1; round < knockoutRoundCount; round += 1) {
          finalRoundDate = nextScheduleDateAfter(
            new Date(`${finalRoundDate}T${policy.firstKickoffTime}:00+05:30`).toISOString(),
            policy.knockoutWeekendOnly,
          );
        }
        if (finalRoundDate > tournamentEnd) {
          return Response.json(
            { error: `The full knockout bracket needs dates through ${finalRoundDate}. Extend the tournament duration before generating it.` },
            { status: 409 },
          );
        }
      }
      const remainingDays = Math.round(
        (Date.parse(`${tournamentEnd}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
      ) + 1;
      const tournamentDivisionIds = (await db
        .select({ id: divisions.id })
        .from(divisions)
        .where(eq(divisions.tournamentId, owned.tournament.id))).map((item) => item.id);
      const otherFixtures = tournamentDivisionIds.length
        ? await db.select().from(fixtures).where(inArray(fixtures.divisionId, tournamentDivisionIds))
        : [];
      const otherPolicies = tournamentDivisionIds.length
        ? await db.select().from(schedulePolicies).where(inArray(schedulePolicies.divisionId, tournamentDivisionIds))
        : [];
      const policyByDivision = new Map(otherPolicies.map((item) => [item.divisionId, item]));
      const blockedSlots: BlockedSlot[] = otherFixtures
        .filter((fixture) => fixture.divisionId !== divisionId && !["cancelled", "postponed"].includes(fixture.status))
        .map((fixture) => {
          const otherPolicy = policyByDivision.get(fixture.divisionId) ?? defaultSchedulePolicy(fixture.divisionId);
          return {
            fixtureId: fixture.id,
            kickoffAt: fixture.kickoffAt,
            pitch: fixture.pitch,
            durationMinutes: otherPolicy.matchDurationMinutes,
            bufferMinutes: otherPolicy.bufferMinutes,
            homeEntryId: fixture.homeEntryId,
            awayEntryId: fixture.awayEntryId,
          };
        });
      let scheduledPairings;
      try {
        scheduledPairings = buildTournamentSchedule(pairings, {
          startDate,
          durationDays: remainingDays,
          firstKickoffTime: policy.firstKickoffTime,
          dayEndTime: policy.dayEndTime,
          matchDurationMinutes: policy.matchDurationMinutes,
          bufferMinutes: policy.bufferMinutes,
          minimumRestMinutes: policy.minimumRestMinutes,
          pitchCount: policy.pitchCount,
          longBreakAfterMatches: policy.longBreakAfterMatches,
          longBreakMinutes: policy.longBreakMinutes,
        }, blockedSlots);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "The schedule could not be created." },
          { status: 409 },
        );
      }
      const fixtureRows: Array<typeof fixtures.$inferInsert> = scheduledPairings.map((pair) => ({
          id: crypto.randomUUID(),
          divisionId,
          roundNumber: pair.round,
          roundName: pair.roundName,
          stage: pair.stage,
          bracketRound: pair.bracketRound || null,
          bracketMatchIndex: pair.bracketIndex || null,
          homeEntryId: pair.home,
          awayEntryId: pair.away,
          kickoffAt: pair.kickoffAt,
          pitch: pair.pitch,
          status: "scheduled",
          period: "scheduled",
          matchClockMinute: 0,
          homeScore: 0,
          awayScore: 0,
          homeScorePenalties: 0,
          awayScorePenalties: 0,
      }));

      const updateDivision = db
        .update(divisions)
        .set({
          format: mode,
          teamsAdvancingPerGroup,
          includeThirdPlace: mode !== "round_robin" && includeThirdPlace,
          knockoutByeEntryIds: JSON.stringify(byeEntryIds),
        })
        .where(eq(divisions.id, divisionId));
      const savePolicy = db
        .insert(schedulePolicies)
        .values({ id: crypto.randomUUID(), divisionId, ...policy })
        .onConflictDoUpdate({ target: schedulePolicies.divisionId, set: policy });
      await db.batch([
        updateDivision,
        savePolicy,
        db.insert(fixtures).values(fixtureRows),
        db.update(tournaments).set({ status: "scheduled", updatedAt: new Date().toISOString() }).where(eq(tournaments.id, owned.tournament.id)),
      ]);
      await writeAudit({
        tournamentId: owned.tournament.id,
        entityType: "division",
        entityId: divisionId,
        action: "schedule_generated",
        actorEmail: user.email,
        after: { mode, fixtureCount: fixtureRows.length, startDate, ...policy },
      });
      return Response.json({ fixtures: fixtureRows }, { status: 201 });
    }

    if (payload.action === "generateKnockoutStage") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned || owned.division.format !== "group_knockout") {
        return Response.json({ error: "Group + knockout division not found." }, { status: 404 });
      }

      const groupFixtures = await db
        .select()
        .from(fixtures)
        .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.stage, "group")));
      if (!groupFixtures.length || groupFixtures.some((fixture) => fixture.status !== "completed")) {
        return Response.json({ error: "Complete every group match before generating the knockout stage." }, { status: 409 });
      }
      const [existingKnockout] = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(and(eq(fixtures.divisionId, divisionId), eq(fixtures.stage, "knockout")))
        .limit(1);
      if (existingKnockout) {
        return Response.json({ error: "The knockout stage already exists." }, { status: 409 });
      }

      const approved = await db
        .select({ id: entries.id, groupName: entries.groupName })
        .from(entries)
        .where(and(eq(entries.divisionId, divisionId), eq(entries.status, "approved")));
      const groups = new Map<string, Array<{ id: string; points: number; gf: number; ga: number }>>();
      for (const entry of approved) {
        const groupName = entry.groupName || "Group A";
        const list = groups.get(groupName) ?? [];
        list.push({ id: entry.id, points: 0, gf: 0, ga: 0 });
        groups.set(groupName, list);
      }
      for (const fixture of groupFixtures) {
        const group = [...groups.values()].find(
          (rows) => rows.some((row) => row.id === fixture.homeEntryId) && rows.some((row) => row.id === fixture.awayEntryId),
        );
        if (!group) continue;
        const home = group.find((row) => row.id === fixture.homeEntryId)!;
        const away = group.find((row) => row.id === fixture.awayEntryId)!;
        home.gf += fixture.homeScore;
        home.ga += fixture.awayScore;
        away.gf += fixture.awayScore;
        away.ga += fixture.homeScore;
        if (fixture.homeScore > fixture.awayScore) {
          home.points += owned.division.winPoints;
          away.points += owned.division.lossPoints;
        } else if (fixture.homeScore < fixture.awayScore) {
          away.points += owned.division.winPoints;
          home.points += owned.division.lossPoints;
        } else {
          home.points += owned.division.drawPoints;
          away.points += owned.division.drawPoints;
        }
      }

      const rankedGroups = [...groups.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, rows]) => ({
          name,
          rows: rows.sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id)),
        }));
      if (!rankedGroups.length || rankedGroups.some((group) => group.rows.length < owned.division.teamsAdvancingPerGroup)) {
        return Response.json(
          { error: "Every group must have enough completed teams for the configured qualification places." },
          { status: 400 },
        );
      }

      const qualifyingEntryIds: string[] = [];
      for (let rank = 0; rank < owned.division.teamsAdvancingPerGroup; rank += 1) {
        for (const group of rankedGroups) {
          const qualifier = group.rows[rank];
          if (qualifier) qualifyingEntryIds.push(qualifier.id);
        }
      }
      if (qualifyingEntryIds.length < 2 || qualifyingEntryIds.length > 128) {
        return Response.json(
          { error: "The knockout stage must produce between 2 and 128 qualifying teams." },
          { status: 400 },
        );
      }

      const initial = initialKnockoutBracket(qualifyingEntryIds);
      const latestGroupKickoff = Math.max(...groupFixtures.map((fixture) => new Date(fixture.kickoffAt).getTime()));
      const [storedPolicy] = await db.select().from(schedulePolicies).where(eq(schedulePolicies.divisionId, divisionId)).limit(1);
      const policy = storedPolicy ?? defaultSchedulePolicy(divisionId);
      const nextDate = nextScheduleDateAfter(
        new Date(Number.isFinite(latestGroupKickoff) ? latestGroupKickoff : Date.now()).toISOString(),
        policy.knockoutWeekendOnly,
      );
      const tournamentEnd = tournamentEndDate(owned.tournament.startDate, owned.tournament.durationDays);
      if (nextDate > tournamentEnd) {
        return Response.json(
          { error: "The knockout round falls outside the tournament dates. Extend the tournament duration first." },
          { status: 409 },
        );
      }
      let finalRoundDate = nextDate;
      for (let round = 1; round < Math.log2(initial.bracketSize); round += 1) {
        finalRoundDate = nextScheduleDateAfter(
          new Date(`${finalRoundDate}T${policy.firstKickoffTime}:00+05:30`).toISOString(),
          policy.knockoutWeekendOnly,
        );
      }
      if (finalRoundDate > tournamentEnd) {
        return Response.json(
          { error: `The knockout stage needs dates through ${finalRoundDate}. Extend the tournament duration first.` },
          { status: 409 },
        );
      }
      const remainingDays = Math.round(
        (Date.parse(`${tournamentEnd}T00:00:00Z`) - Date.parse(`${nextDate}T00:00:00Z`)) / 86_400_000,
      ) + 1;
      const tournamentDivisionIds = (await db.select({ id: divisions.id }).from(divisions).where(eq(divisions.tournamentId, owned.tournament.id))).map((item) => item.id);
      const allTournamentFixtures = await db.select().from(fixtures).where(inArray(fixtures.divisionId, tournamentDivisionIds));
      const allPolicyRows = await db.select().from(schedulePolicies).where(inArray(schedulePolicies.divisionId, tournamentDivisionIds));
      const policyByDivision = new Map(allPolicyRows.map((item) => [item.divisionId, item]));
      const blockedSlots: BlockedSlot[] = allTournamentFixtures
        .filter((fixture) => !["cancelled", "postponed"].includes(fixture.status))
        .map((fixture) => {
          const fixturePolicy = policyByDivision.get(fixture.divisionId) ?? defaultSchedulePolicy(fixture.divisionId);
          return {
            fixtureId: fixture.id,
            kickoffAt: fixture.kickoffAt,
            pitch: fixture.pitch,
            durationMinutes: fixturePolicy.matchDurationMinutes,
            bufferMinutes: fixturePolicy.bufferMinutes,
            homeEntryId: fixture.homeEntryId,
            awayEntryId: fixture.awayEntryId,
          };
        });
      let scheduledKnockout;
      try {
        scheduledKnockout = buildTournamentSchedule(initial.pairings, {
          startDate: nextDate,
          durationDays: remainingDays,
          firstKickoffTime: policy.firstKickoffTime,
          dayEndTime: policy.dayEndTime,
          matchDurationMinutes: policy.matchDurationMinutes,
          bufferMinutes: policy.bufferMinutes,
          minimumRestMinutes: policy.minimumRestMinutes,
          pitchCount: policy.pitchCount,
          longBreakAfterMatches: policy.longBreakAfterMatches,
          longBreakMinutes: policy.longBreakMinutes,
        }, blockedSlots);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "The knockout schedule could not be created." },
          { status: 409 },
        );
      }
      const knockoutRoundNumber = Math.max(...groupFixtures.map((fixture) => fixture.roundNumber)) + 1;
      const knockoutRows: Array<typeof fixtures.$inferInsert> = scheduledKnockout.map((pair) => ({
        id: crypto.randomUUID(),
        divisionId,
        roundNumber: knockoutRoundNumber,
        roundName: pair.roundName,
        stage: "knockout",
        bracketRound: pair.bracketRound,
        bracketMatchIndex: pair.bracketIndex,
        homeEntryId: pair.home,
        awayEntryId: pair.away,
        kickoffAt: pair.kickoffAt,
        pitch: pair.pitch,
      }));
      await db.batch([
        db
          .update(divisions)
          .set({ knockoutByeEntryIds: JSON.stringify(initial.byeEntryIds) })
          .where(eq(divisions.id, divisionId)),
        db.insert(fixtures).values(knockoutRows),
      ]);
      await writeAudit({
        tournamentId: owned.tournament.id,
        entityType: "division",
        entityId: divisionId,
        action: "knockout_stage_generated",
        actorEmail: user.email,
        after: { qualifierCount: qualifyingEntryIds.length, fixtureCount: knockoutRows.length, nextDate },
      });
      return Response.json(
        { fixtures: knockoutRows, byeEntryIds: initial.byeEntryIds },
        { status: 201 },
      );
    }

    if (payload.action === "advanceBracketWinner") {
      const fixtureId = clean(payload.fixtureId, 50);
      const winningEntryId = clean(payload.winningEntryId, 50);
      const losingEntryId = clean(payload.losingEntryId, 50);
      const homeScorePenalties = numberValue(payload.homeScorePenalties, 0);
      const awayScorePenalties = numberValue(payload.awayScorePenalties, 0);

      const access = await manageableFixture(fixtureId, user.email);
      const currentFix = access?.fixture;
      if (!currentFix) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (
        !winningEntryId ||
        !losingEntryId ||
        winningEntryId === losingEntryId ||
        ![currentFix.homeEntryId, currentFix.awayEntryId].includes(winningEntryId) ||
        ![currentFix.homeEntryId, currentFix.awayEntryId].includes(losingEntryId)
      ) {
        return Response.json({ error: "Select the winner and loser from this fixture." }, { status: 400 });
      }
      const resultSnapshot = matchSnapshot(currentFix, {
        homeScorePenalties,
        awayScorePenalties,
      });
      if (currentFix.period !== "penalties" || !canStartShootout(resultSnapshot)) {
        return Response.json(
          { error: "A shootout is only available for a tied, in-progress knockout match after normal or extra time." },
          { status: 409 },
        );
      }
      const persistedKicks = await db
        .select()
        .from(shootoutKicks)
        .where(eq(shootoutKicks.fixtureId, fixtureId))
        .orderBy(asc(shootoutKicks.sequence));
      const persistedState = calculateShootout(
        persistedKicks.map((kick) => ({
          isHome: kick.entryId === currentFix.homeEntryId,
          scored: kick.outcome === "goal",
        })),
      );
      if (
        !persistedState.isFinished ||
        persistedState.homeScore !== homeScorePenalties ||
        persistedState.awayScore !== awayScorePenalties
      ) {
        return Response.json(
          { error: "Legacy bracket advancement is disabled. Finish the database-backed shootout instead." },
          { status: 410 },
        );
      }
      let verifiedResult;
      try {
        verifiedResult = deriveKnockoutResult(resultSnapshot);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "The shootout needs a clear winner." },
          { status: 409 },
        );
      }
      if (
        verifiedResult.winnerEntryId !== winningEntryId ||
        verifiedResult.loserEntryId !== losingEntryId
      ) {
        return Response.json({ error: "The selected winner does not match the recorded result." }, { status: 409 });
      }

      // Mark current fixture as completed
      await db.update(fixtures).set({
        status: "completed",
        period: "completed",
        homeScorePenalties,
        awayScorePenalties,
        winnerEntryId: winningEntryId,
        loserEntryId: losingEntryId,
      }).where(eq(fixtures.id, fixtureId));
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "fixture",
        entityId: fixtureId,
        action: "shootout_completed",
        actorEmail: user.email,
        before: matchSnapshot(currentFix),
        after: resultSnapshot,
      });

      const currentRound = currentFix.bracketRound;
      const nextRoundByCurrent: Record<string, string> = {
        round_of_128: "round_of_64",
        round_of_64: "round_of_32",
        round_of_32: "round_of_16",
        round_of_16: "quarter_final",
        quarter_final: "semi_final",
        semi_final: "final",
      };
      const nextRound = currentRound ? nextRoundByCurrent[currentRound] : undefined;
      if (currentRound && nextRound) {
        const completedRound = await db
          .select()
          .from(fixtures)
          .where(
            and(
              eq(fixtures.divisionId, currentFix.divisionId),
              eq(fixtures.bracketRound, currentRound),
            ),
          )
          .orderBy(asc(fixtures.bracketMatchIndex));

        const roundReady =
          completedRound.length > 0 &&
          completedRound.every((match) => match.status === "completed" && match.winnerEntryId && match.loserEntryId);
        if (roundReady) {
          const alreadyGenerated = await db
            .select({ id: fixtures.id })
            .from(fixtures)
            .where(
              and(
                eq(fixtures.divisionId, currentFix.divisionId),
                eq(fixtures.bracketRound, nextRound),
              ),
            )
            .limit(1);

          if (!alreadyGenerated.length) {
            const [divisionConfig] = await db
              .select({
                includeThirdPlace: divisions.includeThirdPlace,
                knockoutByeEntryIds: divisions.knockoutByeEntryIds,
              })
              .from(divisions)
              .where(eq(divisions.id, currentFix.divisionId))
              .limit(1);
            let byeEntryIds: string[] = [];
            try {
              const parsed = JSON.parse(divisionConfig?.knockoutByeEntryIds || "[]");
              if (Array.isArray(parsed)) {
                byeEntryIds = parsed.filter((entryId): entryId is string => typeof entryId === "string");
              }
            } catch {
              byeEntryIds = [];
            }
            const latestKickoff = Math.max(...completedRound.map((match) => new Date(match.kickoffAt).getTime()));
            const nextKickoff = Number.isFinite(latestKickoff)
              ? latestKickoff + 24 * 60 * 60 * 1000
              : Date.now() + 24 * 60 * 60 * 1000;
            const winners = completedRound.map((match) => match.winnerEntryId as string);
            const losers = completedRound.map((match) => match.loserEntryId as string);
            const nextEntrants = byeEntryIds.length ? [...byeEntryIds, ...winners] : winners;
            const newFixtures: Array<typeof fixtures.$inferInsert> = [];

            if (nextRound === "final") {
              if (divisionConfig?.includeThirdPlace && losers.length === 2) {
                newFixtures.push({
                  id: crypto.randomUUID(),
                  divisionId: currentFix.divisionId,
                  roundNumber: currentFix.roundNumber + 1,
                  roundName: "3rd Place Playoff",
                  stage: "knockout",
                  bracketRound: "third_place",
                  bracketMatchIndex: 1,
                  homeEntryId: losers[0],
                  awayEntryId: losers[1],
                  kickoffAt: new Date(nextKickoff).toISOString(),
                  pitch: 1,
                });
              }
              newFixtures.push({
                  id: crypto.randomUUID(),
                  divisionId: currentFix.divisionId,
                  roundNumber: currentFix.roundNumber + 1,
                  roundName: "Grand Final",
                  stage: "knockout",
                  bracketRound: "final",
                  bracketMatchIndex: 1,
                  homeEntryId: nextEntrants[0],
                  awayEntryId: nextEntrants[1],
                  kickoffAt: new Date(nextKickoff + (divisionConfig?.includeThirdPlace && losers.length === 2 ? 3 : 0) * 60 * 60 * 1000).toISOString(),
                  pitch: 1,
                });
            } else {
              const label = knockoutRoundLabel(nextRound);
              const entrants = byeEntryIds.length
                ? nextEntrants.slice(0, nextEntrants.length / 2).flatMap((entryId, index) => [
                    entryId,
                    nextEntrants[nextEntrants.length - 1 - index],
                  ])
                : nextEntrants;
              for (let index = 0; index < entrants.length; index += 2) {
                newFixtures.push({
                  id: crypto.randomUUID(),
                  divisionId: currentFix.divisionId,
                  roundNumber: currentFix.roundNumber + 1,
                  roundName: `${label} ${index / 2 + 1}`,
                  stage: "knockout",
                  bracketRound: nextRound,
                  bracketMatchIndex: index / 2 + 1,
                  homeEntryId: entrants[index],
                  awayEntryId: entrants[index + 1],
                  kickoffAt: new Date(nextKickoff + (index / 2) * 2 * 60 * 60 * 1000).toISOString(),
                  pitch: 1,
                });
              }
            }
            if (newFixtures.length) {
              if (byeEntryIds.length) {
                await db.batch([
                  db
                    .update(divisions)
                    .set({ knockoutByeEntryIds: "[]" })
                    .where(eq(divisions.id, currentFix.divisionId)),
                  db.insert(fixtures).values(newFixtures),
                ]);
              } else {
                await db.insert(fixtures).values(newFixtures);
              }
            }
          }
        }
      }

      return Response.json({ ok: true });
    }

    // --- LIVE MATCHDAY ACTIONS ---

    if (payload.action === "updateLiveMatch") {
      const fixtureId = clean(payload.fixtureId, 50);
      const status = clean(payload.status, 20);
      const period = clean(payload.period, 20);
      const matchClockMinute = payload.matchClockMinute !== undefined
        ? numberValue(payload.matchClockMinute, 0)
        : undefined;
      const refereeNotes = payload.refereeNotes !== undefined
        ? clean(payload.refereeNotes, 2000)
        : undefined;

      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if ((status && !fixtureStatuses.has(status)) || (period && !matchPeriods.has(period))) {
        return Response.json({ error: "Invalid match status or period." }, { status: 400 });
      }
      if (
        payload.homeScore !== undefined ||
        payload.awayScore !== undefined ||
        payload.homeScorePenalties !== undefined ||
        payload.awayScorePenalties !== undefined
      ) {
        return Response.json(
          { error: "Scores are derived from recorded goal and shootout events. Use the event controls instead." },
          { status: 409 },
        );
      }

      const nextStatus = status || fixture.status;
      const nextPeriod = period || fixture.period;
      try {
        if (status || period) {
          validateMatchTransition(matchSnapshot(fixture), nextStatus, nextPeriod);
        } else if (fixture.status === "completed") {
          throw new Error("Completed matches are locked. Use Correct result to make an audited correction.");
        }
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Invalid match transition." },
          { status: 409 },
        );
      }

      if (nextStatus === "completed") {
        try {
          await completeFixture(fixture, user.email, {
            refereeNotes,
            matchClockMinute,
          });
          return Response.json({ ok: true, completed: true });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Unable to complete this match." },
            { status: 409 },
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (period) updateData.period = period;
      if (matchClockMinute !== undefined) {
        updateData.matchClockMinute = Math.max(0, Math.min(200, matchClockMinute));
      }
      if (refereeNotes !== undefined) updateData.refereeNotes = refereeNotes;
      if (["first_half", "second_half", "extra_time"].includes(nextPeriod)) {
        if (matchClockMinute !== undefined || !fixture.clockRunning || fixture.period !== nextPeriod) {
          updateData.clockStartedAt = new Date().toISOString();
        }
        updateData.clockRunning = true;
      } else {
        updateData.clockRunning = false;
        updateData.clockStartedAt = null;
      }

      if (!Object.keys(updateData).length) {
        return Response.json({ error: "No match changes were supplied." }, { status: 400 });
      }

      await db.update(fixtures).set(updateData).where(eq(fixtures.id, fixtureId));
      if (nextStatus === "in_progress" && access.tournamentId) {
        await db
          .update(tournaments)
          .set({ status: "live", updatedAt: new Date().toISOString() })
          .where(eq(tournaments.id, access.tournamentId));
      }
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "fixture",
        entityId: fixtureId,
        action: "match_state_updated",
        actorEmail: user.email,
        before: { status: fixture.status, period: fixture.period, matchClockMinute: fixture.matchClockMinute },
        after: updateData,
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "startShootout") {
      const fixtureId = clean(payload.fixtureId, 50);
      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (!canStartShootout(matchSnapshot(fixture))) {
        return Response.json(
          { error: "A shootout can start only in a tied knockout match after the second half or extra time." },
          { status: 409 },
        );
      }
      const [existingKick] = await db.select({ id: shootoutKicks.id }).from(shootoutKicks).where(eq(shootoutKicks.fixtureId, fixtureId)).limit(1);
      if (existingKick) {
        return Response.json({ error: "This shootout has already started." }, { status: 409 });
      }
      await db.update(fixtures).set({ period: "penalties", clockRunning: false, clockStartedAt: null }).where(eq(fixtures.id, fixtureId));
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "fixture",
        entityId: fixtureId,
        action: "shootout_started",
        actorEmail: user.email,
        before: { period: fixture.period },
        after: { period: "penalties" },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "recordShootoutKick") {
      const fixtureId = clean(payload.fixtureId, 50);
      const entryId = clean(payload.entryId, 50);
      const playerId = clean(payload.playerId, 50) || null;
      const playerName = clean(payload.playerName, 100);
      const outcome = clean(payload.outcome, 10);
      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (
        fixture.status !== "in_progress" ||
        fixture.stage !== "knockout" ||
        fixture.period !== "penalties" ||
        fixture.homeScore !== fixture.awayScore
      ) {
        return Response.json({ error: "This match is not in an active shootout." }, { status: 409 });
      }
      if (![fixture.homeEntryId, fixture.awayEntryId].includes(entryId) || !["goal", "miss"].includes(outcome)) {
        return Response.json({ error: "Choose the correct shooting team and kick outcome." }, { status: 400 });
      }
      if (playerId) {
        const [eligible] = await db
          .select({ id: squadMembers.id })
          .from(squadMembers)
          .where(and(eq(squadMembers.entryId, entryId), eq(squadMembers.playerId, playerId)))
          .limit(1);
        if (!eligible) return Response.json({ error: "The shooter must be registered in this match squad." }, { status: 400 });
      }
      const existing = await db
        .select()
        .from(shootoutKicks)
        .where(eq(shootoutKicks.fixtureId, fixtureId))
        .orderBy(asc(shootoutKicks.sequence));
      const state = calculateShootout(existing.map((kick) => ({
        isHome: kick.entryId === fixture.homeEntryId,
        scored: kick.outcome === "goal",
      })));
      if (state.isFinished) return Response.json({ error: "This shootout is already complete." }, { status: 409 });
      const expectedEntryId = state.nextIsHome ? fixture.homeEntryId : fixture.awayEntryId;
      if (entryId !== expectedEntryId) {
        return Response.json({ error: "The other team must take the next kick." }, { status: 409 });
      }
      const kick = {
        id: crypto.randomUUID(),
        fixtureId,
        sequence: state.nextSequence,
        entryId,
        playerId,
        playerName,
        outcome,
        recordedBy: user.email,
      };
      const nextState = calculateShootout([
        ...existing.map((item) => ({
          isHome: item.entryId === fixture.homeEntryId,
          scored: item.outcome === "goal",
        })),
        { isHome: entryId === fixture.homeEntryId, scored: outcome === "goal" },
      ]);
      await db.batch([
        db.insert(shootoutKicks).values(kick),
        db.update(fixtures).set({
          homeScorePenalties: nextState.homeScore,
          awayScorePenalties: nextState.awayScore,
        }).where(eq(fixtures.id, fixtureId)),
      ]);
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "shootout_kick",
        entityId: kick.id,
        action: "shootout_kick_recorded",
        actorEmail: user.email,
        after: kick,
      });
      if (nextState.isFinished) {
        await completeFixture(fixture, user.email, {
          homeScorePenalties: nextState.homeScore,
          awayScorePenalties: nextState.awayScore,
        });
      }
      return Response.json({ kick, state: nextState, completed: nextState.isFinished }, { status: 201 });
    }

    if (payload.action === "undoShootoutKick") {
      const fixtureId = clean(payload.fixtureId, 50);
      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (fixture.status !== "in_progress" || fixture.period !== "penalties") {
        return Response.json({ error: "Completed shootouts are locked." }, { status: 409 });
      }
      const existing = await db.select().from(shootoutKicks).where(eq(shootoutKicks.fixtureId, fixtureId)).orderBy(asc(shootoutKicks.sequence));
      const last = existing.at(-1);
      if (!last) return Response.json({ error: "There is no shootout kick to undo." }, { status: 409 });
      const remaining = existing.slice(0, -1);
      const state = calculateShootout(remaining.map((kick) => ({
        isHome: kick.entryId === fixture.homeEntryId,
        scored: kick.outcome === "goal",
      })));
      await db.batch([
        db.delete(shootoutKicks).where(eq(shootoutKicks.id, last.id)),
        db.update(fixtures).set({ homeScorePenalties: state.homeScore, awayScorePenalties: state.awayScore }).where(eq(fixtures.id, fixtureId)),
      ]);
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "shootout_kick",
        entityId: last.id,
        action: "shootout_kick_undone",
        actorEmail: user.email,
        before: last,
      });
      return Response.json({ ok: true, state });
    }

    if (payload.action === "resetShootout") {
      const fixtureId = clean(payload.fixtureId, 50);
      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (fixture.status !== "in_progress" || fixture.period !== "penalties") {
        return Response.json({ error: "Completed shootouts are locked." }, { status: 409 });
      }
      await db.batch([
        db.delete(shootoutKicks).where(eq(shootoutKicks.fixtureId, fixtureId)),
        db.update(fixtures).set({ homeScorePenalties: 0, awayScorePenalties: 0 }).where(eq(fixtures.id, fixtureId)),
      ]);
      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "fixture",
        entityId: fixtureId,
        action: "shootout_reset",
        actorEmail: user.email,
        before: { homeScorePenalties: fixture.homeScorePenalties, awayScorePenalties: fixture.awayScorePenalties },
        after: { homeScorePenalties: 0, awayScorePenalties: 0 },
      });
      return Response.json({ ok: true });
    }

    if (payload.action === "recordDetailedMatchEvent") {
      const fixtureId = clean(payload.fixtureId, 50);
      const entryId = clean(payload.entryId, 50);
      const type = clean(payload.type, 30); // "goal", "yellow_card", "red_card", "substitution", "penalty_miss"
      const playerName = clean(payload.playerName, 100);
      const playerId = clean(payload.playerId, 50) || null;
      const assistPlayerName = clean(payload.assistPlayerName, 100);
      const assistPlayerId = clean(payload.assistPlayerId, 50) || null;
      const relatedPlayerName = clean(payload.relatedPlayerName, 100);
      const matchMinute = Math.max(0, Math.min(200, numberValue(payload.matchMinute, 0)));
      const matchPeriod = clean(payload.matchPeriod, 20) || "first_half";
      const cardReason = clean(payload.cardReason, 100);

      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (
        fixture.status !== "in_progress" ||
        !["first_half", "second_half", "extra_time"].includes(fixture.period)
      ) {
        return Response.json(
          { error: "Match events can only be recorded while the match clock is active." },
          { status: 409 },
        );
      }
      if (matchPeriod !== fixture.period) {
        return Response.json(
          { error: "The event period does not match the current match period." },
          { status: 409 },
        );
      }
      if (!eventTypes.has(type) || ![fixture.homeEntryId, fixture.awayEntryId].includes(entryId)) {
        return Response.json({ error: "Invalid match event or team." }, { status: 400 });
      }
      if (!playerName || !playerId) {
        return Response.json({ error: "Select a player for this event." }, { status: 400 });
      }
      const eventPlayerIds = [playerId, assistPlayerId].filter((id): id is string => Boolean(id));
      if (new Set(eventPlayerIds).size !== eventPlayerIds.length) {
        return Response.json({ error: "A player cannot be both participants in the same event." }, { status: 400 });
      }
      const eligiblePlayers = await db
        .select({ playerId: squadMembers.playerId })
        .from(squadMembers)
        .where(
          and(
            eq(squadMembers.entryId, entryId),
            inArray(squadMembers.playerId, eventPlayerIds),
          ),
        );
      if (eligiblePlayers.length !== eventPlayerIds.length) {
        return Response.json({ error: "Every event participant must be registered in this team's match squad." }, { status: 400 });
      }
      if (type === "substitution" && (!assistPlayerId || !relatedPlayerName)) {
        return Response.json({ error: "Select both the outgoing and incoming players." }, { status: 400 });
      }

      const eventId = crypto.randomUUID();
      const event = {
        id: eventId,
        fixtureId,
        entryId,
        type,
        playerName,
        playerId,
        assistPlayerName,
        assistPlayerId,
        relatedPlayerName,
        matchMinute,
        matchPeriod,
        cardReason,
        recordedBy: user.email,
      };

      const insertEvent = db.insert(matchEvents).values(event);

      // Keep the event and its score change in the same D1 transaction.
      if (type === "goal" || type === "penalty_goal") {
        if (entryId === fixture.homeEntryId) {
          await db.batch([
            insertEvent,
            db.update(fixtures).set({ homeScore: sql`${fixtures.homeScore} + 1` }).where(eq(fixtures.id, fixtureId)),
          ]);
        } else if (entryId === fixture.awayEntryId) {
          await db.batch([
            insertEvent,
            db.update(fixtures).set({ awayScore: sql`${fixtures.awayScore} + 1` }).where(eq(fixtures.id, fixtureId)),
          ]);
        }
      } else if (type === "own_goal") {
        // Own goal adds to opponent's score
        if (entryId === fixture.homeEntryId) {
          await db.batch([
            insertEvent,
            db.update(fixtures).set({ awayScore: sql`${fixtures.awayScore} + 1` }).where(eq(fixtures.id, fixtureId)),
          ]);
        } else if (entryId === fixture.awayEntryId) {
          await db.batch([
            insertEvent,
            db.update(fixtures).set({ homeScore: sql`${fixtures.homeScore} + 1` }).where(eq(fixtures.id, fixtureId)),
          ]);
        }
      } else {
        await insertEvent;
      }

      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "match_event",
        entityId: eventId,
        action: "event_recorded",
        actorEmail: user.email,
        after: event,
      });

      return Response.json({ event }, { status: 201 });
    }

    if (payload.action === "deleteMatchEvent") {
      const eventId = clean(payload.eventId, 50);
      const [ev] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
      if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });

      const access = await manageableFixture(ev.fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Event not found or access denied" }, { status: 404 });
      if (fixture.status !== "in_progress") {
        return Response.json(
          { error: "Completed match events are locked. Reopen or correct the result through the organizer workflow." },
          { status: 409 },
        );
      }
      const deleteEvent = db.delete(matchEvents).where(eq(matchEvents.id, eventId));

      // Revert a goal score atomically with deleting the event.
      if (ev.type === "goal" || ev.type === "penalty_goal") {
        if (ev.entryId === fixture.homeEntryId) {
          await db.batch([
            deleteEvent,
            db.update(fixtures).set({ homeScore: Math.max(0, fixture.homeScore - 1) }).where(eq(fixtures.id, fixture.id)),
          ]);
        } else if (ev.entryId === fixture.awayEntryId) {
          await db.batch([
            deleteEvent,
            db.update(fixtures).set({ awayScore: Math.max(0, fixture.awayScore - 1) }).where(eq(fixtures.id, fixture.id)),
          ]);
        }
      } else if (ev.type === "own_goal") {
        if (ev.entryId === fixture.homeEntryId) {
          await db.batch([
            deleteEvent,
            db.update(fixtures).set({ awayScore: Math.max(0, fixture.awayScore - 1) }).where(eq(fixtures.id, fixture.id)),
          ]);
        } else if (ev.entryId === fixture.awayEntryId) {
          await db.batch([
            deleteEvent,
            db.update(fixtures).set({ homeScore: Math.max(0, fixture.homeScore - 1) }).where(eq(fixtures.id, fixture.id)),
          ]);
        }
      } else {
        await deleteEvent;
      }

      await writeAudit({
        tournamentId: access.tournamentId,
        entityType: "match_event",
        entityId: eventId,
        action: "event_deleted",
        actorEmail: user.email,
        before: ev,
      });

      return Response.json({ ok: true });
    }

    if (payload.action === "setPOTM") {
      const fixtureId = clean(payload.fixtureId, 50);
      const potmPlayerId = clean(payload.potmPlayerId, 50) || null;
      const potmPlayerName = clean(payload.potmPlayerName, 100);

      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (fixture.status === "completed") {
        return Response.json({ error: "Completed matches are locked." }, { status: 409 });
      }
      if (potmPlayerId) {
        if (!potmPlayerName) return Response.json({ error: "Player of the match name is required." }, { status: 400 });
        const [eligible] = await db
          .select({ id: squadMembers.id })
          .from(squadMembers)
          .where(
            and(
              eq(squadMembers.playerId, potmPlayerId),
              inArray(squadMembers.entryId, [fixture.homeEntryId, fixture.awayEntryId]),
            ),
          )
          .limit(1);
        if (!eligible) return Response.json({ error: "Player is not in this match squad." }, { status: 400 });
      }
      await db.update(fixtures).set({ potmPlayerId, potmPlayerName }).where(eq(fixtures.id, fixtureId));
      return Response.json({ ok: true });
    }

    if (payload.action === "completeMatchReport") {
      const fixtureId = clean(payload.fixtureId, 50);
      const potmPlayerId = clean(payload.potmPlayerId, 50) || null;
      const potmPlayerName = clean(payload.potmPlayerName, 100);
      const refereeNotes = clean(payload.refereeNotes, 2000);
      const access = await manageableFixture(fixtureId, user.email);
      const fixture = access?.fixture;
      if (!fixture) return Response.json({ error: "Fixture not found or access denied" }, { status: 404 });
      if (potmPlayerId) {
        if (!potmPlayerName) return Response.json({ error: "Player of the match name is required." }, { status: 400 });
        const [eligible] = await db
          .select({ id: squadMembers.id })
          .from(squadMembers)
          .where(
            and(
              eq(squadMembers.playerId, potmPlayerId),
              inArray(squadMembers.entryId, [fixture.homeEntryId, fixture.awayEntryId]),
            ),
          )
          .limit(1);
        if (!eligible) return Response.json({ error: "Player of the match must be in one of the match squads." }, { status: 400 });
      }
      try {
        await completeFixture(fixture, user.email, {
          potmPlayerId,
          potmPlayerName: potmPlayerId ? potmPlayerName : "",
          refereeNotes,
          matchClockMinute: Math.max(90, fixture.matchClockMinute),
        });
        return Response.json({ ok: true, completed: true });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unable to complete this match." },
          { status: 409 },
        );
      }
    }

    if (payload.action === "correctMatchResult") {
      const fixtureId = clean(payload.fixtureId, 50);
      const fixture = await ownedFixture(fixtureId, user.email);
      if (!fixture) return Response.json({ error: "Fixture not found" }, { status: 404 });
      if (fixture.status !== "completed") {
        return Response.json({ error: "Only a completed match can use the result-correction workflow." }, { status: 409 });
      }
      const reason = clean(payload.reason, 500);
      const homeScore = Math.round(numberValue(payload.homeScore, -1));
      const awayScore = Math.round(numberValue(payload.awayScore, -1));
      const homeScorePenalties = Math.round(numberValue(payload.homeScorePenalties, 0));
      const awayScorePenalties = Math.round(numberValue(payload.awayScorePenalties, 0));
      if (
        reason.length < 8 ||
        homeScore < 0 ||
        awayScore < 0 ||
        homeScorePenalties < 0 ||
        awayScorePenalties < 0
      ) {
        return Response.json({ error: "Enter valid scores and a correction reason of at least 8 characters." }, { status: 400 });
      }

      let nextWinnerEntryId: string | null = null;
      let nextLoserEntryId: string | null = null;
      if (fixture.stage === "knockout") {
        try {
          const result = deriveKnockoutResult(matchSnapshot(fixture, {
            homeScore,
            awayScore,
            homeScorePenalties,
            awayScorePenalties,
          }));
          nextWinnerEntryId = result.winnerEntryId;
          nextLoserEntryId = result.loserEntryId;
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "A knockout correction needs a winner." },
            { status: 409 },
          );
        }
      }

      const divisionFixtures = await db.select().from(fixtures).where(eq(fixtures.divisionId, fixture.divisionId));
      if (
        fixture.stage !== "knockout" &&
        divisionFixtures.some((item) => item.stage === "knockout")
      ) {
        return Response.json(
          { error: "The knockout stage already exists. Group results are locked once qualification has been generated." },
          { status: 409 },
        );
      }
      const changedWinner = fixture.stage === "knockout" && fixture.winnerEntryId !== nextWinnerEntryId;
      const downstream = changedWinner
        ? divisionFixtures.filter(
            (item) =>
              item.stage === "knockout" &&
              item.roundNumber > fixture.roundNumber &&
              [item.homeEntryId, item.awayEntryId].some(
                (entryId) => entryId === fixture.winnerEntryId || entryId === fixture.loserEntryId,
              ),
          )
        : [];
      if (downstream.some((item) => item.status !== "scheduled" || item.homeScore !== 0 || item.awayScore !== 0)) {
        return Response.json(
          { error: "A later bracket match has already started. Its result must be resolved before this correction can be applied." },
          { status: 409 },
        );
      }
      if (downstream.length) {
        const downstreamEvents = await db
          .select({ id: matchEvents.id })
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, downstream.map((item) => item.id)));
        if (downstreamEvents.length) {
          return Response.json({ error: "A later bracket match already contains events and cannot be rewritten safely." }, { status: 409 });
        }
      }

      for (const nextFixture of downstream) {
        const changes: Record<string, string> = {};
        if (fixture.winnerEntryId && nextFixture.homeEntryId === fixture.winnerEntryId && nextWinnerEntryId) changes.homeEntryId = nextWinnerEntryId;
        if (fixture.winnerEntryId && nextFixture.awayEntryId === fixture.winnerEntryId && nextWinnerEntryId) changes.awayEntryId = nextWinnerEntryId;
        if (fixture.loserEntryId && nextFixture.homeEntryId === fixture.loserEntryId && nextLoserEntryId) changes.homeEntryId = nextLoserEntryId;
        if (fixture.loserEntryId && nextFixture.awayEntryId === fixture.loserEntryId && nextLoserEntryId) changes.awayEntryId = nextLoserEntryId;
        if (Object.keys(changes).length) {
          await db.update(fixtures).set(changes).where(eq(fixtures.id, nextFixture.id));
        }
      }

      const corrected = {
        homeScore,
        awayScore,
        homeScorePenalties,
        awayScorePenalties,
        winnerEntryId: nextWinnerEntryId,
        loserEntryId: nextLoserEntryId,
      };
      await db.update(fixtures).set(corrected).where(eq(fixtures.id, fixtureId));
      await db.insert(matchEvents).values({
        id: crypto.randomUUID(),
        fixtureId,
        entryId: homeScore !== fixture.homeScore ? fixture.homeEntryId : fixture.awayEntryId,
        type: "score_correction",
        playerName: "Official correction",
        matchMinute: fixture.matchClockMinute,
        matchPeriod: "completed",
        cardReason: reason,
        recordedBy: user.email,
      });
      await writeAudit({
        tournamentId: await tournamentIdForFixture(fixtureId),
        entityType: "fixture",
        entityId: fixtureId,
        action: "result_corrected",
        actorEmail: user.email,
        before: fixture,
        after: { ...corrected, reason, downstreamUpdated: downstream.map((item) => item.id) },
      });
      return Response.json({ ok: true, downstreamUpdated: downstream.length });
    }

    if (payload.action === "updateScore") {
      return Response.json(
        { error: "Direct score editing has been retired. Record goal events or use Correct result for an audited correction." },
        { status: 410 },
      );
    }

    if (payload.action === "sendAnnouncement") {
      const tournamentId = clean(payload.tournamentId, 50);
      if (!(await ownedTournament(tournamentId, user.email)))
        return Response.json(
          { error: "Tournament not found" },
          { status: 404 },
        );
      const body = clean(payload.body, 2000);
      if (!body)
        return Response.json(
          { error: "Announcement cannot be empty." },
          { status: 400 },
        );
      const audience = clean(payload.audience, 40) || "all_participants";
      if (!["all_participants", "coaches_only"].includes(audience)) {
        return Response.json({ error: "Choose a valid announcement audience." }, { status: 400 });
      }
      const announcement = {
        id: crypto.randomUUID(),
        tournamentId,
        senderEmail: user.email,
        body,
        audience,
      };
      await db.insert(announcements).values(announcement);
      return Response.json({ announcement }, { status: 201 });
    }

    if (payload.action === "deleteTournament") {
      const tournamentId = clean(payload.tournamentId, 50);
      const tournament = await ownedTournament(tournamentId, user.email);
      if (!tournament)
        return Response.json(
          { error: "Tournament not found" },
          { status: 404 },
        );
      const state = await tournamentFixtureState(tournamentId);
      const [entry] = await db
        .select({ id: entries.id })
        .from(entries)
        .innerJoin(divisions, eq(entries.divisionId, divisions.id))
        .where(eq(divisions.tournamentId, tournamentId))
        .limit(1);
      if (entry || state.hasFixtures) {
        return Response.json(
          { error: "Tournaments with registrations or fixtures cannot be permanently deleted. Cancel them to preserve competition records." },
          { status: 409 },
        );
      }
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
      return Response.json({ ok: true });
    }

    if (payload.action === "cancelTournament") {
      const tournamentId = clean(payload.tournamentId, 50);
      const reason = clean(payload.reason, 500);
      const tournament = await ownedTournament(tournamentId, user.email);
      if (!tournament) return Response.json({ error: "Tournament not found" }, { status: 404 });
      if (["live", "completed", "cancelled"].includes(tournament.status)) {
        return Response.json({ error: "Live, completed or already-cancelled tournaments cannot be cancelled here." }, { status: 409 });
      }
      if (reason.length < 8) {
        return Response.json({ error: "Give a short reason for cancelling the tournament." }, { status: 400 });
      }
      const state = await tournamentFixtureState(tournamentId);
      if (state.fixtures.some((fixture) => ["in_progress", "completed"].includes(fixture.status))) {
        return Response.json(
          { error: "A tournament with started matches must retain its live or completed record." },
          { status: 409 },
        );
      }
      await db.batch([
        db.update(tournaments).set({ status: "cancelled", updatedAt: new Date().toISOString() }).where(eq(tournaments.id, tournamentId)),
        ...(state.fixtures.length
          ? [db.update(fixtures).set({ status: "cancelled", clockRunning: false }).where(inArray(fixtures.id, state.fixtures.map((fixture) => fixture.id)))]
          : []),
      ]);
      await writeAudit({
        tournamentId,
        entityType: "tournament",
        entityId: tournamentId,
        action: "tournament_cancelled",
        actorEmail: user.email,
        before: { status: tournament.status },
        after: { status: "cancelled", reason },
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
