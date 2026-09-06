import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  clubs,
  divisions,
  entries,
  fixtures,
  follows,
  teams,
  tournaments,
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { apiError, requireApiUser } from "../../lib/server";

const clean = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const url = new URL(request.url);
    const search = clean(url.searchParams.get("search"), 120).toLowerCase();
    const state = clean(url.searchParams.get("state"), 100).toLowerCase();
    const city = clean(url.searchParams.get("city"), 100).toLowerCase();
    const locality = clean(url.searchParams.get("locality"), 120).toLowerCase();
    const all = await db
      .select()
      .from(tournaments)
      .orderBy(asc(tournaments.startDate));
    const visible = all.filter((item) => {
      if (
        !item.addressLine1 ||
        !item.locality ||
        !item.state ||
        !item.postalCode ||
        !item.latitude ||
        !item.longitude
      )
        return false;
      if (
        !new Set([
          "registration_open",
          "registration_closed",
          "scheduled",
          "live",
        ]).has(item.status)
      )
        return false;
      const haystack =
        `${item.name} ${item.organizedBy} ${item.venueName} ${item.addressLine1} ${item.locality} ${item.city} ${item.state} ${item.postalCode}`.toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (!state || item.state.toLowerCase().includes(state)) &&
        (!city || item.city.toLowerCase().includes(city)) &&
        (!locality || item.locality.toLowerCase().includes(locality))
      );
    });
    const tournamentIds = visible.map((item) => item.id);
    const divisionRows = tournamentIds.length
      ? await db
          .select()
          .from(divisions)
          .where(inArray(divisions.tournamentId, tournamentIds))
      : [];
    const divisionIds = divisionRows.map((item) => item.id);
    const entryRows = divisionIds.length
      ? await db
          .select({
            id: entries.id,
            divisionId: entries.divisionId,
            status: entries.status,
          })
          .from(entries)
          .where(inArray(entries.divisionId, divisionIds))
      : [];
    const fixtureRows = divisionIds.length
      ? await db
          .select()
          .from(fixtures)
          .where(inArray(fixtures.divisionId, divisionIds))
          .orderBy(asc(fixtures.kickoffAt))
      : [];
    const signedIn = await getChatGPTUser();
    const followed =
      signedIn && tournamentIds.length
        ? await db
            .select()
            .from(follows)
            .where(
              and(
                eq(follows.userEmail, signedIn.email),
                inArray(follows.tournamentId, tournamentIds),
              ),
            )
        : [];
    const myEntries =
      signedIn && divisionIds.length
        ? await db
            .select({ id: entries.id, divisionId: entries.divisionId })
            .from(entries)
            .innerJoin(teams, eq(entries.teamId, teams.id))
            .innerJoin(clubs, eq(teams.clubId, clubs.id))
            .where(
              and(
                eq(clubs.ownerEmail, signedIn.email),
                inArray(entries.divisionId, divisionIds),
              ),
            )
        : [];
    const followedIds = new Set(followed.map((item) => item.tournamentId));
    return Response.json({
      tournaments: visible.map((tournament) => {
        const tournamentDivisions = divisionRows.filter(
          (item) => item.tournamentId === tournament.id,
        );
        const tournamentDivisionIds = tournamentDivisions.map(
          (item) => item.id,
        );
        const tournamentEntries = entryRows.filter((item) =>
          tournamentDivisionIds.includes(item.divisionId),
        );
        const nextFixture = fixtureRows.find(
          (item) =>
            tournamentDivisionIds.includes(item.divisionId) &&
            item.status !== "completed",
        );
        return {
          ...tournament,
          divisions: tournamentDivisions,
          registeredTeams: tournamentEntries.length,
          approvedTeams: tournamentEntries.filter(
            (item) => item.status === "approved",
          ).length,
          nextFixture,
          followed: followedIds.has(tournament.id),
          myRegistrations: myEntries.filter((item) =>
            tournamentDivisionIds.includes(item.divisionId),
          ).length,
        };
      }),
      areas: {
        states: [
          ...new Set(
            all.filter((item) => item.state).map((item) => item.state),
          ),
        ].sort(),
        cities: [
          ...new Set(all.filter((item) => item.city).map((item) => item.city)),
        ].sort(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (!user)
      return Response.json(
        { error: "Sign in to follow tournaments." },
        { status: 401 },
      );
    const payload = (await request.json()) as Record<string, unknown>;
    const tournamentId = clean(payload.tournamentId, 50);
    const db = getDb();
    const [tournament] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);
    if (!tournament)
      return Response.json({ error: "Tournament not found." }, { status: 404 });
    if (payload.follow === false)
      await db
        .delete(follows)
        .where(
          and(
            eq(follows.userEmail, user.email),
            eq(follows.tournamentId, tournamentId),
          ),
        );
    else
      await db
        .insert(follows)
        .values({ userEmail: user.email, tournamentId })
        .onConflictDoNothing();
    return Response.json({ followed: payload.follow !== false });
  } catch (error) {
    return apiError(error);
  }
}
