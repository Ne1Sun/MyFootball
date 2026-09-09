import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("unselected"),
  preferredState: text("preferred_state").notNull().default(""),
  preferredCity: text("preferred_city").notNull().default(""),
  passwordHash: text("password_hash").notNull().default(""),
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
  teamFormat: text("team_format").notNull().default("11v11"),
  matchDurationMinutes: integer("match_duration_minutes").notNull().default(90),
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
  teamFormat: text("team_format").notNull().default("11v11"),
  format: text("format").notNull().default("group_knockout"),
  maxSquadSize: integer("max_squad_size").notNull().default(18),
  maxTeams: integer("max_teams").notNull().default(16),
  groupsCount: integer("groups_count").notNull().default(2),
  teamsAdvancingPerGroup: integer("teams_advancing_per_group").notNull().default(2),
  feePaise: integer("fee_paise").notNull().default(0),
  feeBasis: text("fee_basis").notNull().default("per_team"),
  requirePlayers: integer("require_players", { mode: "boolean" }).notNull().default(false),
  requireDocuments: integer("require_documents", { mode: "boolean" }).notNull().default(false),
  winPoints: integer("win_points").notNull().default(3),
  drawPoints: integer("draw_points").notNull().default(1),
  lossPoints: integer("loss_points").notNull().default(0),
  matchDurationMinutes: integer("match_duration_minutes").notNull().default(90),
  halfTimeBreakMinutes: integer("half_time_break_minutes").notNull().default(15),
  bufferMinutes: integer("buffer_minutes").notNull().default(10),
  minRestMinutes: integer("min_rest_minutes").notNull().default(0),
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

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  clubId: text("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth"),
  jerseyNumber: integer("jersey_number").notNull().default(0),
  position: text("position").notNull().default("MID"),
  isCaptain: integer("is_captain", { mode: "boolean" }).notNull().default(false),
  photoUrl: text("photo_url").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("players_club_idx").on(table.clubId),
]);

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
  groupName: text("group_name").notNull().default("Group A"),
  notes: text("notes").notNull().default(""),
  registeredAt: text("registered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
}, (table) => [
  uniqueIndex("entries_division_team_uq").on(table.divisionId, table.teamId),
  index("entries_division_status_idx").on(table.divisionId, table.status),
]);

export const squadMembers = sqliteTable("squad_members", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  isStarting: integer("is_starting", { mode: "boolean" }).notNull().default(false),
  jerseyNumberOverride: integer("jersey_number_override"),
  positionOverride: text("position_override"),
  registeredAt: text("registered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("squad_members_entry_player_uq").on(table.entryId, table.playerId),
  index("squad_members_entry_idx").on(table.entryId),
]);

export const fixtures = sqliteTable("fixtures", {
  id: text("id").primaryKey(),
  divisionId: text("division_id").notNull().references(() => divisions.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  roundName: text("round_name").notNull(),
  stage: text("stage").notNull().default("group"),
  bracketRound: text("bracket_round"),
  bracketMatchIndex: integer("bracket_match_index"),
  homeEntryId: text("home_entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  awayEntryId: text("away_entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  kickoffAt: text("kickoff_at").notNull(),
  pitch: integer("pitch").notNull().default(1),
  status: text("status").notNull().default("scheduled"),
  period: text("period").notNull().default("scheduled"),
  matchClockMinute: integer("match_clock_minute").notNull().default(0),
  clockStartedAt: text("clock_started_at"),
  clockRunning: integer("clock_running", { mode: "boolean" }).notNull().default(false),
  clockElapsedSeconds: integer("clock_elapsed_seconds").notNull().default(0),
  stoppageMinutes: integer("stoppage_minutes").notNull().default(0),
  clockPauseReason: text("clock_pause_reason"),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  homeScorePenalties: integer("home_score_penalties").notNull().default(0),
  awayScorePenalties: integer("away_score_penalties").notNull().default(0),
  potmPlayerId: text("potm_player_id"),
  potmPlayerName: text("potm_player_name").notNull().default(""),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("fixtures_division_kickoff_idx").on(table.divisionId, table.kickoffAt)]);

export const matchEvents = sqliteTable("match_events", {
  id: text("id").primaryKey(),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  playerName: text("player_name").notNull().default(""),
  playerId: text("player_id"),
  assistPlayerName: text("assist_player_name").notNull().default(""),
  assistPlayerId: text("assist_player_id"),
  relatedPlayerName: text("related_player_name").notNull().default(""),
  matchMinute: integer("match_minute").notNull().default(0),
  matchPeriod: text("match_period").notNull().default("first_half"),
  cardReason: text("card_reason").notNull().default(""),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("events_fixture_minute_idx").on(table.fixtureId, table.matchMinute)]);

/** Individual kick records keep shootouts authoritative across devices. */
export const shootoutKicks = sqliteTable("shootout_kicks", {
  id: text("id").primaryKey(),
  fixtureId: text("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  entryId: text("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  scored: integer("scored", { mode: "boolean" }).notNull(),
  recordedBy: text("recorded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("shootout_kicks_fixture_sequence_uq").on(table.fixtureId, table.sequence)]);

/** Append-only operational history for sensitive competition decisions. */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("audit_log_tournament_created_idx").on(table.tournamentId, table.createdAt)]);

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
