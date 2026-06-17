ALTER TABLE `organizations` ADD `is_personal` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `owner_user_id` text REFERENCES user(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `organizations_ownerUserId_idx` ON `organizations` (`owner_user_id`);