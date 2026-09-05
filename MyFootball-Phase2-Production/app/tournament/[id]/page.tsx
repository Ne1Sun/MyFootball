import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "../../../db";
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
} from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { TournamentShowcaseClient } from "./tournament-showcase-client";
import { publicTournamentStatus } from "../../lib/tournament-status";
import { publicTournamentStatuses } from "../../lib/tournament-domain";

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), inArray(tournaments.status, [...publicTournamentStatuses])))
    .limit(1);

  if (!tournament) notFound();

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
          contactName: clubs.contactName,
          contactPhone: clubs.contactPhone,
          amountPaise: entries.amountPaise,
          notes: entries.notes,
          registeredAt: entries.registeredAt,
        })
        .from(entries)
        .innerJoin(teams, eq(entries.teamId, teams.id))
        .innerJoin(clubs, eq(teams.clubId, clubs.id))
        .where(and(inArray(entries.divisionId, divisionIds), eq(entries.status, "approved")))
    : [];

  // The public tournament view only needs display fields. Keep private club
  // contacts, payments and registration notes on the authenticated portals.
  const publicEntries = entryRows.map((entry) => ({
    ...entry,
    contactName: "",
    contactPhone: "",
    paymentStatus: "",
    amountPaise: 0,
    notes: "",
  }));

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
    : [];
  const squadRows = entryIds.length
    ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds))
    : [];

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

  const initialData = {
    tournament: {
      ...tournament,
      organizerEmail: undefined,
      status: publicTournamentStatus(tournament.status, tournament.registrationClosesAt),
    },
    divisions: divisionRows,
    entries: publicEntries,
    fixtures: fixtureRows,
    events: eventRows.map((event) => ({ ...event, recordedBy: "" })),
    players: playerRows,
    squadMembers: squadRows,
    announcements: announcementRows,
    isFollowed,
    user: signedIn,
  };

  return <TournamentShowcaseClient initialData={initialData} />;
}
