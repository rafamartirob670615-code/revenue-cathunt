BEGIN;

CREATE SCHEMA IF NOT EXISTS revenue;
SET LOCAL search_path TO revenue, public;

CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"source_system" text NOT NULL,
	"source_activity_id" text NOT NULL,
	"source_version" text NOT NULL,
	"block_definition_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"parent_activity_id" text,
	"includes_children" integer,
	"baseline_inclusion_key" text,
	"owner_id" text NOT NULL,
	"evidence_json" text NOT NULL
);
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"stage" text NOT NULL,
	"decision" text NOT NULL,
	"actor_id" text NOT NULL,
	"decided_at" text NOT NULL,
	"comment" text
);
CREATE TABLE "baseline_results" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"account_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"month" text NOT NULL,
	"state" text NOT NULL,
	"method_id" text NOT NULL,
	"method_version" text NOT NULL,
	"calculated_units" double precision NOT NULL,
	"adjusted_units" double precision,
	"approved_units" double precision,
	"confidence" double precision,
	"evidence_json" text NOT NULL
);
CREATE TABLE "building_block_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"economic_treatment" text NOT NULL,
	"owner_function" text NOT NULL,
	"requires_evidence" integer NOT NULL,
	"requires_approval" integer NOT NULL,
	"active" integer NOT NULL,
	"version" integer NOT NULL
);
CREATE TABLE "increment_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"account_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"month" text NOT NULL,
	"channel_id" text,
	"geography_id" text,
	"gross_units" double precision NOT NULL,
	"cannibalization_units" double precision NOT NULL,
	"halo_units" double precision NOT NULL,
	"pull_forward_units" double precision NOT NULL,
	"other_interaction_units" double precision NOT NULL,
	"net_units" double precision NOT NULL
);
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"activity_a_id" text NOT NULL,
	"activity_b_id" text NOT NULL,
	"account_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"month" text NOT NULL,
	"net_units" double precision NOT NULL,
	"method_id" text NOT NULL,
	"evidence_json" text NOT NULL,
	"approved_by" text
);
CREATE TABLE "overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"kind" text NOT NULL,
	"prior_units" double precision NOT NULL,
	"proposed_units" double precision NOT NULL,
	"reason_code" text NOT NULL,
	"comment" text NOT NULL,
	"evidence_json" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"approved_by" text,
	"approved_at" text
);
CREATE TABLE "plan_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"account_id" text NOT NULL,
	"sku_id" text NOT NULL,
	"month" text NOT NULL,
	"baseline_calculation_id" text NOT NULL,
	"approved_baseline_units" double precision NOT NULL,
	"authorized_adjustment_units" double precision DEFAULT 0 NOT NULL,
	"plan_units" double precision
);
CREATE TABLE "plan_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"parent_version_id" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"frozen_at" text
);
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"company_id" text NOT NULL,
	"account_id" text NOT NULL,
	"year" integer NOT NULL,
	"currency" text NOT NULL,
	"official_version_id" text
);
CREATE TABLE "validations" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"code" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"message" text NOT NULL,
	"line_key_json" text
);
CREATE TABLE "command_receipts" (
	"command_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"command_type" text NOT NULL,
	"result_json" text NOT NULL,
	"created_at" text NOT NULL
);
CREATE TABLE "plan_aggregates" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"aggregate_json" text NOT NULL,
	"updated_at" text NOT NULL
);
CREATE TABLE "version_snapshots" (
	"version_id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"snapshot_json" text NOT NULL,
	"sha256" text NOT NULL,
	"created_at" text NOT NULL
);
CREATE TABLE "input_package_files" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"requirement_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"original_name" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" text NOT NULL,
	"status" text NOT NULL,
	"missing_fields_json" text NOT NULL,
	"received_at" text NOT NULL
