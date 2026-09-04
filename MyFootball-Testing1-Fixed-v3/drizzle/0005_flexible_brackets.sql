ALTER TABLE `divisions` ADD `include_third_place` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `divisions` ADD `knockout_bye_entry_ids` text DEFAULT '[]' NOT NULL;
