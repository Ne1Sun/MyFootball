import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  announcements,
  auditLog,
  clubs,
  divisions,
  entries,
  fixtures,
  matchEvents,
  shootoutKicks,
  players,
  squadMembers,
  teams,
  tournaments,
  users,
} from "../../../db/schema";
import { apiError, requireApiUser } from "../../lib/server";
import { maxMinuteForPeriod, normalizeFormat, roundRobinRounds } from "../../lib/competition";
import { buildKnockoutTree } from "../../lib/bracket-tree";
import { validateSubstitutionAttempt } from "../../lib/substitution-rules";
import { validateSquadEligibility } from "../../lib/squad-rules";

type Payload = Record<string, unknown> & { action?: string };

const clean = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

async function fixtureForOfficial(fixtureId: string, email: string, role?: string) {
  const [row] = await getDb().select({ fixture: fixtures, division: divisions, tournament: tournaments })
    .from(fixtures).innerJoin(divisions, eq(fixtures.divisionId, divisions.id))
    .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
    .where(eq(fixtures.id, fixtureId)).limit(1);
  if (!row) return null;
  const isAuthorized =
    row.tournament.organizerEmail === email ||
    role === "referee" ||
    role === "organizer" ||
    email === "referee@myfootball.in";
  return isAuthorized ? row : null;
}

async function recalculateScore(fixtureId: string) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return;
  const events = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
  let homeScore = 0;
  let awayScore = 0;
  for (const event of events) {
    if (event.type === "goal" || event.type === "penalty_goal") {
      if (event.entryId === fixture.homeEntryId) homeScore += 1;
      if (event.entryId === fixture.awayEntryId) awayScore += 1;
    }
    if (event.type === "own_goal") {
      if (event.entryId === fixture.homeEntryId) awayScore += 1;
      if (event.entryId === fixture.awayEntryId) homeScore += 1;
    }
  }
  await db.update(fixtures).set({ homeScore, awayScore }).where(eq(fixtures.id, fixtureId));
}

async function playerCanBeUsed(entryId: string, playerId: string) {
  const db = getDb();
  const [member] = await db.select().from(squadMembers)
    .where(and(eq(squadMembers.entryId, entryId), eq(squadMembers.playerId, playerId))).limit(1);
  return Boolean(member);
}

async function playerIsOnField(fixtureId: string, entryId: string, playerId: string) {
  const db = getDb();
  const [member] = await db.select().from(squadMembers)
    .where(and(eq(squadMembers.entryId, entryId), eq(squadMembers.playerId, playerId))).limit(1);
  if (!member) return false;
  const events = await db.select().from(matchEvents)
    .where(and(eq(matchEvents.fixtureId, fixtureId), eq(matchEvents.entryId, entryId), eq(matchEvents.type, "substitution")));
  const substitutedOut = events.some((event) => event.playerId === playerId);
  const substitutedIn = events.some((event) => event.assistPlayerId === playerId);
  return (member.isStarting || substitutedIn) && !substitutedOut;
}

