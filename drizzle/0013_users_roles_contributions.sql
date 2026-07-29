CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `display_name` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_uq` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `organization_memberships` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `user_id` text NOT NULL,
  `business_function` text NOT NULL,
  `status` text NOT NULL,
  `granted_by` text NOT NULL,
  `granted_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_function_uq` ON `organization_memberships` (`organization_id`,`user_id`,`business_function`);
--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `organization_memberships` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `access_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `membership_id` text NOT NULL,
  `capability` text NOT NULL,
  `scope_type` text NOT NULL,
  `scope_id` text NOT NULL,
  `sensitivity_json` text DEFAULT '[]' NOT NULL,
  `valid_from` text NOT NULL,
  `valid_until` text,
  `granted_by` text NOT NULL,
  FOREIGN KEY (`membership_id`) REFERENCES `organization_memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_assignment_uq` ON `access_assignments` (`membership_id`,`capability`,`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE INDEX `access_scope_idx` ON `access_assignments` (`scope_type`,`scope_id`);
--> statement-breakpoint
CREATE TABLE `plan_contributions` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `version_id` text,
  `owner_user_id` text NOT NULL,
  `business_function` text NOT NULL,
  `lever` text NOT NULL,
  `title` text NOT NULL,
  `source_mode` text NOT NULL,
  `source_system` text,
  `source_file_id` text,
  `detail_level` text NOT NULL,
  `assumption_quality` text NOT NULL,
  `status` text NOT NULL,
  `period_start` text,
  `period_end` text,
  `product_scope_json` text DEFAULT '[]' NOT NULL,
  `account_scope_json` text DEFAULT '[]' NOT NULL,
  `gross_units` real,
  `investment_amount` real,
  `currency` text,
  `evidence_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `submitted_at` text,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contribution_plan_idx` ON `plan_contributions` (`plan_id`,`status`);
--> statement-breakpoint
CREATE INDEX `contribution_owner_idx` ON `plan_contributions` (`owner_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `contribution_lever_idx` ON `plan_contributions` (`plan_id`,`lever`);
