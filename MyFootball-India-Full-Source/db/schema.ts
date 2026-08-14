import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("unselected"),
  preferredState: text("preferred_state").notNull().default(""),
  preferredCity: text("preferred_city").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(),
  organizerEmail: text("organizer_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  name: text("name").notNull(),
  organizedBy: text("organized_by").notNull(),
  city: text("city").notNull(),
  venueName: text("venue_name").notNull(),
  addressLine1: text("address_line_1").notNull().default(""),
  locality: text("locality").notNull().default(""),
  state: text("state").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  latitude: text("latitude").notNull().default(""),
  longitude: text("longitude").notNull().default(""),
  startDate: text("start_date").notNull(),
  durationDays: integer("duration_days").notNull().default(2),
  status: text("status").notNull().default("registration_open"),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull().default(""),
  registrationClosesAt: text("registration_closes_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("tournaments_organizer_idx").on(table.organizerEmail, table.createdAt)]);

export const divisions = sqliteTable("divisions", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ageCutoffDate: text("age_cutoff_date"),
  format: text("format").notNull().default("group_knockout"),
  maxSquadSize: integer("max_squad_size").notNull().default(18),
  maxTeams: integer("max_teams").notNull().default(16),
  feePaise: integer("fee_paise").notNull().default(0),
  feeBasis: text("fee_basis").notNull().default("per_team"),
  requirePlayers: integer("require_players", { mode: "boolean" }).notNull().default(false),
  requireDocuments: integer("require_documents", { mode: "boolean" }).notNull().default(false),
  winPoints: integer("win_points").notNull().default(3),
  drawPoints: integer("draw_points").notNull().default(1),
  lossPoints: integer("loss_points").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("divisions_tournament_name_uq").on(table.tournamentId, table.name),
  index("divisions_tournament_idx").on(table.tournamentId),
]);

export const clubs = sqliteTable("clubs", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email"),
  name: text("name").notNull(),
  organizationType: text("organization_type").notNull().default("club"),
  city: text("city").notNull().default(""),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("clubs_owner_idx").on(table.ownerEmail)]);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  clubId: text("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("teams_club_name_uq").on(table.clubId, table.name)]);

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(),
  divisionId: text("division_id").notNull().references(() => divisions.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  amountPaise: integer("amount_paise").notNull().default(0),
  seed: integer("seed"),
  notes: text("notes").notNull().default(""),
  registeredAt: text("registered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
}, (table) => [
  uniqueIndex("entries_division_team_uq").on(table.divisionId, table.teamId),
  index("entries_division_status_idx").on(table.divisionId, table.status),
]);

export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(),
  divisionId: text("division_id").notNull().references(() => divisions.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  roundName: text("round_name").notNull(),
  homeEntryId: text("home_entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  awayEntryId: text("away_entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  kickoffAt: text("kickoff_at").notNull(),
  pitch: integer("pitch").notNull().default(1),
  status: text("status").notNull().default("scheduled"),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("fixtures_division_kickoff_idx").on(table.divisionId, table.kickoffAt)]);

export const matchEvents = sqliteTable("match_events", {
  id: text("id").primaryKey(),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  playerName: text("player_name").notNull().default(""),
  relatedPlayerName: text("related_player_name").notNull().default(""),
  matchMinute: integer("match_minute").notNull().default(0),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("events_fixture_minute_idx").on(table.fixtureId, table.matchMinute)]);

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  senderEmail: text("sender_email").notNull(),
  body: text("body").notNull(),
  audience: text("audience").notNull().default("all_participants"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("announcements_tournament_idx").on(table.tournamentId, table.createdAt)]);

export const follows = sqliteTable("follows", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("follows_user_tournament_uq").on(table.userEmail, table.tournamentId),
  index("follows_user_idx").on(table.userEmail, table.createdAt),
]);
