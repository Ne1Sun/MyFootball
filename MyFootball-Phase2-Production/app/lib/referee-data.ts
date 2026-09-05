import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../db";
import {
  clubs,
  divisions,
  entries,
  fixtureOfficials,
  fixtures,
  matchEvents,
  players,
  shootoutKicks,
  squadMembers,
  teams,
  tournaments,
} from "../../db/schema";
import type { Entry } from "../components/types";

export async function getRefereeData(email: string, displayName: string) {
  const db = getDb();
  const ownedTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.organizerEmail, email));
  const ownedTournamentIds = ownedTournaments.map((tournament) => tournament.id);
  const ownedDivisions = ownedTournamentIds.length
    ? await db.select().from(divisions).where(inArray(divisions.tournamentId, ownedTournamentIds))
    : [];
  const assignments = await db
    .select()
    .from(fixtureOfficials)
    .where(
      and(
        eq(fixtureOfficials.userEmail, email),
        eq(fixtureOfficials.status, "assigned"),
      ),
    );
  const assignedFixtureIds = assignments.map((assignment) => assignment.fixtureId);
  const ownedDivisionIds = ownedDivisions.map((division) => division.id);
  const fetchedFixtures = ownedDivisionIds.length || assignedFixtureIds.length
    ? await db
        .select()
        .from(fixtures)
        .where(
          or(
            ...(ownedDivisionIds.length ? [inArray(fixtures.divisionId, ownedDivisionIds)] : []),
            ...(assignedFixtureIds.length ? [inArray(fixtures.id, assignedFixtureIds)] : []),
          ),
        )
        .orderBy(asc(fixtures.kickoffAt))
    : [];
  const fixtureRows = fetchedFixtures.filter((fixture) => fixture.status !== "cancelled");
  const divisionIds = [...new Set(fixtureRows.map((fixture) => fixture.divisionId))];
  const divisionRows = divisionIds.length
    ? await db.select().from(divisions).where(inArray(divisions.id, divisionIds))
    : [];
  const tournamentIds = [...new Set(divisionRows.map((division) => division.tournamentId))];
  const tournamentRows = tournamentIds.length
    ? await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds))
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
    : [];
  const entryIds = entryRows.map((entry) => entry.id);
  const clubIds = [...new Set(entryRows.map((entry) => entry.clubId))];
  const fixtureIds = fixtureRows.map((fixture) => fixture.id);
  const playerRows = clubIds.length
    ? await db.select().from(players).where(inArray(players.clubId, clubIds))
    : [];
  const squadRows = entryIds.length
    ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds))
    : [];
  const eventRows = fixtureIds.length
    ? await db
        .select()
        .from(matchEvents)
        .where(inArray(matchEvents.fixtureId, fixtureIds))
        .orderBy(desc(matchEvents.matchMinute))
    : [];
  const shootoutRows = fixtureIds.length
    ? await db
        .select()
        .from(shootoutKicks)
        .where(inArray(shootoutKicks.fixtureId, fixtureIds))
        .orderBy(asc(shootoutKicks.sequence))
    : [];

  return {
    fixtures: fixtureRows,
    entries: entryRows as Entry[],
    divisions: divisionRows,
    tournaments: tournamentRows,
    players: playerRows,
    squadMembers: squadRows,
    events: eventRows,
    shootoutKicks: shootoutRows,
    fixtureOfficials: assignments,
    user: { email, displayName },
  };
}