, "validation_json" text DEFAULT '[]' NOT NULL, "summary_json" text DEFAULT '{}' NOT NULL);
CREATE TABLE "input_package_reviews" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"status" text NOT NULL,
	"file_checksums_json" text NOT NULL,
	"accepted_at" text NOT NULL
);
CREATE TABLE "baseline_calculations" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"result_json" text NOT NULL,
	"data_classification" text NOT NULL,
	"input_checksums_json" text NOT NULL,
	"calculated_at" text NOT NULL
);
CREATE TABLE "baseline_reviews" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"calculation_calculated_at" text NOT NULL,
	"status" text NOT NULL,
	"decision" text NOT NULL,
	"review_json" text NOT NULL,
	"decided_by" text NOT NULL,
	"decided_at" text NOT NULL,
	"frozen_at" text
);
CREATE TABLE "growth_plans" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"result_json" text NOT NULL,
	"data_classification" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
CREATE TABLE "plan_results" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"result_json" text NOT NULL,
	"data_classification" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
CREATE TABLE "financial_results" (
	"plan_id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"result_json" text NOT NULL,
	"data_classification" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
CREATE TABLE "canonical_datasets" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL,
  "requirement_id" text NOT NULL,
  "owner_id" text NOT NULL,
  "source_checksum" text NOT NULL,
  "source_object_key" text NOT NULL,
  "canonical_object_key" text NOT NULL,
  "selected_sheet" text,
  "header_row" integer,
  "mapping_json" text NOT NULL,
  "summary_json" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL
);
CREATE TABLE "monitoring_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL,
  "owner_id" text NOT NULL,
  "version_number" integer NOT NULL,
  "period" text NOT NULL,
  "comparison" text NOT NULL,
  "plan_value" double precision NOT NULL,
  "actual_value" double precision NOT NULL,
  "variance_value" double precision NOT NULL,
  "variance_rate" double precision,
  "material" integer NOT NULL,
  "cause" text NOT NULL,
  "evidence" text NOT NULL,
  "action" text NOT NULL,
  "responsible" text NOT NULL,
  "due_date" text NOT NULL,
  "status" text NOT NULL,
  "outcome_note" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "closed_at" text
);
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);
INSERT INTO "users" ("id","email","display_name","status","created_at","updated_at") VALUES('user:pilot@revenue.local','pilot@revenue.local','Usuario piloto','ACTIVE','2026-08-08T18:39:02.783Z','2026-08-13T18:01:47.777Z');
CREATE TABLE "organization_memberships" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "business_function" text NOT NULL,
  "status" text NOT NULL,
  "granted_by" text NOT NULL,
  "granted_at" text NOT NULL
);
CREATE TABLE "access_assignments" (
  "id" text PRIMARY KEY NOT NULL,
  "membership_id" text NOT NULL,
  "capability" text NOT NULL,
  "scope_type" text NOT NULL,
  "scope_id" text NOT NULL,
  "sensitivity_json" text DEFAULT '[]' NOT NULL,
  "valid_from" text NOT NULL,
  "valid_until" text,
  "granted_by" text NOT NULL
);
CREATE TABLE "plan_contributions" (
  "id" text PRIMARY KEY NOT NULL,
  "plan_id" text NOT NULL,
  "version_id" text,
  "owner_user_id" text NOT NULL,
  "business_function" text NOT NULL,
  "lever" text NOT NULL,
  "title" text NOT NULL,
  "source_mode" text NOT NULL,
  "source_system" text,
  "source_file_id" text,
  "detail_level" text NOT NULL,
  "assumption_quality" text NOT NULL,
  "status" text NOT NULL,
  "period_start" text,
  "period_end" text,
  "product_scope_json" text DEFAULT '[]' NOT NULL,
  "account_scope_json" text DEFAULT '[]' NOT NULL,
  "gross_units" double precision,
  "investment_amount" double precision,
  "currency" text,
  "evidence_json" text DEFAULT '{}' NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "submitted_at" text
);
CREATE UNIQUE INDEX "activity_economic_identity_uq" ON "activities" ("source_system","source_activity_id","source_version");
CREATE UNIQUE INDEX "building_block_code_version_uq" ON "building_block_definitions" ("code","version");
CREATE INDEX "ledger_grain_idx" ON "increment_ledger" ("version_id","account_id","sku_id","month");
CREATE UNIQUE INDEX "plan_line_grain_uq" ON "plan_lines" ("version_id","account_id","sku_id","month");
CREATE UNIQUE INDEX "plan_version_number_uq" ON "plan_versions" ("plan_id","number");
CREATE INDEX "plan_version_status_idx" ON "plan_versions" ("plan_id","status");
CREATE UNIQUE INDEX "plan_identity_uq" ON "plans" ("organization_id","account_id","year");
CREATE UNIQUE INDEX "ledger_allocation_uq" ON "increment_ledger" ("version_id","activity_id","account_id","sku_id","month","channel_id","geography_id");
CREATE INDEX "version_snapshot_plan_idx" ON "version_snapshots" ("plan_id");
CREATE UNIQUE INDEX "input_file_plan_requirement_uq" ON "input_package_files" ("plan_id","requirement_id");
CREATE INDEX "input_file_plan_idx" ON "input_package_files" ("plan_id");
CREATE UNIQUE INDEX "canonical_dataset_plan_requirement_uq"
ON "canonical_datasets" ("plan_id", "requirement_id");
CREATE INDEX "canonical_dataset_plan_idx"
ON "canonical_datasets" ("plan_id");
CREATE INDEX "monitoring_action_plan_idx" ON "monitoring_actions" ("plan_id","status");
CREATE INDEX "monitoring_action_due_idx" ON "monitoring_actions" ("owner_id","due_date");
CREATE UNIQUE INDEX "user_email_uq" ON "users" ("email");
CREATE UNIQUE INDEX "membership_function_uq" ON "organization_memberships" ("organization_id","user_id","business_function");
CREATE INDEX "membership_user_idx" ON "organization_memberships" ("user_id","status");
CREATE UNIQUE INDEX "access_assignment_uq" ON "access_assignments" ("membership_id","capability","scope_type","scope_id");
CREATE INDEX "access_scope_idx" ON "access_assignments" ("scope_type","scope_id");
CREATE INDEX "contribution_plan_idx" ON "plan_contributions" ("plan_id","status");
CREATE INDEX "contribution_owner_idx" ON "plan_contributions" ("owner_user_id","status");
CREATE INDEX "contribution_lever_idx" ON "plan_contributions" ("plan_id","lever");

