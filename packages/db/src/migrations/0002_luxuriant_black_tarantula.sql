CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`repo_full_name` text NOT NULL,
	`spec_path` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`output_mode` text DEFAULT 'append' NOT NULL,
	`output_repo_full_name` text,
	`webhook_id` integer,
	`webhook_secret` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniqueOrgRepo` ON `projects` (`org_id`,`repo_full_name`);