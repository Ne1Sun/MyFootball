CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_email` text NOT NULL,
	`before_json` text DEFAULT '{}' NOT NULL,
	`after_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_tournament_created_idx` ON `audit_logs` (`tournament_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `club_staff_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'coach' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`assigned_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `club_staff_club_user_role_uq` ON `club_staff_assignments` (`club_id`,`user_email`,`role`);
--> statement-breakpoint
CREATE INDEX `club_staff_user_status_idx` ON `club_staff_assignments` (`user_email`,`status`);
--> statement-breakpoint
CREATE TABLE `fixture_officials` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_id` text NOT NULL,
	`user_email` text NOT NULL,
	`role` text DEFAULT 'referee' NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`assigned_by_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fixture_official_fixture_role_uq` ON `fixture_officials` (`fixture_id`,`role`);
--> statement-breakpoint
CREATE INDEX `fixture_official_user_status_idx` ON `fixture_officials` (`user_email`,`status`);
--> statement-breakpoint
CREATE TABLE `shootout_kicks` (
	`id` text PRIMARY KEY NOT NULL,
	`fixture_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`entry_id` text NOT NULL,
	`player_id` text,
	`player_name` text DEFAULT '' NOT NULL,
	`outcome` text NOT NULL,
	`recorded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shootout_fixture_sequence_uq` ON `shootout_kicks` (`fixture_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `shootout_fixture_idx` ON `shootout_kicks` (`fixture_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `clock_started_at` text;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `clock_running` integer DEFAULT false NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
