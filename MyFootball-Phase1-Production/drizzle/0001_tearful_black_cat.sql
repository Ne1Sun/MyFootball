CREATE TABLE `follows` (
	`user_email` text NOT NULL,
	`tournament_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_user_tournament_uq` ON `follows` (`user_email`,`tournament_id`);--> statement-breakpoint
CREATE INDEX `follows_user_idx` ON `follows` (`user_email`,`created_at`);--> statement-breakpoint
ALTER TABLE `tournaments` ADD `address_line_1` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `locality` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `state` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `postal_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `latitude` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `longitude` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'unselected' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_state` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_city` text DEFAULT '' NOT NULL;