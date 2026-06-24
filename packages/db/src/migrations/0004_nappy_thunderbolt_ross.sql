PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_generation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`config_id` text NOT NULL,
	`triggered_by` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`commit_sha` text,
	`spec_snapshot` text,
	`sdk_version` text,
	`branch_name` text,
	`pr_url` text,
	`logs` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`config_id`) REFERENCES `project_configs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_generation_runs`("id", "project_id", "config_id", "triggered_by", "status", "commit_sha", "spec_snapshot", "sdk_version", "branch_name", "pr_url", "logs", "created_at", "finished_at") SELECT "id", "project_id", "config_id", "triggered_by", "status", "commit_sha", "spec_snapshot", "sdk_version", "branch_name", "pr_url", "logs", "created_at", "finished_at" FROM `generation_runs`;--> statement-breakpoint
DROP TABLE `generation_runs`;--> statement-breakpoint
ALTER TABLE `__new_generation_runs` RENAME TO `generation_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `generation_runs_project_id_idx` ON `generation_runs` (`project_id`);--> statement-breakpoint
CREATE INDEX `generation_runs_config_id_idx` ON `generation_runs` (`config_id`);--> statement-breakpoint
CREATE TABLE `__new_sdk_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version` text NOT NULL,
	`run_id` text NOT NULL,
	`change_type` text NOT NULL,
	`changelog` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `generation_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sdk_versions`("id", "project_id", "version", "run_id", "change_type", "changelog", "created_at") SELECT "id", "project_id", "version", "run_id", "change_type", "changelog", "created_at" FROM `sdk_versions`;--> statement-breakpoint
DROP TABLE `sdk_versions`;--> statement-breakpoint
ALTER TABLE `__new_sdk_versions` RENAME TO `sdk_versions`;--> statement-breakpoint
CREATE INDEX `sdk_versions_project_id_idx` ON `sdk_versions` (`project_id`);--> statement-breakpoint
CREATE INDEX `sdk_versions_run_id_idx` ON `sdk_versions` (`run_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_project_version` ON `sdk_versions` (`project_id`,`version`);--> statement-breakpoint
CREATE INDEX `project_configs_project_id_idx` ON `project_configs` (`project_id`);