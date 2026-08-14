import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import {
  clubs,
  divisions,
  entries,
  teams,
  tournaments,
} from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { apiError } from "../../../../lib/server";

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
    if (!tournament || tournament.status !== "registration_open")
      return Response.json(
        { error: "Registration is not available." },
        { status: 404 },
      );
    const divisionRows = await db
      .select()
      .from(divisions)
      .where(eq(divisions.tournamentId, id));
    const counts = await Promise.all(
      divisionRows.map(async (division) => {
        const rows = await db
          .select({ id: entries.id })
          .from(entries)
          .where(eq(entries.divisionId, division.id));
        return { divisionId: division.id, registered: rows.length };
      }),
    );
    return Response.json({
      tournament,
      divisions: divisionRows.map((division) => ({
        ...division,
        registered:
          counts.find((item) => item.divisionId === division.id)?.registered ??
          0,
      })),
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
        { error: "Registration is closed." },
        { status: 404 },
      );
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
    const clubId = crypto.randomUUID();
    const teamId = crypto.randomUUID();
    const entryId = crypto.randomUUID();
    await db.batch([
      db.insert(clubs).values({
        id: clubId,
        ownerEmail: signedIn?.email ?? null,
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
        status: "pending",
        paymentStatus: "unpaid",
        amountPaise: division.feePaise,
        notes: clean(payload.notes, 500),
      }),
    ]);
    return Response.json(
      {
        entryId,
        linkedToAccount: Boolean(signedIn),
        message: "Registration submitted for organizer approval.",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
