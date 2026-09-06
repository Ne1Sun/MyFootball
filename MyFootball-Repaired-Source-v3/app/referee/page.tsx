import { asc, desc, eq } from "drizzle-orm";
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

  const fixtureRows = await db.select().from(fixtures).orderBy(asc(fixtures.kickoffAt));
  const entryRows = await db
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
    .innerJoin(clubs, eq(teams.clubId, clubs.id));

  const divisionRows = await db.select().from(divisions);
  const tournamentRows = await db.select().from(tournaments);
  const playerRows = await db.select().from(players);
  const squadRows = await db.select().from(squadMembers);
  const eventRows = await db.select().from(matchEvents).orderBy(desc(matchEvents.matchMinute));

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
