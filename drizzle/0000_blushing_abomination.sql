CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`white` text NOT NULL,
	`black` text,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
