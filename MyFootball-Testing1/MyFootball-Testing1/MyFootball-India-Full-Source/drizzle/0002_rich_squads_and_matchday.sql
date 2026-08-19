CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`club_id` text NOT NULL,
	`name` text NOT NULL,
	`date_of_birth` text,
	`jersey_number` integer DEFAULT 0 NOT NULL,
	`position` text DEFAULT 'MID' NOT NULL,
	`is_captain` integer DEFAULT false NOT NULL,
	`photo_url` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `players_club_idx` ON `players` (`club_id`);
--> statement-breakpoint
CREATE TABLE `squad_members` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`player_id` text NOT NULL,
	`is_starting` integer DEFAULT false NOT NULL,
	`jersey_number_override` integer,
	`position_override` text,
	`registered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `squad_members_entry_player_uq` ON `squad_members` (`entry_id`,`player_id`);
--> statement-breakpoint
CREATE INDEX `squad_members_entry_idx` ON `squad_members` (`entry_id`);
--> statement-breakpoint
ALTER TABLE `divisions` ADD `groups_count` integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE `divisions` ADD `teams_advancing_per_group` integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE `entries` ADD `group_name` text DEFAULT 'Group A' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `stage` text DEFAULT 'group' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `bracket_round` text;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `bracket_match_index` integer;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `period` text DEFAULT 'scheduled' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `match_clock_minute` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `home_score_penalties` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `away_score_penalties` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `potm_player_id` text;
--> statement-breakpoint
ALTER TABLE `fixtures` ADD `potm_player_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `match_events` ADD `player_id` text;
--> statement-breakpoint
ALTER TABLE `match_events` ADD `assist_player_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `match_events` ADD `assist_player_id` text;
--> statement-breakpoint
ALTER TABLE `match_events` ADD `match_period` text DEFAULT 'first_half' NOT NULL;
--> statement-breakpoint
ALTER TABLE `match_events` ADD `card_reason` text DEFAULT '' NOT NULL;
