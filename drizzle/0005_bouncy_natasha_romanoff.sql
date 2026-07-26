CREATE TABLE `input_package_reviews` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`contract_version` text NOT NULL,
	`status` text NOT NULL,
	`file_checksums_json` text NOT NULL,
	`accepted_at` text NOT NULL
);
