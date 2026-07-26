CREATE TABLE `baseline_reviews` (
	`plan_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`calculation_calculated_at` text NOT NULL,
	`status` text NOT NULL,
	`decision` text NOT NULL,
	`review_json` text NOT NULL,
	`decided_by` text NOT NULL,
	`decided_at` text NOT NULL,
	`frozen_at` text
);
