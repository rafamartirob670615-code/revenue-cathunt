UPDATE `plan_versions`
SET `status` = 'COMMERCIAL_APPROVED'
WHERE `status` = 'FINANCE_VALIDATED';
--> statement-breakpoint
DELETE FROM `approvals`
WHERE `stage` = 'FINANCE';
