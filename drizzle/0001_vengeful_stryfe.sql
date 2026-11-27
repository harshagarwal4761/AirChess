CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`room_code` text,
	`white_user_id` text,
	`black_user_id` text,
	`white_name` text NOT NULL,
	`black_name` text NOT NULL,
	`time_control` text DEFAULT 'untimed' NOT NULL,
	`moves` text NOT NULL,
	`result_text` text NOT NULL,
	`winner` text,
	`white_rating_before` integer,
	`white_rating_after` integer,
	`black_rating_before` integer,
	`black_rating_after` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`rating` integer DEFAULT 1200 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `white_user_id` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `black_user_id` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `white_name` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `black_name` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `archived_game` integer DEFAULT 0 NOT NULL;