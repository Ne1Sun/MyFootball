import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  clubs,
  divisions,
  entries,
  fixtures,
  matchEvents,
  players,
  squadMembers,
  teams,
  tournaments,
} from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import type { Entry } from "../components/types";
import { RefereeConsoleClient } from "./referee-console-client";

export const dynamic = "force-dynamic";

export default async function RefereePage() {
  const user = await requireChatGPTUser("/referee");
  const db = getDb();

  const tournamentRows = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.organizerEmail, user.email));
  const tournamentIds = tournamentRows.map((tournament) => tournament.id);
  const divisionRows = tournamentIds.length
    ? await db.select().from(divisions).where(inArray(divisions.tournamentId, tournamentIds))
    : [];
  const divisionIds = divisionRows.map((division) => division.id);
  const fixtureRows = divisionIds.length
    ? await db.select().from(fixtures).where(inArray(fixtures.divisionId, divisionIds)).orderBy(asc(fixtures.kickoffAt))
    : [];
  const entryRows = divisionIds.length ? await db
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
    .where(inArray(entries.divisionId, divisionIds)) : [];

  const entryIds = entryRows.map((entry) => entry.id);
  const clubIds = [...new Set(entryRows.map((entry) => entry.clubId))];
  const fixtureIds = fixtureRows.map((fixture) => fixture.id);
  const playerRows = clubIds.length ? await db.select().from(players).where(inArray(players.clubId, clubIds)) : [];
  const squadRows = entryIds.length ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds)) : [];
  const eventRows = fixtureIds.length
    ? await db.select().from(matchEvents).where(inArray(matchEvents.fixtureId, fixtureIds)).orderBy(desc(matchEvents.matchMinute))
    : [];

  const initialData = {
    fixtures: fixtureRows,
    entries: entryRows as Entry[],
    divisions: divisionRows,
    tournaments: tournamentRows,
    players: playerRows,
    squadMembers: squadRows,
    events: eventRows,
    user: {
      email: user.email,
      displayName: user.displayName || user.fullName || "Official Referee",
    },
  };

  return <RefereeConsoleClient initialData={initialData} />;
}
