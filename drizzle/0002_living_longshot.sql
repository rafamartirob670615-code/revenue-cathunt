CREATE TABLE `command_receipts` (
	`command_id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`command_type` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_aggregates` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`aggregate_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `version_snapshots` (
	`version_id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `version_snapshot_plan_idx` ON `version_snapshots` (`plan_id`);