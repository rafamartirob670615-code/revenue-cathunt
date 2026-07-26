CREATE TABLE `baseline_calculations` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`result_json` text NOT NULL,
	`data_classification` text NOT NULL,
	`input_checksums_json` text NOT NULL,
	`calculated_at` text NOT NULL
);
