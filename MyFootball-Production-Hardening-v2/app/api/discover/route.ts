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
import { apiError, chunkedQuery, requireApiUser } from "../../lib/server";

const clean = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const signedIn = await getChatGPTUser();
    const isTestUser = signedIn
      ? signedIn.email === "organizer@myfootball.in" ||
        signedIn.email === "demo@myfootball.in" ||
        signedIn.email.endsWith("@myfootball.in")
      : false;

    const url = new URL(request.url);
    const search = clean(url.searchParams.get("search"), 120).toLowerCase();
    const state = clean(url.searchParams.get("state"), 100).toLowerCase();
    const city = clean(url.searchParams.get("city"), 100).toLowerCase();
    const locality = clean(url.searchParams.get("locality"), 120).toLowerCase();
    const teamFormat = clean(url.searchParams.get("teamFormat"), 20).toLowerCase();
    const all = await db
      .select()
      .from(tournaments)
      .orderBy(asc(tournaments.startDate));
    const visible = all.filter((item) => {
      if (!item.name || !item.city) return false;

      const isPublic = new Set([
        "registration_open",
        "registration_closed",
        "scheduled",
        "live",
      ]).has(item.status);

      const isOrganizerPreview =
        item.status === "draft" &&
        signedIn &&
        (item.organizerEmail === signedIn.email || isTestUser);

      if (!isPublic && !isOrganizerPreview) return false;

      const address = item.addressLine1 || item.venueName || "";
      const loc = item.locality || "";
      const st = item.state || "";
      const pin = item.postalCode || "";
      const haystack =
        `${item.name} ${item.organizedBy || ""} ${item.venueName || ""} ${address} ${loc} ${item.city} ${st} ${pin}`.toLowerCase();
      const formatVal = (item.teamFormat || "11v11").toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (!state || (item.state && item.state.toLowerCase().includes(state))) &&
        (!city || (item.city && item.city.toLowerCase().includes(city))) &&
        (!locality || (item.locality && item.locality.toLowerCase().includes(locality))) &&
        (!teamFormat || formatVal === teamFormat)
      );
    });
    const tournamentIds = visible.map((item) => item.id);
    const divisionRows = tournamentIds.length
      ? await chunkedQuery(tournamentIds, 50, (chunk) =>
          db
            .select()
            .from(divisions)
            .where(inArray(divisions.tournamentId, chunk)),
        )
      : [];
    const divisionIds = divisionRows.map((item) => item.id);
    const entryRows = divisionIds.length
      ? await chunkedQuery(divisionIds, 50, (chunk) =>
          db
            .select({
              id: entries.id,
              divisionId: entries.divisionId,
              status: entries.status,
            })
            .from(entries)
            .where(inArray(entries.divisionId, chunk)),
        )
      : [];
    const fixtureRows = divisionIds.length
      ? await chunkedQuery(divisionIds, 50, (chunk) =>
          db
            .select()
            .from(fixtures)
            .where(inArray(fixtures.divisionId, chunk))
            .orderBy(asc(fixtures.kickoffAt)),
        )
      : [];
    const followed =
      signedIn && tournamentIds.length
        ? await chunkedQuery(tournamentIds, 50, (chunk) =>
            db
              .select()
              .from(follows)
              .where(
                and(
                  eq(follows.userEmail, signedIn.email),
                  inArray(follows.tournamentId, chunk),
                ),
              ),
          )
        : [];
    const myEntries =
      signedIn && divisionIds.length
        ? await chunkedQuery(divisionIds, 50, (chunk) =>
            db
              .select({ id: entries.id, divisionId: entries.divisionId })
              .from(entries)
              .innerJoin(teams, eq(entries.teamId, teams.id))
              .innerJoin(clubs, eq(teams.clubId, clubs.id))
              .where(
                and(
                  eq(clubs.ownerEmail, signedIn.email),
                  inArray(entries.divisionId, chunk),
                ),
              ),
          )
        : [];
    const liveFixtureRows = fixtureRows.filter((f) => f.status === "in_progress");
    const liveEntryIds = [
      ...new Set(
        liveFixtureRows
          .flatMap((f) => [f.homeEntryId, f.awayEntryId])
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const liveEntries = liveEntryIds.length
      ? await chunkedQuery(liveEntryIds, 50, (chunk) =>
          db
            .select({
              id: entries.id,
              teamName: teams.name,
              clubName: clubs.name,
            })
            .from(entries)
            .innerJoin(teams, eq(entries.teamId, teams.id))
            .innerJoin(clubs, eq(teams.clubId, clubs.id))
            .where(inArray(entries.id, chunk)),
        )
      : [];

    const entryNameMap = new Map(
      liveEntries.map((e) => [e.id, { teamName: e.teamName, clubName: e.clubName }]),
    );
    const divisionMap = new Map(divisionRows.map((d) => [d.id, d]));
    const tournamentMap = new Map(visible.map((t) => [t.id, t]));

    const liveMatches = liveFixtureRows.map((f) => {
      const div = divisionMap.get(f.divisionId);
      const tourney = div ? tournamentMap.get(div.tournamentId) : null;
      const home = f.homeEntryId ? entryNameMap.get(f.homeEntryId) : null;
      const away = f.awayEntryId ? entryNameMap.get(f.awayEntryId) : null;
      return {
        fixtureId: f.id,
        tournamentId: tourney?.id || "",
        tournamentName: tourney?.name || "Tournament",
        tournamentState: tourney?.state || "",
        venueName: tourney?.venueName || "",
        divisionId: f.divisionId,
        divisionName: div?.name || "Division",
        matchDurationMinutes: div?.matchDurationMinutes || 50,
        roundName: f.roundName,
        pitch: f.pitch,
        status: f.status,
        period: f.period,
        matchClockMinute: f.matchClockMinute,
        clockStartedAt: f.clockStartedAt,
        clockRunning: Boolean(f.clockRunning),
        clockElapsedSeconds: f.clockElapsedSeconds ?? 0,
        stoppageMinutes: f.stoppageMinutes ?? 0,
        clockPauseReason: f.clockPauseReason,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        homeScorePenalties: f.homeScorePenalties,
        awayScorePenalties: f.awayScorePenalties,
        homeTeamName: home?.teamName || "Home Team",
        homeClubName: home?.clubName || "",
        awayTeamName: away?.teamName || "Away Team",
        awayClubName: away?.clubName || "",
      };
    });

    const followedIds = new Set(followed.map((item) => item.tournamentId));
    return Response.json({
      liveMatches,
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
