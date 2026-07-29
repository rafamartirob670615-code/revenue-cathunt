CREATE TABLE `canonical_datasets` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL,
  `requirement_id` text NOT NULL,
  `owner_id` text NOT NULL,
  `source_checksum` text NOT NULL,
  `source_object_key` text NOT NULL,
  `canonical_object_key` text NOT NULL,
  `selected_sheet` text,
  `header_row` integer,
  `mapping_json` text NOT NULL,
  `summary_json` text NOT NULL,
  `status` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_dataset_plan_requirement_uq`
ON `canonical_datasets` (`plan_id`, `requirement_id`);
--> statement-breakpoint
CREATE INDEX `canonical_dataset_plan_idx`
ON `canonical_datasets` (`plan_id`);
