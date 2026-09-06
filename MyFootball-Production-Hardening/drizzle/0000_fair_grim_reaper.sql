CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`body` text NOT NULL,
	`audience` text DEFAULT 'all_participants' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `announcements_tournament_idx` ON `announcements` (`tournament_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text,
	`name` text NOT NULL,
	`organization_type` text DEFAULT 'club' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`contact_name` text NOT NULL,
	`contact_phone` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clubs_owner_idx` ON `clubs` (`owner_email`);--> statement-breakpoint
CREATE TABLE `divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`age_cutoff_date` text,
	`format` text DEFAULT 'group_knockout' NOT NULL,
	`max_squad_size` integer DEFAULT 18 NOT NULL,
	`max_teams` integer DEFAULT 16 NOT NULL,
	`fee_paise` integer DEFAULT 0 NOT NULL,
	`fee_basis` text DEFAULT 'per_team' NOT NULL,
	`require_players` integer DEFAULT false NOT NULL,
	`require_documents` integer DEFAULT false NOT NULL,
	`win_points` integer DEFAULT 3 NOT NULL,
	`draw_points` integer DEFAULT 1 NOT NULL,
	`loss_points` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `divisions_tournament_name_uq` ON `divisions` (`tournament_id`,`name`);--> statement-breakpoint
CREATE INDEX `divisions_tournament_idx` ON `divisions` (`tournament_id`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`division_id` text NOT NULL,
	`team_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`amount_paise` integer DEFAULT 0 NOT NULL,
	`seed` integer,
	`notes` text DEFAULT '' NOT NULL,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`approved_at` text,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_division_team_uq` ON `entries` (`division_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `entries_division_status_idx` ON `entries` (`division_id`,`status`);--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`division_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`round_name` text NOT NULL,
	`home_entry_id` text NOT NULL,
	`away_entry_id` text NOT NULL,
	`kickoff_at` text NOT NULL,
	`pitch` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`home_score` integer DEFAULT 0 NOT NULL,
	`away_score` integer DEFAULT 0 NOT NULL,
	`published_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`away_entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fixtures_division_kickoff_idx` ON `fixtures` (`division_id`,`kickoff_at`);--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`type` text NOT NULL,
	`player_name` text DEFAULT '' NOT NULL,
	`related_player_name` text DEFAULT '' NOT NULL,
	`match_minute` integer DEFAULT 0 NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_fixture_minute_idx` ON `match_events` (`fixture_id`,`match_minute`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_club_name_uq` ON `teams` (`club_id`,`name`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_email` text NOT NULL,
	`name` text NOT NULL,
	`organized_by` text NOT NULL,
	`city` text NOT NULL,
	`venue_name` text NOT NULL,
	`start_date` text NOT NULL,
	`duration_days` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'registration_open' NOT NULL,
	`contact_name` text NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`registration_closes_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organizer_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tournaments_organizer_idx` ON `tournaments` (`organizer_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
