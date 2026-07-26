ALTER TABLE `input_package_files` ADD `validation_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `input_package_files` ADD `summary_json` text DEFAULT '{}' NOT NULL;