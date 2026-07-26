CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`source_system` text NOT NULL,
	`source_activity_id` text NOT NULL,
	`source_version` text NOT NULL,
	`block_definition_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`parent_activity_id` text,
	`includes_children` integer,
	`baseline_inclusion_key` text,
	`owner_id` text NOT NULL,
	`evidence_json` text NOT NULL,
	FOREIGN KEY (`block_definition_id`) REFERENCES `building_block_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_economic_identity_uq` ON `activities` (`source_system`,`source_activity_id`,`source_version`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`stage` text NOT NULL,
	`decision` text NOT NULL,
	`actor_id` text NOT NULL,
	`decided_at` text NOT NULL,
	`comment` text,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `baseline_results` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sku_id` text NOT NULL,
	`month` text NOT NULL,
	`state` text NOT NULL,
	`method_id` text NOT NULL,
	`method_version` text NOT NULL,
	`calculated_units` real NOT NULL,
	`adjusted_units` real,
	`approved_units` real,
	`confidence` real,
	`evidence_json` text NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `building_block_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`family` text NOT NULL,
	`economic_treatment` text NOT NULL,
	`owner_function` text NOT NULL,
	`requires_evidence` integer NOT NULL,
	`requires_approval` integer NOT NULL,
	`active` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `building_block_code_version_uq` ON `building_block_definitions` (`code`,`version`);--> statement-breakpoint
CREATE TABLE `increment_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sku_id` text NOT NULL,
	`month` text NOT NULL,
	`channel_id` text,
	`geography_id` text,
	`gross_units` real NOT NULL,
	`cannibalization_units` real NOT NULL,
	`halo_units` real NOT NULL,
	`pull_forward_units` real NOT NULL,
	`other_interaction_units` real NOT NULL,
	`net_units` real NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_allocation_uq` ON `increment_ledger` (`version_id`,`activity_id`,`id`);--> statement-breakpoint
CREATE INDEX `ledger_grain_idx` ON `increment_ledger` (`version_id`,`account_id`,`sku_id`,`month`);--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`activity_a_id` text NOT NULL,
	`activity_b_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sku_id` text NOT NULL,
	`month` text NOT NULL,
	`net_units` real NOT NULL,
	`method_id` text NOT NULL,
	`evidence_json` text NOT NULL,
	`approved_by` text,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_a_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_b_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`kind` text NOT NULL,
	`prior_units` real NOT NULL,
	`proposed_units` real NOT NULL,
	`reason_code` text NOT NULL,
	`comment` text NOT NULL,
	`evidence_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`account_id` text NOT NULL,
	`sku_id` text NOT NULL,
	`month` text NOT NULL,
	`baseline_calculation_id` text NOT NULL,
	`approved_baseline_units` real NOT NULL,
	`authorized_adjustment_units` real DEFAULT 0 NOT NULL,
	`plan_units` real,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_line_grain_uq` ON `plan_lines` (`version_id`,`account_id`,`sku_id`,`month`);--> statement-breakpoint
CREATE TABLE `plan_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`number` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`parent_version_id` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`frozen_at` text,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_version_number_uq` ON `plan_versions` (`plan_id`,`number`);--> statement-breakpoint
CREATE INDEX `plan_version_status_idx` ON `plan_versions` (`plan_id`,`status`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`company_id` text NOT NULL,
	`account_id` text NOT NULL,
	`year` integer NOT NULL,
	`currency` text NOT NULL,
	`official_version_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_identity_uq` ON `plans` (`organization_id`,`account_id`,`year`);--> statement-breakpoint
CREATE TABLE `validations` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`line_key_json` text,
	FOREIGN KEY (`version_id`) REFERENCES `plan_versions`(`id`) ON UPDATE no action ON DELETE no action
);