ALTER TABLE activities
  ADD CONSTRAINT activities_block_definition_fk
  FOREIGN KEY (block_definition_id) REFERENCES building_block_definitions(id);
ALTER TABLE plan_versions
  ADD CONSTRAINT plan_versions_plan_fk FOREIGN KEY (plan_id) REFERENCES plans(id);
ALTER TABLE plan_lines
  ADD CONSTRAINT plan_lines_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id);
ALTER TABLE baseline_results
  ADD CONSTRAINT baseline_results_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id);
ALTER TABLE approvals
  ADD CONSTRAINT approvals_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id);
ALTER TABLE overrides
  ADD CONSTRAINT overrides_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id);
ALTER TABLE validations
  ADD CONSTRAINT validations_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id);
ALTER TABLE increment_ledger
  ADD CONSTRAINT increment_ledger_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id),
  ADD CONSTRAINT increment_ledger_activity_fk FOREIGN KEY (activity_id) REFERENCES activities(id);
ALTER TABLE interactions
  ADD CONSTRAINT interactions_version_fk FOREIGN KEY (version_id) REFERENCES plan_versions(id),
  ADD CONSTRAINT interactions_activity_a_fk FOREIGN KEY (activity_a_id) REFERENCES activities(id),
  ADD CONSTRAINT interactions_activity_b_fk FOREIGN KEY (activity_b_id) REFERENCES activities(id);
ALTER TABLE organization_memberships
  ADD CONSTRAINT organization_memberships_user_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE access_assignments
  ADD CONSTRAINT access_assignments_membership_fk FOREIGN KEY (membership_id) REFERENCES organization_memberships(id);
ALTER TABLE plan_contributions
  ADD CONSTRAINT plan_contributions_owner_fk FOREIGN KEY (owner_user_id) REFERENCES users(id);

DO $$
DECLARE
  revenue_table record;
BEGIN
  FOR revenue_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'revenue'
  LOOP
    EXECUTE format('ALTER TABLE revenue.%I ENABLE ROW LEVEL SECURITY', revenue_table.tablename);
  END LOOP;
END
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('revenue-files', 'revenue-files', false, 20000000)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

COMMIT;
