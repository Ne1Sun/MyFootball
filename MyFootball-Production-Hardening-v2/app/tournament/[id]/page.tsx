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

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const db = getDb();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, id))
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

  const entryIds = entryRows.map((e) => e.id);
  const clubIds = Array.from(new Set(entryRows.map((e) => e.clubId).filter(Boolean))) as string[];

  const squadRows = entryIds.length
    ? await db.select().from(squadMembers).where(inArray(squadMembers.entryId, entryIds))
    : [];

  const playerRows = clubIds.length
    ? await db.select().from(players).where(inArray(players.clubId, clubIds))
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
    tournament,
    divisions: divisionRows,
    entries: entryRows,
    fixtures: fixtureRows,
    events: eventRows,
    players: playerRows,
    squadMembers: squadRows,
    announcements: announcementRows,
    isFollowed,
    user: signedIn,
  };

  return <TournamentShowcaseClient initialData={initialData as any} />;
}