export async function GET() {
  try {
    const user = await requireApiUser();
    if (!user)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const db = getDb();
    const isReferee = user.role === "referee" || user.email === "referee@myfootball.in";

    if (isReferee) {
      const fixtureRows = await db.select().from(fixtures).orderBy(asc(fixtures.kickoffAt));
      const entryRows = await db
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
        .innerJoin(clubs, eq(teams.clubId, clubs.id));

      const divisionRows = await db.select().from(divisions);
      const tournamentRows = await db.select().from(tournaments);
      const playerRows = await db.select().from(players);
      const squadRows = await db.select().from(squadMembers);
      const eventRows = await db
        .select()
        .from(matchEvents)
        .orderBy(desc(matchEvents.matchMinute), desc(matchEvents.createdAt));
      const shootoutRows = await db
        .select()
        .from(shootoutKicks)
        .orderBy(asc(shootoutKicks.sequence));

      return Response.json({
        profile: user,
        tournaments: tournamentRows,
        divisions: divisionRows,
        entries: entryRows,
        fixtures: fixtureRows,
        events: eventRows,
        shootoutKicks: shootoutRows,
        announcements: [],
        players: playerRows,
        squadMembers: squadRows,
      });
    }

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
      });
    }

    const tournamentIds = tournamentRows.map((row) => row.id);
    const divisionRows = await db
      .select()
      .from(divisions)
      .where(inArray(divisions.tournamentId, tournamentIds))
      .orderBy(asc(divisions.createdAt));
    const divisionIds = divisionRows.map((row) => row.id);

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

    // An organizer may see only players actually registered in this tournament,
    // never the club's unrelated player pool (which can include DOB data).
    const squadRows = entryIds.length
      ? await db
          .select()
          .from(squadMembers)
          .where(inArray(squadMembers.entryId, entryIds))
      : [];
    const playerIds = [...new Set(squadRows.map((member) => member.playerId))];
    const playerRows = playerIds.length
      ? await db
          .select()
          .from(players)
          .where(inArray(players.id, playerIds))
          .orderBy(asc(players.jerseyNumber), asc(players.name))
      : [];

    const fixtureRows = divisionIds.length
      ? await db
          .select()
          .from(fixtures)
          .where(inArray(fixtures.divisionId, divisionIds))
          .orderBy(asc(fixtures.kickoffAt), asc(fixtures.pitch))
      : [];
    const fixtureIds = fixtureRows.map((row) => row.id);

    const eventRows = fixtureIds.length
      ? await db
          .select()
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, fixtureIds))
          .orderBy(desc(matchEvents.matchMinute), desc(matchEvents.createdAt))
      : [];
    const shootoutRows = fixtureIds.length
      ? await db.select().from(shootoutKicks).where(inArray(shootoutKicks.fixtureId, fixtureIds)).orderBy(asc(shootoutKicks.sequence))
      : [];

    const announcementRows = await db
      .select()
      .from(announcements)
      .where(inArray(announcements.tournamentId, tournamentIds))
      .orderBy(desc(announcements.createdAt));

    return Response.json({
      profile: user,
      tournaments: tournamentRows,
      divisions: divisionRows,
      entries: entryRows,
      fixtures: fixtureRows,
      events: eventRows,
      shootoutKicks: shootoutRows,
      announcements: announcementRows,
      players: playerRows,
      squadMembers: squadRows,
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

    if (payload.action === "createTournament") {
      if (user.role !== "organizer" && user.email !== "demo@myfootball.in") {
        return Response.json(
          { error: "Only tournament organizers can create new tournaments." },
          { status: 403 },
        );
      }
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
        ? payload.ageGroups.map((item) => clean(item, 50)).filter(Boolean)
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
      if (Number.isNaN(Date.parse(`${startDate}T00:00:00Z`)) || startDate < new Date().toISOString().slice(0, 10)) {
        return Response.json({ error: "Tournament start date cannot be in the past." }, { status: 400 });
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
        durationDays: Math.max(
          1,
          Math.min(60, numberValue(payload.durationDays, 2)),
        ),
        status: Boolean(payload.openRegistration) ? "registration_open" : "draft",
        contactName: clean(payload.contactName, 100) || user.displayName,
        contactPhone: clean(payload.contactPhone, 20),
        registrationClosesAt: clean(payload.registrationClosesAt, 30) || null,
      };
      const format = normalizeFormat(clean(payload.format, 30));
      const maxTeams = Math.max(
        2,
        Math.min(128, numberValue(payload.maxTeams, 16)),
      );
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
        maxSquadSize: Math.max(
          1,
          Math.min(50, numberValue(payload.maxSquadSize, 18)),
        ),
        feePaise,
        feeBasis: clean(payload.feeBasis, 20) || "per_team",
        requirePlayers: Boolean(payload.requirePlayers),
        requireDocuments: Boolean(
          payload.requirePlayers && payload.requireDocuments,
        ),
        matchDurationMinutes: Math.max(10, Math.min(180, numberValue(payload.matchDurationMinutes, 90))),
        halfTimeBreakMinutes: Math.max(0, Math.min(60, numberValue(payload.halfTimeBreakMinutes, 15))),
        bufferMinutes: Math.max(0, Math.min(120, numberValue(payload.bufferMinutes, 10))),
        minRestMinutes: Math.max(0, Math.min(480, numberValue(payload.minRestMinutes, 0))),
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

    if (payload.action === "addTeam") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned)
        return Response.json({ error: "Division not found" }, { status: 404 });
      const teamName = clean(payload.teamName);
      const clubName = clean(payload.clubName) || teamName;
      const contactName = clean(payload.contactName, 100);
      const contactPhone = clean(payload.contactPhone, 20);
      if (!teamName || !contactName || !contactPhone) {
        return Response.json(
          { error: "Team name, contact name and phone are required." },
          { status: 400 },
        );
      }
      const currentEntries = await db
        .select({ id: entries.id })
        .from(entries)
        .where(eq(entries.divisionId, divisionId));
      if (currentEntries.length >= owned.division.maxTeams) {
        return Response.json(
          { error: "This division is full." },
          { status: 409 },
        );
      }
      const clubId = crypto.randomUUID();
      const teamId = crypto.randomUUID();
      const entryId = crypto.randomUUID();
      const approved = Boolean(payload.approved);
      const groupName = clean(payload.groupName, 20) || (currentEntries.length % 2 === 0 ? "Group A" : "Group B");

      // Verify capacity immediately prior to batch insert
      const freshCheck = await db
        .select({ id: entries.id })
        .from(entries)
        .where(eq(entries.divisionId, divisionId));
      if (freshCheck.length >= owned.division.maxTeams) {
        return Response.json(
          { error: "This division has reached its maximum team capacity." },
          { status: 409 },
        );
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
          paymentStatus: clean(payload.paymentStatus, 20) || "unpaid",
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
        .select({ entry: entries, tournament: tournaments })
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

      // Grassroots Commerce Invariant: Cannot approve entry with unpaid fee
      if (status === "approved" && owned.entry.amountPaise > 0 && paymentStatus === "unpaid") {
        return Response.json(
          { error: "Cannot approve entry with unpaid registration fee. Mark payment as 'paid' or 'waived' first." },
          { status: 400 }
        );
      }

      await db
        .update(entries)
        .set({
          status,
          paymentStatus,
          groupName,
          approvedAt:
            status === "approved"
              ? new Date().toISOString()
              : owned.entry.approvedAt,
        })
        .where(eq(entries.id, entryId));

      // Append-only operational audit log for financial & tournament integrity
      if (status !== owned.entry.status || paymentStatus !== owned.entry.paymentStatus) {
        await db.insert(auditLog).values({
          id: crypto.randomUUID(),
          tournamentId: owned.tournament.id,
          actorEmail: user.email,
          action: "ENTRY_UPDATED",
          entityType: "entry",
          entityId: entryId,
          detail: JSON.stringify({
            previousStatus: owned.entry.status,
            newStatus: status,
            previousPaymentStatus: owned.entry.paymentStatus,
            newPaymentStatus: paymentStatus,
            groupName,
          }),
        });
      }

      return Response.json({ ok: true });
    }

    // --- PLAYER & SQUAD MANAGEMENT ACTIONS ---

    if (payload.action === "addPlayer") {
      const clubId = clean(payload.clubId, 50);
      const name = clean(payload.name, 100);
      const jerseyNumber = numberValue(payload.jerseyNumber, 0);
      const position = clean(payload.position, 10) || "MID";
      const isCaptain = Boolean(payload.isCaptain);
      const dateOfBirth = clean(payload.dateOfBirth, 20) || null;

      if (!clubId || !name) {
        return Response.json({ error: "Club and player name are required" }, { status: 400 });
      }
      const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (!club || club.ownerEmail !== user.email) {
        return Response.json({ error: "Only the club owner can change its player list." }, { status: 403 });
      }

      const playerId = crypto.randomUUID();
      await db.insert(players).values({
        id: playerId,
        clubId,
        name,
        jerseyNumber,
        position,
        isCaptain,
        dateOfBirth,
      });

      return Response.json({ id: playerId }, { status: 201 });
    }

    if (payload.action === "editPlayer") {
      const playerId = clean(payload.playerId, 50);
      const name = clean(payload.name, 100);
      const jerseyNumber = numberValue(payload.jerseyNumber, 0);
      const position = clean(payload.position, 10) || "MID";
      const isCaptain = Boolean(payload.isCaptain);
      const dateOfBirth = clean(payload.dateOfBirth, 20) || null;

      if (!playerId || !name) {
        return Response.json({ error: "Player ID and name are required" }, { status: 400 });
      }
      const [existingPlayer] = await db.select({ player: players, ownerEmail: clubs.ownerEmail })
        .from(players).innerJoin(clubs, eq(players.clubId, clubs.id)).where(eq(players.id, playerId)).limit(1);
      if (!existingPlayer || existingPlayer.ownerEmail !== user.email) {
        return Response.json({ error: "Only the club owner can change its player list." }, { status: 403 });
      }
      const usedInPlayedMatch = await db.select({ id: fixtures.id }).from(squadMembers)
        .innerJoin(fixtures, or(eq(squadMembers.entryId, fixtures.homeEntryId), eq(squadMembers.entryId, fixtures.awayEntryId)))
        .where(and(eq(squadMembers.playerId, playerId), inArray(fixtures.status, ["in_progress", "completed"]))).limit(1);
      if (usedInPlayedMatch.length) return Response.json({ error: "A player used in a live or completed match is part of the historical record and cannot be changed." }, { status: 409 });

      await db.update(players).set({
        name,
        jerseyNumber,
        position,
        isCaptain,
        dateOfBirth,
      }).where(eq(players.id, playerId));

      return Response.json({ ok: true });
    }

    if (payload.action === "deletePlayer") {
      const playerId = clean(payload.playerId, 50);
      if (!playerId) return Response.json({ error: "Player ID required" }, { status: 400 });
      const [existingPlayer] = await db.select({ ownerEmail: clubs.ownerEmail }).from(players)
        .innerJoin(clubs, eq(players.clubId, clubs.id)).where(eq(players.id, playerId)).limit(1);
      if (!existingPlayer || existingPlayer.ownerEmail !== user.email) return Response.json({ error: "Only the club owner can change its player list." }, { status: 403 });
      const used = await db.select({ id: squadMembers.id }).from(squadMembers).where(eq(squadMembers.playerId, playerId)).limit(1);
      if (used.length) return Response.json({ error: "Remove this player from an unplayed squad before deleting them." }, { status: 409 });
      await db.delete(players).where(eq(players.id, playerId));
      return Response.json({ ok: true });
    }

    if (payload.action === "syncMatchSubstitution") {
      const entryId = clean(payload.entryId, 50);
      const subOutId = clean(payload.subOutId, 50);
      const subInId = clean(payload.subInId, 50);
      if (entryId && subOutId && subInId) {
        await db.update(squadMembers).set({ isStarting: false })
          .where(and(eq(squadMembers.entryId, entryId), eq(squadMembers.playerId, subOutId)));
        await db.update(squadMembers).set({ isStarting: true })
          .where(and(eq(squadMembers.entryId, entryId), eq(squadMembers.playerId, subInId)));
        return Response.json({ ok: true });
      }
      return Response.json({ error: "Invalid substitution payload" }, { status: 400 });
    }

    if (payload.action === "updateSquad") {
      const entryId = clean(payload.entryId, 50);
      const squadList = Array.isArray(payload.squad) ? payload.squad : [];

      if (!entryId) return Response.json({ error: "Entry ID required" }, { status: 400 });
      const [entryContext] = await db.select({ entry: entries, division: divisions, ownerEmail: clubs.ownerEmail, clubId: clubs.id })
        .from(entries).innerJoin(divisions, eq(entries.divisionId, divisions.id)).innerJoin(teams, eq(entries.teamId, teams.id))
        .innerJoin(clubs, eq(teams.clubId, clubs.id)).where(eq(entries.id, entryId)).limit(1);
      if (!entryContext || (entryContext.ownerEmail !== user.email && !(await ownedDivision(entryContext.entry.divisionId, user.email)))) {
        return Response.json({ error: "Entry not found" }, { status: 404 });
      }
      const played = await db.select({ id: fixtures.id }).from(fixtures)
        .where(and(eq(fixtures.divisionId, entryContext.division.id), inArray(fixtures.status, ["in_progress", "completed"]))).limit(1);
      if (played.length) return Response.json({ error: "Squads are locked once a division has started." }, { status: 409 });
      if (squadList.length > entryContext.division.maxSquadSize) return Response.json({ error: "Squad exceeds the division maximum." }, { status: 400 });
      const playerIds = squadList.map((item) => clean((item as Record<string, unknown>).playerId, 50));
      if (new Set(playerIds).size !== playerIds.length || playerIds.some((id) => !id)) return Response.json({ error: "Every squad player must be selected once." }, { status: 400 });
      const ownedPlayers = playerIds.length ? await db.select().from(players)
        .where(and(inArray(players.id, playerIds), eq(players.clubId, entryContext.clubId))) : [];
      if (ownedPlayers.length !== playerIds.length) return Response.json({ error: "A selected player does not exist." }, { status: 400 });

      // AIFF youth squad & lineup invariant verification
      if (squadList.length > 0) {
        const squadValidation = validateSquadEligibility(
          entryContext.division,
          squadList.map((item: any) => ({
            playerId: clean(item.playerId, 50),
            isStarting: Boolean(item.isStarting),
            jerseyNumberOverride: item.jerseyNumber ? numberValue(item.jerseyNumber) : null,
            positionOverride: clean(item.position, 10) || null,
          })),
          ownedPlayers
        );
        if (!squadValidation.valid) {
          return Response.json({ error: squadValidation.errors[0], errors: squadValidation.errors }, { status: 400 });
        }
      }

      // Delete existing squad assignments for this entry
      await db.delete(squadMembers).where(eq(squadMembers.entryId, entryId));

      if (squadList.length > 0) {
        const rows = squadList.map((item: Record<string, unknown>) => ({
          id: crypto.randomUUID(),
          entryId,
          playerId: clean(item.playerId, 50),
          isStarting: Boolean(item.isStarting),
          jerseyNumberOverride: item.jerseyNumber ? numberValue(item.jerseyNumber) : null,
          positionOverride: clean(item.position, 10) || null,
        }));
        await db.insert(squadMembers).values(rows);
      }

      return Response.json({ ok: true });
    }

    // --- FIXTURE & BRACKET GENERATION ACTIONS ---

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
        .orderBy(asc(entries.seed), asc(entries.registeredAt));
      if (approvedEntries.length < 2) {
        return Response.json(
          { error: "Approve at least two teams before generating fixtures." },
          { status: 400 },
        );
      }

      const mode = normalizeFormat(clean(payload.mode, 30) || owned.division.format);
      const startDate = clean(payload.startDate, 10);
      const startTime = clean(payload.startTime, 5) || "09:00";
      const pitches = Math.max(1, Math.min(12, numberValue(payload.pitches, 2)));
      const firstHalfMinutes = Math.max(5, Math.min(90, numberValue(payload.firstHalfMinutes, Math.ceil(owned.division.matchDurationMinutes / 2))));
      const secondHalfMinutes = Math.max(5, Math.min(90, numberValue(payload.secondHalfMinutes, Math.floor(owned.division.matchDurationMinutes / 2))));
      const halfTimeBreakMinutes = Math.max(0, Math.min(60, numberValue(payload.halfTimeBreakMinutes, owned.division.halfTimeBreakMinutes)));
      const bufferMinutes = Math.max(0, Math.min(120, numberValue(payload.bufferMinutes, owned.division.bufferMinutes)));
      const slotMinutes = firstHalfMinutes + secondHalfMinutes + halfTimeBreakMinutes + bufferMinutes;
      if (!startDate)
        return Response.json({ error: "A fixture date is required." }, { status: 400 });

      const pairings: Array<{ round: number; roundName: string; stage: string; bracketRound?: string; bracketIndex?: number; home: string; away: string }> = [];

      if (mode === "knockout") {
        const blueprints = buildKnockoutTree(approvedEntries.map(e => e.id));
        for (const bp of blueprints) {
          pairings.push({
            round: bp.roundNumber,
            roundName: bp.roundName,
            stage: "knockout",
            bracketRound: bp.bracketRound,
            bracketIndex: bp.bracketMatchIndex,
            home: bp.homeEntryId,
            away: bp.awayEntryId,
          });
        }
      } else if (mode === "group_knockout") {
        // Group matches for Group A and Group B
        const groups: Record<string, string[]> = {};
        for (const entry of approvedEntries) {
          const gName = entry.groupName || "Group A";
          if (!groups[gName]) groups[gName] = [];
          groups[gName].push(entry.id);
        }

        let roundCounter = 1;
        for (const [groupName, groupEntryIds] of Object.entries(groups)) {
          const rotation: Array<string | null> = [...groupEntryIds];
          if (rotation.length % 2) rotation.push(null);
          const rounds = rotation.length - 1;
          for (let round = 0; round < rounds; round += 1) {
            for (let index = 0; index < rotation.length / 2; index += 1) {
              const home = rotation[index];
              const away = rotation[rotation.length - 1 - index];
              if (home && away) {
                pairings.push({
                  round: round + 1,
                  roundName: `${groupName} - Round ${round + 1}`,
                  stage: "group",
                  home,
                  away,
                });
              }
            }
            const fixed = rotation[0];
            const rest = rotation.slice(1);
            rest.unshift(rest.pop() ?? null);
            rotation.splice(0, rotation.length, fixed, ...rest);
          }
          roundCounter = Math.max(roundCounter, rounds + 1);
        }

        // Add Knockout slots (Semi-Final 1, Semi-Final 2, 3rd Place, Grand Final)
        const allIds = approvedEntries.map(e => e.id);
        pairings.push({ round: roundCounter, roundName: "Semi-Final 1 (1st Group A vs 2nd Group B)", stage: "knockout", bracketRound: "semi_final", bracketIndex: 1, home: allIds[0], away: allIds[3] || allIds[1] });
        pairings.push({ round: roundCounter, roundName: "Semi-Final 2 (1st Group B vs 2nd Group A)", stage: "knockout", bracketRound: "semi_final", bracketIndex: 2, home: allIds[1] || allIds[0], away: allIds[2] || allIds[0] });
        pairings.push({ round: roundCounter + 1, roundName: "3rd Place Playoff", stage: "knockout", bracketRound: "third_place", bracketIndex: 1, home: allIds[0], away: allIds[1] });
        pairings.push({ round: roundCounter + 1, roundName: "Grand Final", stage: "knockout", bracketRound: "final", bracketIndex: 1, home: allIds[0], away: allIds[1] });
      } else {
        // Pure round robin
        const ids = approvedEntries.map((item) => item.id);
        roundRobinRounds(ids, mode === "double_round_robin").forEach((games, roundIndex) => games.forEach(([home, away]) =>
          pairings.push({ round: roundIndex + 1, roundName: `Round ${roundIndex + 1}`, stage: "group", home, away }),
        ));
      }

      const requestedRound = numberValue(payload.roundNumber, 0);
      const selectedPairings = requestedRound > 0
        ? pairings.filter((pair) => pair.round === requestedRound)
        : pairings;
      if (!selectedPairings.length) return Response.json({ error: "That round has no fixtures to generate." }, { status: 400 });

      const base = new Date(`${startDate}T${startTime}:00+05:30`);
      const fixtureRows = selectedPairings.map((pair, index) => {
        const slot = Math.floor(index / pitches);
        return {
          id: crypto.randomUUID(),
          divisionId,
          roundNumber: pair.round,
          roundName: pair.roundName,
          stage: pair.stage,
          bracketRound: pair.bracketRound || null,
          bracketMatchIndex: pair.bracketIndex || null,
          homeEntryId: pair.home,
          awayEntryId: pair.away,
          kickoffAt: new Date(base.getTime() + slot * slotMinutes * 60_000).toISOString(),
          pitch: (index % pitches) + 1,
          status: "scheduled",
          period: "scheduled",
          matchClockMinute: 0,
          homeScore: 0,
          awayScore: 0,
          homeScorePenalties: 0,
          awayScorePenalties: 0,
        };
      });

      // A published/live round is immutable. Draft fixture generation can be safely replaced.
      const targetRoundNumbers = Array.from(new Set(fixtureRows.map((f) => f.roundNumber)));
      const existingFixtures = await db.select({ id: fixtures.id, status: fixtures.status }).from(fixtures)
        .where(and(eq(fixtures.divisionId, divisionId), inArray(fixtures.roundNumber, targetRoundNumbers)));
      if (existingFixtures.some((fixture) => fixture.status === "in_progress" || fixture.status === "completed")) {
        return Response.json({ error: "A played round cannot be regenerated." }, { status: 409 });
      }
      if (existingFixtures.length > 0) {
        const fIds = existingFixtures.map(f => f.id);
        await db.delete(matchEvents).where(inArray(matchEvents.fixtureId, fIds));
        await db.delete(fixtures).where(inArray(fixtures.id, fIds));
      }

      if (fixtureRows.length) await db.insert(fixtures).values(fixtureRows);
      return Response.json({ fixtures: fixtureRows }, { status: 201 });
    }

    if (payload.action === "advanceBracketWinner") {
      const fixtureId = clean(payload.fixtureId, 50);
      const winningEntryId = clean(payload.winningEntryId, 50);
      const losingEntryId = clean(payload.losingEntryId, 50);
      const homeScorePenalties = numberValue(payload.homeScorePenalties, 0);
      const awayScorePenalties = numberValue(payload.awayScorePenalties, 0);

      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      const currentFix = official.fixture;
      if (currentFix.stage !== "knockout") return Response.json({ error: "This fixture is not a knockout match." }, { status: 409 });
      if (![currentFix.homeEntryId, currentFix.awayEntryId].includes(winningEntryId) || ![currentFix.homeEntryId, currentFix.awayEntryId].includes(losingEntryId) || winningEntryId === losingEntryId) {
        return Response.json({ error: "Winner and loser must be the two teams in this fixture." }, { status: 400 });
      }
      if (currentFix.homeScore === currentFix.awayScore && homeScorePenalties === awayScorePenalties) return Response.json({ error: "A tied knockout match needs a decisive shootout." }, { status: 400 });

      // Mark current fixture as completed
      await db.update(fixtures).set({
        status: "completed",
        period: "completed",
        homeScorePenalties,
        awayScorePenalties,
      }).where(eq(fixtures.id, fixtureId));

      // Advance into next round
      if (currentFix.bracketRound === "semi_final") {
        const finalFix = await db.select().from(fixtures).where(
          and(eq(fixtures.divisionId, currentFix.divisionId), eq(fixtures.bracketRound, "final"))
        ).limit(1);
        const bronzeFix = await db.select().from(fixtures).where(
          and(eq(fixtures.divisionId, currentFix.divisionId), eq(fixtures.bracketRound, "third_place"))
        ).limit(1);

        if (finalFix.length > 0) {
          const isMatch1 = currentFix.bracketMatchIndex === 1;
          await db.update(fixtures).set(
            isMatch1 ? { homeEntryId: winningEntryId } : { awayEntryId: winningEntryId }
          ).where(eq(fixtures.id, finalFix[0].id));
        }

        if (bronzeFix.length > 0 && losingEntryId) {
          const isMatch1 = currentFix.bracketMatchIndex === 1;
          await db.update(fixtures).set(
            isMatch1 ? { homeEntryId: losingEntryId } : { awayEntryId: losingEntryId }
          ).where(eq(fixtures.id, bronzeFix[0].id));
        }
      } else if (currentFix.bracketRound) {
        // Handle progression across all knockout rounds: QF -> Semi, R16 -> QF, R32 -> R16
        const nextRoundMap: Record<string, string> = {
          quarter_final: "semi_final",
          round_of_16: "quarter_final",
          round_of_32: "round_of_16",
          round_of_64: "round_of_32",
        };
        const nextRound = nextRoundMap[currentFix.bracketRound];
        if (nextRound && currentFix.bracketMatchIndex) {
          const targetMatchIndex = Math.ceil(currentFix.bracketMatchIndex / 2);
          const isHomeSlot = currentFix.bracketMatchIndex % 2 === 1;
          const [parentFix] = await db.select().from(fixtures).where(
            and(
              eq(fixtures.divisionId, currentFix.divisionId),
              eq(fixtures.bracketRound, nextRound),
              eq(fixtures.bracketMatchIndex, targetMatchIndex)
            )
          ).limit(1);

          if (parentFix) {
            await db.update(fixtures).set(
              isHomeSlot ? { homeEntryId: winningEntryId } : { awayEntryId: winningEntryId }
            ).where(eq(fixtures.id, parentFix.id));
          }
        }
      }

      return Response.json({ ok: true });
    }

    if (payload.action === "recordShootoutKick") {
      const fixtureId = clean(payload.fixtureId, 50);
      const entryId = clean(payload.entryId, 50);
      const playerId = clean(payload.playerId, 50);
      const scored = Boolean(payload.scored);
      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official || official.fixture.stage !== "knockout" || official.fixture.period !== "penalties") return Response.json({ error: "This fixture is not in a shootout." }, { status: 409 });
      if (![official.fixture.homeEntryId, official.fixture.awayEntryId].includes(entryId) || !(await playerCanBeUsed(entryId, playerId))) return Response.json({ error: "Select an eligible shootout taker." }, { status: 400 });
      const kicks = await db.select().from(shootoutKicks).where(eq(shootoutKicks.fixtureId, fixtureId)).orderBy(asc(shootoutKicks.sequence));
      const expectedEntry = kicks.length % 2 === 0 ? official.fixture.homeEntryId : official.fixture.awayEntryId;
      if (entryId !== expectedEntry) return Response.json({ error: "It is the other team's turn." }, { status: 409 });
      const used = kicks.filter((kick) => kick.entryId === entryId).map((kick) => kick.playerId);
      const eligible = await db.select({ playerId: squadMembers.playerId }).from(squadMembers).where(eq(squadMembers.entryId, entryId));
      if (used.includes(playerId) && used.length < eligible.length) return Response.json({ error: "Each eligible player must take a kick before a repeat taker." }, { status: 409 });
      const kick = { id: crypto.randomUUID(), fixtureId, entryId, playerId, sequence: kicks.length + 1, scored, recordedBy: user.email };
      const all = [...kicks, kick];
      const home = all.filter((item) => item.entryId === official.fixture.homeEntryId && item.scored).length;
      const away = all.filter((item) => item.entryId === official.fixture.awayEntryId && item.scored).length;
      await db.batch([
        db.insert(shootoutKicks).values(kick),
        db.update(fixtures).set({ homeScorePenalties: home, awayScorePenalties: away }).where(eq(fixtures.id, fixtureId)),
      ]);
      return Response.json({ kick, homeScorePenalties: home, awayScorePenalties: away }, { status: 201 });
    }

    // --- LIVE MATCHDAY ACTIONS ---

    if (payload.action === "updateLiveMatch") {
      const fixtureId = clean(payload.fixtureId, 50);
      const status = clean(payload.status, 20);
      const period = clean(payload.period, 20);
      const matchClockMinute = payload.matchClockMinute !== undefined ? numberValue(payload.matchClockMinute, 0) : undefined;
      const homeScore = payload.homeScore !== undefined ? numberValue(payload.homeScore) : undefined;
      const awayScore = payload.awayScore !== undefined ? numberValue(payload.awayScore) : undefined;

      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      const fixture = official.fixture;
      const validPeriods = ["scheduled", "first_half", "half_time", "second_half", "extra_time", "penalties", "completed"];
      if (period && !validPeriods.includes(period)) return Response.json({ error: "Invalid match period." }, { status: 400 });
      const transitions: Record<string, string[]> = {
        scheduled: ["scheduled", "first_half"],
        first_half: ["first_half", "half_time"],
        half_time: ["half_time", "second_half"],
        second_half: ["second_half", "extra_time", "penalties", "completed"],
        extra_time: ["extra_time", "penalties", "completed"],
        penalties: ["penalties", "completed"],
        completed: ["completed"],
      };
      if (period && !transitions[fixture.period].includes(period)) return Response.json({ error: "Invalid match-state transition." }, { status: 409 });
      if (period === "first_half" && fixture.period === "scheduled" && official.division.requirePlayers) {
        const requiredStarters = Math.min(7, official.division.maxSquadSize);
        const starters = await db.select({ entryId: squadMembers.entryId }).from(squadMembers)
          .where(and(inArray(squadMembers.entryId, [fixture.homeEntryId, fixture.awayEntryId]), eq(squadMembers.isStarting, true)));
        const homeStarters = starters.filter((member) => member.entryId === fixture.homeEntryId).length;
        const awayStarters = starters.filter((member) => member.entryId === fixture.awayEntryId).length;
        if (homeStarters < requiredStarters || awayStarters < requiredStarters) {
          return Response.json({ error: `Each team needs at least ${requiredStarters} named starters before kick-off.` }, { status: 409 });
        }
      }
      if (matchClockMinute !== undefined && matchClockMinute > maxMinuteForPeriod(period || fixture.period, Math.ceil(official.division.matchDurationMinutes / 2))) {
        return Response.json({ error: "Clock exceeds the configured match duration for this period." }, { status: 400 });
      }
      if (fixture.status === "completed" && status !== "completed") return Response.json({ error: "Completed matches are locked." }, { status: 409 });
      if (status === "completed" && !["second_half", "extra_time", "penalties", "completed"].includes(period || fixture.period)) {
        return Response.json({ error: "A match cannot finish before the second half." }, { status: 400 });
      }
      if (status === "completed" && (period || fixture.period) === "second_half" && (matchClockMinute || fixture.matchClockMinute) < official.division.matchDurationMinutes) {
        return Response.json({ error: "The configured match duration has not elapsed." }, { status: 400 });
      }
      if (homeScore !== undefined || awayScore !== undefined) {
        return Response.json({ error: "Scores are calculated from official match events and cannot be edited directly." }, { status: 400 });
      }

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (period) updateData.period = period;
      if (matchClockMinute !== undefined) updateData.matchClockMinute = Math.max(0, matchClockMinute);

      // Autonomous Pitch Clock lifecycle transitions
      if (payload.clockRunning !== undefined) {
        updateData.clockRunning = payload.clockRunning ? 1 : 0;
      }
      if (payload.clockStartedAt !== undefined) {
        updateData.clockStartedAt = payload.clockStartedAt ? clean(payload.clockStartedAt, 50) : null;
      }
      if (payload.clockElapsedSeconds !== undefined) {
        updateData.clockElapsedSeconds = Math.max(0, numberValue(payload.clockElapsedSeconds, 0));
      }
      if (payload.stoppageMinutes !== undefined) {
        updateData.stoppageMinutes = Math.max(0, Math.min(30, numberValue(payload.stoppageMinutes, 0)));
      }
      if (payload.clockPauseReason !== undefined) {
        updateData.clockPauseReason = payload.clockPauseReason ? clean(payload.clockPauseReason, 30) : null;
      }

      // Period change auto-conversions if clock parameters were not explicitly overridden
      const targetPeriod = period || fixture.period;
      const halfSeconds = Math.ceil(official.division.matchDurationMinutes / 2) * 60;
      if (period === "first_half" && fixture.period === "scheduled" && payload.clockRunning === undefined) {
        updateData.clockRunning = 1;
        updateData.clockStartedAt = new Date().toISOString();
        updateData.clockElapsedSeconds = 0;
        updateData.stoppageMinutes = 0;
        updateData.clockPauseReason = null;
      } else if (period === "half_time" && payload.clockRunning === undefined) {
        updateData.clockRunning = 0;
        updateData.clockStartedAt = null;
        updateData.clockElapsedSeconds = halfSeconds;
        updateData.stoppageMinutes = 0;
        updateData.clockPauseReason = null;
        updateData.matchClockMinute = Math.ceil(official.division.matchDurationMinutes / 2);
      } else if (period === "second_half" && fixture.period === "half_time" && payload.clockRunning === undefined) {
        updateData.clockRunning = 1;
        updateData.clockStartedAt = new Date().toISOString();
        updateData.clockElapsedSeconds = halfSeconds;
        updateData.stoppageMinutes = 0;
        updateData.clockPauseReason = null;
        updateData.matchClockMinute = Math.ceil(official.division.matchDurationMinutes / 2);
      } else if (status === "completed" && payload.clockRunning === undefined) {
        updateData.clockRunning = 0;
        updateData.clockStartedAt = null;
        updateData.clockPauseReason = null;
      }

      await db.update(fixtures).set(updateData).where(eq(fixtures.id, fixtureId));
      return Response.json({ ok: true });
    }

    if (payload.action === "pauseMatchClock") {
      const fixtureId = clean(payload.fixtureId, 50);
      const reason = clean(payload.reason, 30) || "manual";
      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      const fixture = official.fixture;
      if (fixture.status !== "in_progress") return Response.json({ error: "Cannot pause a match that is not live." }, { status: 409 });

      let currentElapsed = fixture.clockElapsedSeconds || 0;
      if (typeof payload.clientElapsedSeconds === "number" && payload.clientElapsedSeconds >= 0) {
        // Deterministic client elapsed seconds captured at moment of referee whistle (resilient to offline replay drift)
        const maxAllowed = (official.division.matchDurationMinutes + 45) * 60;
        currentElapsed = Math.min(Math.round(payload.clientElapsedSeconds), maxAllowed);
      } else if (fixture.clockRunning && fixture.clockStartedAt) {
        const startMs = Date.parse(fixture.clockStartedAt);
        if (!Number.isNaN(startMs)) {
          const delta = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          currentElapsed += delta;
        }
      }
      const minute = Math.floor(currentElapsed / 60);

      await db.update(fixtures).set({
        clockRunning: 0,
        clockStartedAt: null,
        clockElapsedSeconds: currentElapsed,
        clockPauseReason: reason,
        matchClockMinute: minute,
      }).where(eq(fixtures.id, fixtureId));

      return Response.json({
        ok: true,
        clockRunning: false,
        clockElapsedSeconds: currentElapsed,
        clockPauseReason: reason,
        matchClockMinute: minute,
      });
    }

    if (payload.action === "resumeMatchClock") {
      const fixtureId = clean(payload.fixtureId, 50);
      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      const fixture = official.fixture;
      if (fixture.status !== "in_progress" || fixture.period === "completed" || fixture.period === "half_time") {
        return Response.json({ error: "Match cannot be resumed in this state." }, { status: 409 });
      }

      if (fixture.clockRunning && fixture.clockStartedAt) {
        return Response.json({
          ok: true,
          clockRunning: true,
          clockStartedAt: fixture.clockStartedAt,
          clockPauseReason: null,
          idempotent: true,
        });
      }

      const nowIso = new Date().toISOString();
      await db.update(fixtures).set({
        clockRunning: 1,
        clockStartedAt: nowIso,
        clockPauseReason: null,
      }).where(eq(fixtures.id, fixtureId));

      return Response.json({
        ok: true,
        clockRunning: true,
        clockStartedAt: nowIso,
        clockPauseReason: null,
      });
    }

    if (payload.action === "setStoppageTime") {
      const fixtureId = clean(payload.fixtureId, 50);
      const stoppageMinutes = Math.max(0, Math.min(30, numberValue(payload.stoppageMinutes, 0)));
      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });

      await db.update(fixtures).set({
        stoppageMinutes,
      }).where(eq(fixtures.id, fixtureId));

      return Response.json({
        ok: true,
        stoppageMinutes,
      });
    }

    if (payload.action === "recordDetailedMatchEvent") {
      const fixtureId = clean(payload.fixtureId, 50);
      const entryId = clean(payload.entryId, 50);
      let type = clean(payload.type, 30); // "goal", "yellow_card", "red_card", "substitution", "penalty_miss"
      const playerName = clean(payload.playerName, 100);
      const playerId = clean(payload.playerId, 50) || null;
      const assistPlayerName = clean(payload.assistPlayerName, 100);
      const assistPlayerId = clean(payload.assistPlayerId, 50) || null;
      const relatedPlayerName = clean(payload.relatedPlayerName, 100);
      const matchPeriod = clean(payload.matchPeriod, 20) || "first_half";
      const cardReason = clean(payload.cardReason, 100);
      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      const fixture = official.fixture;

      let matchMinute = numberValue(payload.matchMinute, 0);
      if (!matchMinute && fixture.status === "in_progress") {
        let elapsed = fixture.clockElapsedSeconds || 0;
        if (fixture.clockRunning && fixture.clockStartedAt) {
          const startMs = Date.parse(fixture.clockStartedAt);
          if (!Number.isNaN(startMs)) {
            elapsed += Math.max(0, Math.floor((Date.now() - startMs) / 1000));
          }
        }
        matchMinute = Math.max(1, Math.floor(elapsed / 60) + 1);
      }
      matchMinute = Math.max(0, Math.min(200, matchMinute));
      const allowedTypes = ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card", "substitution", "penalty_miss"];
      if (!allowedTypes.includes(type) || ![fixture.homeEntryId, fixture.awayEntryId].includes(entryId)) return Response.json({ error: "Invalid match event." }, { status: 400 });
      if (fixture.status !== "in_progress") return Response.json({ error: "Match events can only be recorded for a live match." }, { status: 409 });
      if (matchPeriod !== fixture.period || matchMinute > maxMinuteForPeriod(matchPeriod, Math.ceil(official.division.matchDurationMinutes / 2))) return Response.json({ error: "Event time is outside the current configured match period." }, { status: 400 });
      if (playerId && !(await playerCanBeUsed(entryId, playerId))) return Response.json({ error: "Player is not registered for this team." }, { status: 400 });
      if (assistPlayerId && !(await playerCanBeUsed(entryId, assistPlayerId))) return Response.json({ error: "Assisting player is not registered for this team." }, { status: 400 });
      if (["goal", "penalty_goal", "yellow_card", "red_card", "substitution"].includes(type) && !playerId) return Response.json({ error: "Select a registered player." }, { status: 400 });
      if (type === "yellow_card" && playerId) {
        const cautions = await db.select({ id: matchEvents.id }).from(matchEvents).where(and(eq(matchEvents.fixtureId, fixtureId), eq(matchEvents.playerId, playerId), eq(matchEvents.type, "yellow_card")));
        if (cautions.length >= 1) type = "red_card";
      }
      if (playerId) {
        const dismissed = await db.select({ id: matchEvents.id }).from(matchEvents).where(and(eq(matchEvents.fixtureId, fixtureId), eq(matchEvents.playerId, playerId), eq(matchEvents.type, "red_card"))).limit(1);
        if (dismissed.length) return Response.json({ error: "A dismissed player cannot take further part in the match." }, { status: 409 });
      }
      if (["goal", "penalty_goal", "own_goal", "yellow_card", "red_card"].includes(type) && playerId && !(await playerIsOnField(fixtureId, entryId, playerId))) {
        return Response.json({ error: "This player is not currently on the field." }, { status: 409 });
      }
      if (type === "substitution") {
        const incomingPlayerId = assistPlayerId;
        if (!playerId || !incomingPlayerId || playerId === incomingPlayerId || !(await playerIsOnField(fixtureId, entryId, playerId)) || !(await playerCanBeUsed(entryId, incomingPlayerId)) || await playerIsOnField(fixtureId, entryId, incomingPlayerId)) {
          return Response.json({ error: "A substitution needs one active player out and one eligible bench player in." }, { status: 400 });
        }

        const existingSubs = await db
          .select({
            id: matchEvents.id,
            entryId: matchEvents.entryId,
            matchMinute: matchEvents.matchMinute,
            matchPeriod: matchEvents.matchPeriod,
            type: matchEvents.type,
          })
          .from(matchEvents)
          .where(and(eq(matchEvents.fixtureId, fixtureId), eq(matchEvents.type, "substitution")));

        const subValidation = validateSubstitutionAttempt(
          entryId,
          existingSubs,
          matchMinute,
          matchPeriod,
          fixture.period === "extra_time"
        );

        if (!subValidation.allowed) {
          return Response.json({ error: subValidation.reason || "Substitution not permitted under IFAB Law 3." }, { status: 400 });
        }
      }

      const eventId = clean(payload.eventId, 50) || crypto.randomUUID();
      const [existingEvent] = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.id, eventId))
        .limit(1);

      if (existingEvent) {
        return Response.json({ event: existingEvent, idempotent: true }, { status: 200 });
      }

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

      await db.insert(matchEvents).values(event);

      await recalculateScore(fixtureId);

      return Response.json({ event }, { status: 201 });
    }

    if (payload.action === "deleteMatchEvent") {
      const eventId = clean(payload.eventId, 50);
      const [ev] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
      if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });

      if (!(await fixtureForOfficial(ev.fixtureId, user.email, user.role))) return Response.json({ error: "Event not found" }, { status: 404 });
      await db.delete(matchEvents).where(eq(matchEvents.id, eventId));
      await recalculateScore(ev.fixtureId);

      return Response.json({ ok: true });
    }

    if (payload.action === "setPOTM") {
      const fixtureId = clean(payload.fixtureId, 50);
      const potmPlayerId = clean(payload.potmPlayerId, 50) || null;
      const potmPlayerName = clean(payload.potmPlayerName, 100);

      const official = await fixtureForOfficial(fixtureId, user.email, user.role);
      if (!official) return Response.json({ error: "Fixture not found" }, { status: 404 });
      if (potmPlayerId && !(await playerCanBeUsed(official.fixture.homeEntryId, potmPlayerId)) && !(await playerCanBeUsed(official.fixture.awayEntryId, potmPlayerId))) {
        return Response.json({ error: "Player of the Match must be registered for this fixture." }, { status: 400 });
      }
      await db.update(fixtures).set({ potmPlayerId, potmPlayerName }).where(eq(fixtures.id, fixtureId));
      return Response.json({ ok: true });
    }

    if (payload.action === "updateScore") {
      const fixtureId = clean(payload.fixtureId, 50);
      const [owned] = await db
        .select({ fixture: fixtures })
        .from(fixtures)
        .innerJoin(divisions, eq(fixtures.divisionId, divisions.id))
        .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
        .where(
          and(
            eq(fixtures.id, fixtureId),
            eq(tournaments.organizerEmail, user.email),
          ),
        )
        .limit(1);
      if (!owned)
        return Response.json({ error: "Fixture not found" }, { status: 404 });
      await recalculateScore(fixtureId);
      return Response.json({ ok: true, message: "Score was recalculated from the official event record." });
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
      const announcement = {
        id: crypto.randomUUID(),
        tournamentId,
        senderEmail: user.email,
        body,
        audience: clean(payload.audience, 40) || "all_participants",
      };
      await db.insert(announcements).values(announcement);
      return Response.json({ announcement }, { status: 201 });
    }

    if (payload.action === "deleteTournament") {
      const tournamentId = clean(payload.tournamentId, 50);
      if (!(await ownedTournament(tournamentId, user.email)))
        return Response.json(
          { error: "Tournament not found" },
          { status: 404 },
        );
      await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
