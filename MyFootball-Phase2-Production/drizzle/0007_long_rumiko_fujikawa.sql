CREATE TABLE `schedule_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`division_id` text NOT NULL,
	`first_kickoff_time` text DEFAULT '09:00' NOT NULL,
	`day_end_time` text DEFAULT '20:00' NOT NULL,
	`match_duration_minutes` integer DEFAULT 90 NOT NULL,
	`buffer_minutes` integer DEFAULT 15 NOT NULL,
	`minimum_rest_minutes` integer DEFAULT 60 NOT NULL,
	`pitch_count` integer DEFAULT 2 NOT NULL,
	`long_break_after_matches` integer DEFAULT 0 NOT NULL,
	`long_break_minutes` integer DEFAULT 0 NOT NULL,
	`league_legs` integer DEFAULT 1 NOT NULL,
	`knockout_weekend_only` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_policies_division_uq` ON `schedule_policies` (`division_id`);
--> statement-breakpoint
PRAGMA optimize;
