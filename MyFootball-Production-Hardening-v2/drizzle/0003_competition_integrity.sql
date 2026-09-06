CREATE TABLE `shootout_kicks` (
  `id` text PRIMARY KEY NOT NULL,
  `fixture_id` text NOT NULL REFERENCES `fixtures`(`id`) ON DELETE cascade,
  `entry_id` text NOT NULL REFERENCES `entries`(`id`) ON DELETE cascade,
  `player_id` text NOT NULL REFERENCES `players`(`id`) ON DELETE cascade,
  `sequence` integer NOT NULL,
  `scored` integer NOT NULL,
  `recorded_by` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shootout_kicks_fixture_sequence_uq` ON `shootout_kicks` (`fixture_id`, `sequence`);
--> statement-breakpoint
CREATE TABLE `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `tournament_id` text NOT NULL REFERENCES `tournaments`(`id`) ON DELETE cascade,
  `actor_email` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `detail` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_tournament_created_idx` ON `audit_log` (`tournament_id`, `created_at`);
