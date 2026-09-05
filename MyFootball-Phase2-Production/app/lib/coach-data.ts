import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../db";
import {
  announcements,
  clubs,
  clubStaffAssignments,
  divisions,
  entries,
  fixtures,
  matchEvents,
  players,
  squadMembers,
  teams,
  tournaments,
} from "../../db/schema";

export async function getCoachData(email: string, displayName: string) {
  const db = getDb();
  const staffAssignments = await db
    .select()
    .from(clubStaffAssignments)
    .where(
      and(
        eq(clubStaffAssignments.userEmail, email),
        eq(clubStaffAssignments.status, "active"),
      ),
    );
  const assignedClubIds = staffAssignments.map((assignment) => assignment.clubId);
  const clubRows = await db
    .select()
    .from(clubs)
    .where(
      assignedClubIds.length
        ? or(eq(clubs.ownerEmail, email), inArray(clubs.id, assignedClubIds))
        : eq(clubs.ownerEmail, email),
    )
    .orderBy(asc(clubs.name));
  const clubIds = clubRows.map((club) => club.id);
  const teamRows = clubIds.length
    ? await db.select().from(teams).where(inArray(teams.clubId, clubIds)).orderBy(asc(teams.name))
    : [];
  const teamIds = teamRows.map((team) => team.id);
  const playerRows = clubIds.length
    ? await db.select().from(players).where(inArray(players.clubId, clubIds)).orderBy(asc(players.jerseyNumber), asc(players.name))
    : [];
  const entryRows = teamIds.length
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
        .where(inArray(entries.teamId, teamIds))
    : [];
  const entryIds = entryRows.map((entry) => entry.id);
  const divisionIds = [...new Set(entryRows.map((entry) => entry.divisionId))];
  const divisionRows = divisionIds.length
    ? await db.select().from(divisions).where(inArray(divisions.id, divisionIds))
    : [];
  const tournamentIds = [...new Set(divisionRows.map((division) => division.tournamentId))];
  const tournamentRows = tournamentIds.length
    ? await db.select().from(tournaments).where(inArray(tournaments.id, tournamentIds)).orderBy(desc(tournaments.startDate))
    : [];
  const announcementRows = tournamentIds.length
    ? await db
        .select()
        .from(announcements)
        .where(
          and(
            inArray(announcements.tournamentId, tournamentIds),
            inArray(announcements.audience, ["all_participants", "coaches_only"]),
          ),
        )
        .orderBy(desc(announcements.createdAt))
    : [];
  const fixtureRows = entryIds.length
    ? await db
        .select()
        .from(fixtures)
        .where(or(inArray(fixtures.homeEntryId, entryIds), inArray(fixtures.awayEntryId, entryIds)))
        .orderBy(asc(fixtures.kickoffAt))
    : [];
  const fixtureIds = fixtureRows.map((fixture) => fixture.id);
  const eventRows = fixtureIds.length
    ? await db.select().from(matchEvents).where(inArray(matchEvents.fixtureId, fixtureIds)).orderBy(desc(matchEvents.matchMinute))
    : [];
  const squadRows = entryIds.length
    ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds))
    : [];

  return {
    clubs: clubRows,
    teams: teamRows,
    entries: entryRows,
    tournaments: tournamentRows,
    divisions: divisionRows,
    players: playerRows,
    squadMembers: squadRows,
    fixtures: fixtureRows,
    events: eventRows,
    announcements: announcementRows,
    clubStaffAssignments: staffAssignments,
    user: { email, displayName },
  };
}
