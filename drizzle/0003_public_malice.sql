CREATE TABLE `input_package_files` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`requirement_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`original_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum` text NOT NULL,
	`status` text NOT NULL,
	`missing_fields_json` text NOT NULL,
	`received_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `input_file_plan_requirement_uq` ON `input_package_files` (`plan_id`,`requirement_id`);--> statement-breakpoint
CREATE INDEX `input_file_plan_idx` ON `input_package_files` (`plan_id`);