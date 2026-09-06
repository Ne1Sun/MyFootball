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
import { apiError, requireApiUser } from "../../../../lib/server";

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
    if (!["registration_open", "registration_closed", "scheduled", "live", "completed"].includes(tournament.status)) {
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
            paymentStatus: entries.paymentStatus,
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
          .select()
          .from(matchEvents)
          .where(inArray(matchEvents.fixtureId, fixtureIds))
          .orderBy(desc(matchEvents.matchMinute), desc(matchEvents.createdAt))
      : [];

    const announcementRows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.tournamentId, id))
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
      tournament,
      divisions: divisionRows,
      entries: entryRows,
      fixtures: fixtureRows,
      events: eventRows,
      announcements: announcementRows,
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
    const signedIn = await requireApiUser();
    if (!signedIn) return Response.json({ error: "Sign in to register a team." }, { status: 401 });
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
    if (tournament.registrationClosesAt && Date.parse(tournament.registrationClosesAt) <= Date.now()) {
      return Response.json({ error: "Registration has closed for this tournament." }, { status: 409 });
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
      .select({ id: entries.id })
      .from(entries)
      .where(eq(entries.divisionId, divisionId));
    if (existing.length >= division.maxTeams)
      return Response.json(
        { error: "This division is full." },
        { status: 409 },
      );
    const clubName = clean(payload.clubName);
    const teamName = clean(payload.teamName);
    const contactName = clean(payload.contactName, 100);
    const contactPhone = clean(payload.contactPhone, 20);
    if (!clubName || !teamName || !contactName || !contactPhone)
      return Response.json(
        { error: "Complete all required fields." },
        { status: 400 },
      );
    const [existingClub] = await db.select().from(clubs)
      .where(and(eq(clubs.ownerEmail, signedIn.email), eq(clubs.name, clubName))).limit(1);
    const clubId = existingClub?.id ?? crypto.randomUUID();
    const teamId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    if (!existingClub) await db.insert(clubs).values({
        id: clubId,
        ownerEmail: signedIn.email,
        name: clubName,
        organizationType: clean(payload.organizationType, 30) || "club",
        city: clean(payload.city, 100),
        contactName,
        contactPhone,
      });
    await db.batch([
      db.insert(teams).values({ id: teamId, clubId, name: teamName }),
      db.insert(entries).values({
        id: entryId,
        divisionId,
        teamId,
        status: "pending",
        paymentStatus: "unpaid",
        amountPaise: division.feePaise,
        notes: clean(payload.notes, 500),
      }),
    ]);
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
