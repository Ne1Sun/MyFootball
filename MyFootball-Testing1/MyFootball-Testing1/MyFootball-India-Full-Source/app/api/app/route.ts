import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  announcements,
  clubs,
  divisions,
  entries,
  fixtures,
  matchEvents,
  players,
  squadMembers,
  teams,
  tournaments,
  users,
} from "../../../db/schema";
import { apiError, requireApiUser } from "../../lib/server";

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
        status: "registration_open",
        contactName: clean(payload.contactName, 100) || user.displayName,
        contactPhone: clean(payload.contactPhone, 20),
        registrationClosesAt: clean(payload.registrationClosesAt, 30) || null,
      };
      const format = clean(payload.format, 30) || "group_knockout";
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
        .select({ entry: entries })
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
      await db.delete(players).where(eq(players.id, playerId));
      return Response.json({ ok: true });
    }

    if (payload.action === "updateSquad") {
      const entryId = clean(payload.entryId, 50);
      const squadList = Array.isArray(payload.squad) ? payload.squad : [];

      if (!entryId) return Response.json({ error: "Entry ID required" }, { status: 400 });

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

      const mode = clean(payload.mode, 20) || owned.division.format;
      const startDate = clean(payload.startDate, 10);
      const startTime = clean(payload.startTime, 5) || "09:00";
      const pitches = Math.max(1, Math.min(12, numberValue(payload.pitches, 2)));
      const slotMinutes = Math.max(20, Math.min(180, numberValue(payload.slotMinutes, 60)));
      if (!startDate)
        return Response.json({ error: "A fixture date is required." }, { status: 400 });

      const pairings: Array<{ round: number; roundName: string; stage: string; bracketRound?: string; bracketIndex?: number; home: string; away: string }> = [];

      if (mode === "knockout") {
        const seeded = [...approvedEntries.map(e => e.id)];
        const total = seeded.length;
        if (total >= 4) {
          // If 4 teams: Semi-Finals + 3rd Place + Final
          pairings.push({ round: 1, roundName: "Semi-Final 1", stage: "knockout", bracketRound: "semi_final", bracketIndex: 1, home: seeded[0], away: seeded[3] || seeded[1] });
          pairings.push({ round: 1, roundName: "Semi-Final 2", stage: "knockout", bracketRound: "semi_final", bracketIndex: 2, home: seeded[1], away: seeded[2] });
          // Placeholders for Final and 3rd place
          pairings.push({ round: 2, roundName: "3rd Place Playoff", stage: "knockout", bracketRound: "third_place", bracketIndex: 1, home: seeded[0], away: seeded[1] });
          pairings.push({ round: 2, roundName: "Grand Final", stage: "knockout", bracketRound: "final", bracketIndex: 1, home: seeded[0], away: seeded[1] });
        } else {
          for (let index = 0; index < Math.floor(seeded.length / 2); index += 1) {
            pairings.push({
              round: 1,
              roundName: "Knockout Round 1",
              stage: "knockout",
              home: seeded[index],
              away: seeded[seeded.length - 1 - index],
            });
          }
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
        const rotation: Array<string | null> = [...ids];
        if (rotation.length % 2) rotation.push(null);
        const rounds = rotation.length - 1;
        for (let round = 0; round < rounds; round += 1) {
          for (let index = 0; index < rotation.length / 2; index += 1) {
            const home = rotation[index];
            const away = rotation[rotation.length - 1 - index];
            if (home && away) pairings.push({ round: round + 1, roundName: `Round ${round + 1}`, stage: "group", home, away });
          }
          const fixed = rotation[0];
          const rest = rotation.slice(1);
          rest.unshift(rest.pop() ?? null);
          rotation.splice(0, rotation.length, fixed, ...rest);
        }
      }

      const base = new Date(`${startDate}T${startTime}:00+05:30`);
      const fixtureRows = pairings.map((pair, index) => {
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

      // Clear existing fixtures & match events for this division
      const existingFixtures = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.divisionId, divisionId));
      if (existingFixtures.length > 0) {
        const fIds = existingFixtures.map(f => f.id);
        await db.delete(matchEvents).where(inArray(matchEvents.fixtureId, fIds));
        await db.delete(fixtures).where(eq(fixtures.divisionId, divisionId));
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

      const [currentFix] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
      if (!currentFix) return Response.json({ error: "Fixture not found" }, { status: 404 });

      // Mark current fixture as completed
      await db.update(fixtures).set({
        status: "completed",
        period: "completed",
        homeScorePenalties,
        awayScorePenalties,
      }).where(eq(fixtures.id, fixtureId));

      // Advance into next round if this was a semi-final or quarter-final
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
      }

      return Response.json({ ok: true });
    }

    // --- LIVE MATCHDAY ACTIONS ---

    if (payload.action === "updateLiveMatch") {
      const fixtureId = clean(payload.fixtureId, 50);
      const status = clean(payload.status, 20);
      const period = clean(payload.period, 20);
      const matchClockMinute = numberValue(payload.matchClockMinute, 0);
      const homeScore = payload.homeScore !== undefined ? numberValue(payload.homeScore) : undefined;
      const awayScore = payload.awayScore !== undefined ? numberValue(payload.awayScore) : undefined;

      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (period) updateData.period = period;
      if (matchClockMinute !== undefined) updateData.matchClockMinute = Math.max(0, matchClockMinute);
      if (homeScore !== undefined) updateData.homeScore = Math.max(0, homeScore);
      if (awayScore !== undefined) updateData.awayScore = Math.max(0, awayScore);

      await db.update(fixtures).set(updateData).where(eq(fixtures.id, fixtureId));
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

      const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
      if (!fixture) return Response.json({ error: "Fixture not found" }, { status: 404 });

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

      await db.insert(matchEvents).values(event);

      // If it's a goal or penalty_goal, increment fixture score automatically!
      if (type === "goal" || type === "penalty_goal") {
        if (entryId === fixture.homeEntryId) {
          await db.update(fixtures).set({ homeScore: fixture.homeScore + 1 }).where(eq(fixtures.id, fixtureId));
        } else if (entryId === fixture.awayEntryId) {
          await db.update(fixtures).set({ awayScore: fixture.awayScore + 1 }).where(eq(fixtures.id, fixtureId));
        }
      } else if (type === "own_goal") {
        // Own goal adds to opponent's score
        if (entryId === fixture.homeEntryId) {
          await db.update(fixtures).set({ awayScore: fixture.awayScore + 1 }).where(eq(fixtures.id, fixtureId));
        } else if (entryId === fixture.awayEntryId) {
          await db.update(fixtures).set({ homeScore: fixture.homeScore + 1 }).where(eq(fixtures.id, fixtureId));
        }
      }

      return Response.json({ event }, { status: 201 });
    }

    if (payload.action === "deleteMatchEvent") {
      const eventId = clean(payload.eventId, 50);
      const [ev] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
      if (!ev) return Response.json({ error: "Event not found" }, { status: 404 });

      const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, ev.fixtureId)).limit(1);
      await db.delete(matchEvents).where(eq(matchEvents.id, eventId));

      // Revert score if goal was deleted
      if (fixture && (ev.type === "goal" || ev.type === "penalty_goal")) {
        if (ev.entryId === fixture.homeEntryId) {
          await db.update(fixtures).set({ homeScore: Math.max(0, fixture.homeScore - 1) }).where(eq(fixtures.id, fixture.id));
        } else if (ev.entryId === fixture.awayEntryId) {
          await db.update(fixtures).set({ awayScore: Math.max(0, fixture.awayScore - 1) }).where(eq(fixtures.id, fixture.id));
        }
      }

      return Response.json({ ok: true });
    }

    if (payload.action === "setPOTM") {
      const fixtureId = clean(payload.fixtureId, 50);
      const potmPlayerId = clean(payload.potmPlayerId, 50) || null;
      const potmPlayerName = clean(payload.potmPlayerName, 100);

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
      await db
        .update(fixtures)
        .set({
          homeScore: Math.max(
            0,
            numberValue(payload.homeScore, owned.fixture.homeScore),
          ),
          awayScore: Math.max(
            0,
            numberValue(payload.awayScore, owned.fixture.awayScore),
          ),
          status: clean(payload.status, 20) || owned.fixture.status,
        })
        .where(eq(fixtures.id, fixtureId));
      return Response.json({ ok: true });
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
