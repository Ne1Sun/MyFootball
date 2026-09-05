import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  announcements,
  clubs,
  divisions,
  entries,
  fixtures,
  follows,
  matchEvents,
  players,
  squadMembers,
  teams,
  tournaments,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { apiError } from "../../../../lib/server";
import { publicTournamentStatus } from "../../../../lib/tournament-status";

const clean = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const db = getDb();
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .limit(1);

    if (!tournament) {
      return Response.json({ error: "Tournament not found" }, { status: 404 });
    }

    const divisionRows = await db
      .select()
      .from(divisions)
      .where(eq(divisions.tournamentId, id))
      .orderBy(asc(divisions.createdAt));

    const divisionIds = divisionRows.map((d) => d.id);

    const entryRows = divisionIds.length
      ? await db
          .select({
            id: entries.id,
            divisionId: entries.divisionId,
            teamId: entries.teamId,
            clubId: clubs.id,
            status: entries.status,
            seed: entries.seed,
            groupName: entries.groupName,
            teamName: teams.name,
            clubName: clubs.name,
            city: clubs.city,
          })
          .from(entries)
          .innerJoin(teams, eq(entries.teamId, teams.id))
          .innerJoin(clubs, eq(teams.clubId, clubs.id))
          .where(and(inArray(entries.divisionId, divisionIds), eq(entries.status, "approved")))
      : [];
    const allEntryRows = divisionIds.length
      ? await db
          .select({ id: entries.id, divisionId: entries.divisionId, status: entries.status })
          .from(entries)
          .where(inArray(entries.divisionId, divisionIds))
      : [];
    const entryIds = entryRows.map((entry) => entry.id);
    const clubIds = [...new Set(entryRows.map((entry) => entry.clubId))];
    const playerRows = clubIds.length
      ? await db
          .select({
            id: players.id,
            clubId: players.clubId,
            name: players.name,
            jerseyNumber: players.jerseyNumber,
            position: players.position,
            isCaptain: players.isCaptain,
            photoUrl: players.photoUrl,
            createdAt: players.createdAt,
          })
          .from(players)
          .where(inArray(players.clubId, clubIds))
          .orderBy(asc(players.jerseyNumber), asc(players.name))
      : [];
    const squadRows = entryIds.length
      ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds))
      : [];

    const fixtureRows = divisionIds.length
      ? await db
          .select()
          .from(fixtures)
          .where(inArray(fixtures.divisionId, divisionIds))
          .orderBy(asc(fixtures.kickoffAt), asc(fixtures.pitch))
      : [];

    const fixtureIds = fixtureRows.map((f) => f.id);

    const eventRows = fixtureIds.length
      ? await db
          .select({
            id: matchEvents.id,
            fixtureId: matchEvents.fixtureId,
            entryId: matchEvents.entryId,
            type: matchEvents.type,
            playerName: matchEvents.playerName,
            playerId: matchEvents.playerId,
            assistPlayerName: matchEvents.assistPlayerName,
            assistPlayerId: matchEvents.assistPlayerId,
            relatedPlayerName: matchEvents.relatedPlayerName,
            matchMinute: matchEvents.matchMinute,
            matchPeriod: matchEvents.matchPeriod,
            cardReason: matchEvents.cardReason,
            createdAt: matchEvents.createdAt,
          })
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, fixtureIds))
          .orderBy(desc(matchEvents.matchMinute), desc(matchEvents.createdAt))
      : [];

    const announcementRows = await db
      .select({
        id: announcements.id,
        tournamentId: announcements.tournamentId,
        body: announcements.body,
        audience: announcements.audience,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .where(
        and(
          eq(announcements.tournamentId, id),
          eq(announcements.audience, "all_participants"),
        ),
      )
      .orderBy(desc(announcements.createdAt));

    const signedIn = await getChatGPTUser();
    let isFollowed = false;
    if (signedIn) {
      const [follow] = await db
        .select()
        .from(follows)
        .where(and(eq(follows.userEmail, signedIn.email), eq(follows.tournamentId, id)))
        .limit(1);
      isFollowed = Boolean(follow);
    }

    return Response.json({
      tournament: {
        ...tournament,
        organizerEmail: undefined,
        status: publicTournamentStatus(tournament.status, tournament.registrationClosesAt),
      },
      divisions: divisionRows.map((division) => ({
        ...division,
        registered: allEntryRows.filter(
          (entry) => entry.divisionId === division.id && ["pending", "approved"].includes(entry.status),
        ).length,
      })),
      entries: entryRows,
      fixtures: fixtureRows,
      events: eventRows.map((event) => ({ ...event, recordedBy: "" })),
      announcements: announcementRows,
      players: playerRows,
      squadMembers: squadRows,
      isFollowed,
      user: signedIn,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const signedIn = await getChatGPTUser();
    if (!signedIn) {
      return Response.json(
        { error: "Sign in with your fan account before registering a team." },
        { status: 401 },
      );
    }
    const db = getDb();
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(
        and(
          eq(tournaments.id, id),
          eq(tournaments.status, "registration_open"),
        ),
      )
      .limit(1);
    if (!tournament)
      return Response.json(
        { error: "Registration is closed for this tournament." },
        { status: 404 },
      );
    if (
      tournament.registrationClosesAt &&
      new Date(tournament.registrationClosesAt).getTime() <= Date.now()
    ) {
      return Response.json(
        { error: "The registration deadline has passed." },
        { status: 409 },
      );
    }
    const divisionId = clean(payload.divisionId, 50);
    const [division] = await db
      .select()
      .from(divisions)
      .where(and(eq(divisions.id, divisionId), eq(divisions.tournamentId, id)))
      .limit(1);
    if (!division)
      return Response.json(
        { error: "Select a valid division." },
        { status: 400 },
      );
    const existing = await db
      .select({ id: entries.id, status: entries.status })
      .from(entries)
      .where(eq(entries.divisionId, divisionId));
    const activeEntries = existing.filter((entry) => ["pending", "approved"].includes(entry.status));
    if (activeEntries.length >= division.maxTeams)
      return Response.json(
        { error: "This division is full." },
        { status: 409 },
      );
    const clubName = clean(payload.clubName);
    const teamName = clean(payload.teamName);
    const contactName = clean(payload.contactName, 100);
    const contactPhone = clean(payload.contactPhone, 20);
    if (!clubName || !teamName || !contactName || contactPhone.replace(/\D/g, "").length < 10)
      return Response.json(
        { error: "Complete all required fields." },
        { status: 400 },
      );
    const [existingClub] = await db
      .select()
      .from(clubs)
      .where(and(eq(clubs.ownerEmail, signedIn.email), eq(clubs.name, clubName)))
      .limit(1);
    const clubId = existingClub?.id ?? crypto.randomUUID();
    const [existingTeam] = existingClub
      ? await db
          .select()
          .from(teams)
          .where(and(eq(teams.clubId, existingClub.id), eq(teams.name, teamName)))
          .limit(1)
      : [];
    const teamId = existingTeam?.id ?? crypto.randomUUID();
    const groupIndex = activeEntries.length % Math.max(1, division.groupsCount);
    const groupName = `Group ${String.fromCharCode(65 + groupIndex)}`;
    if (existingTeam) {
      const [duplicate] = await db
        .select({ id: entries.id, status: entries.status })
        .from(entries)
        .where(and(eq(entries.divisionId, divisionId), eq(entries.teamId, existingTeam.id)))
        .limit(1);
      if (duplicate && ["pending", "approved"].includes(duplicate.status)) {
        return Response.json({ error: "This team is already registered in the selected division." }, { status: 409 });
      }
      if (duplicate) {
        await db.update(entries).set({
          status: "pending",
          paymentStatus: "unpaid",
          amountPaise: division.feePaise,
          groupName,
          notes: clean(payload.notes, 500),
          registeredAt: new Date().toISOString(),
          approvedAt: null,
        }).where(eq(entries.id, duplicate.id));
        return Response.json(
          {
            entryId: duplicate.id,
            linkedToAccount: true,
            message: "Registration resubmitted for organizer approval.",
          },
          { status: 200 },
        );
      }
    }
    const entryId = crypto.randomUUID();
    const insertEntry = db.insert(entries).values({
      id: entryId,
      divisionId,
      teamId,
      status: "pending",
      paymentStatus: "unpaid",
      amountPaise: division.feePaise,
      groupName,
      notes: clean(payload.notes, 500),
    });
    if (!existingClub) {
      await db.batch([
        db.insert(clubs).values({
          id: clubId,
          ownerEmail: signedIn.email,
          name: clubName,
          organizationType: clean(payload.organizationType, 30) || "club",
          city: clean(payload.city, 100),
          contactName,
          contactPhone,
        }),
        db.insert(teams).values({ id: teamId, clubId, name: teamName }),
        insertEntry,
      ]);
    } else if (!existingTeam) {
      await db.batch([
        db.update(clubs).set({ contactName, contactPhone }).where(eq(clubs.id, existingClub.id)),
        db.insert(teams).values({ id: teamId, clubId, name: teamName }),
        insertEntry,
      ]);
    } else {
      await db.batch([
        db.update(clubs).set({ contactName, contactPhone }).where(eq(clubs.id, existingClub.id)),
        insertEntry,
      ]);
    }
    return Response.json(
      {
        entryId,
        linkedToAccount: true,
        message: "Registration submitted for organizer approval.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
