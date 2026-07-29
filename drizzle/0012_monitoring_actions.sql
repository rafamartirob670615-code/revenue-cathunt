CREATE TABLE `monitoring_actions` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `owner_id` text NOT NULL,
  `version_number` integer NOT NULL,
  `period` text NOT NULL,
  `comparison` text NOT NULL,
  `plan_value` real NOT NULL,
  `actual_value` real NOT NULL,
  `variance_value` real NOT NULL,
  `variance_rate` real,
  `material` integer NOT NULL,
  `cause` text NOT NULL,
  `evidence` text NOT NULL,
  `action` text NOT NULL,
  `responsible` text NOT NULL,
  `due_date` text NOT NULL,
  `status` text NOT NULL,
  `outcome_note` text,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `closed_at` text
);
--> statement-breakpoint
CREATE INDEX `monitoring_action_plan_idx` ON `monitoring_actions` (`plan_id`,`status`);
--> statement-breakpoint
CREATE INDEX `monitoring_action_due_idx` ON `monitoring_actions` (`owner_id`,`due_date`);
