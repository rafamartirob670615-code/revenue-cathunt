CREATE TABLE `financial_results` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`result_json` text NOT NULL,
	`data_classification` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
