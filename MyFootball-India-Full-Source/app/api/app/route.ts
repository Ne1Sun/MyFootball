import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  announcements,
  clubs,
  divisions,
  entries,
  fixtures,
  matchEvents,
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
            status: entries.status,
            paymentStatus: entries.paymentStatus,
            amountPaise: entries.amountPaise,
            seed: entries.seed,
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
          .orderBy(desc(matchEvents.createdAt))
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
          approvedAt: approved ? new Date().toISOString() : null,
        }),
      ]);
      return Response.json({ id: entryId }, { status: 201 });
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
      await db
        .update(entries)
        .set({
          status,
          paymentStatus,
          approvedAt:
            status === "approved"
              ? new Date().toISOString()
              : owned.entry.approvedAt,
        })
        .where(eq(entries.id, entryId));
      return Response.json({ ok: true });
    }

    if (payload.action === "generateFixtures") {
      const divisionId = clean(payload.divisionId, 50);
      const owned = await ownedDivision(divisionId, user.email);
      if (!owned)
        return Response.json({ error: "Division not found" }, { status: 404 });
      const approvedEntries = await db
        .select({ id: entries.id })
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
      const existingLive = await db
        .select({ id: fixtures.id })
        .from(fixtures)
        .where(
          and(eq(fixtures.divisionId, divisionId), eq(fixtures.status, "live")),
        )
        .limit(1);
      if (existingLive.length)
        return Response.json(
          { error: "Finish the live match before regenerating fixtures." },
          { status: 409 },
        );

      const mode = clean(payload.mode, 20) || "round_robin";
      const startDate = clean(payload.startDate, 10);
      const startTime = clean(payload.startTime, 5) || "09:00";
      const pitches = Math.max(
        1,
        Math.min(12, numberValue(payload.pitches, 1)),
      );
      const slotMinutes = Math.max(
        20,
        Math.min(180, numberValue(payload.slotMinutes, 60)),
      );
      if (!startDate)
        return Response.json(
          { error: "A fixture date is required." },
          { status: 400 },
        );

      const ids = approvedEntries.map((item) => item.id);
      const pairings: Array<{ round: number; home: string; away: string }> = [];
      if (mode === "knockout") {
        const seeded = [...ids];
        for (let index = 0; index < Math.floor(seeded.length / 2); index += 1) {
          pairings.push({
            round: 1,
            home: seeded[index],
            away: seeded[seeded.length - 1 - index],
          });
        }
      } else {
        const rotation: Array<string | null> = [...ids];
        if (rotation.length % 2) rotation.push(null);
        const rounds = rotation.length - 1;
        for (let round = 0; round < rounds; round += 1) {
          for (let index = 0; index < rotation.length / 2; index += 1) {
            const home = rotation[index];
            const away = rotation[rotation.length - 1 - index];
            if (home && away) pairings.push({ round: round + 1, home, away });
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
          roundName:
            mode === "knockout" ? "Knockout Round 1" : `Round ${pair.round}`,
          homeEntryId: pair.home,
          awayEntryId: pair.away,
          kickoffAt: new Date(
            base.getTime() + slot * slotMinutes * 60_000,
          ).toISOString(),
          pitch: (index % pitches) + 1,
          status: "scheduled",
        };
      });
      await db.delete(fixtures).where(eq(fixtures.divisionId, divisionId));
      if (fixtureRows.length) await db.insert(fixtures).values(fixtureRows);
      return Response.json({ fixtures: fixtureRows }, { status: 201 });
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

    if (payload.action === "addEvent") {
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
      const entryId = clean(payload.entryId, 50);
      if (
        entryId !== owned.fixture.homeEntryId &&
        entryId !== owned.fixture.awayEntryId
      ) {
        return Response.json(
          { error: "Team is not part of this fixture" },
          { status: 400 },
        );
      }
      const event = {
        id: crypto.randomUUID(),
        fixtureId,
        entryId,
        type: clean(payload.type, 30),
        playerName: clean(payload.playerName, 100),
        relatedPlayerName: clean(payload.relatedPlayerName, 100),
        matchMinute: Math.max(
          0,
          Math.min(200, numberValue(payload.matchMinute, 0)),
        ),
        recordedBy: user.email,
      };
      await db.insert(matchEvents).values(event);
      return Response.json({ event }, { status: 201 });
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
