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
  users,
} from "../../db/schema";
import { requireChatGPTUser } from "../chatgpt-auth";
import { RoleGateCard } from "../components/auth/RoleGateCard";
import { CoachPortalClient } from "./coach-portal-client";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await requireChatGPTUser("/coach");
  const db = getDb();

  const [profile] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  const effectiveRole = profile?.role || user.role || "fan";

  // Strict RBAC Guard: Only coaches can access the coach tactical portal
  if (effectiveRole !== "coach") {
    return (
      <RoleGateCard
        requiredRole="coach"
        currentRole={effectiveRole}
        userEmail={user.email}
        userName={user.displayName || user.fullName || "Coach"}
      />
    );
  }

  // Load all clubs in database (for local demo, allow full interaction with RFYC, Minerva, etc.)
  const clubRows = await db.select().from(clubs).orderBy(asc(clubs.name));
  const teamRows = await db.select().from(teams).orderBy(asc(teams.name));
  const playerRows = await db.select().from(players).orderBy(asc(players.jerseyNumber), asc(players.name));
  const squadRows = await db.select().from(squadMembers);
  const entryRows = await db.select({
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

  const tournamentRows = await db.select().from(tournaments).orderBy(desc(tournaments.startDate));
  const divisionRows = await db.select().from(divisions);
  const fixtureRows = await db.select().from(fixtures).orderBy(asc(fixtures.kickoffAt));
  const eventRows = await db.select().from(matchEvents).orderBy(desc(matchEvents.matchMinute));

  const initialData = {
    clubs: clubRows,
    teams: teamRows,
    entries: entryRows,
    tournaments: tournamentRows,
    divisions: divisionRows,
    players: playerRows,
    squadMembers: squadRows,
    fixtures: fixtureRows,
    events: eventRows,
    user: {
      email: user.email,
      displayName: user.displayName || user.fullName || "Coach",
    },
  };

  return <CoachPortalClient initialData={initialData} />;
}
