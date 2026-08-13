BEGIN;

CREATE INDEX IF NOT EXISTS activities_block_definition_idx
  ON revenue.activities (block_definition_id);
CREATE INDEX IF NOT EXISTS approvals_version_idx
  ON revenue.approvals (version_id);
CREATE INDEX IF NOT EXISTS baseline_results_version_idx
  ON revenue.baseline_results (version_id);
CREATE INDEX IF NOT EXISTS increment_ledger_activity_idx
  ON revenue.increment_ledger (activity_id);
CREATE INDEX IF NOT EXISTS interactions_version_idx
  ON revenue.interactions (version_id);
CREATE INDEX IF NOT EXISTS interactions_activity_a_idx
  ON revenue.interactions (activity_a_id);
CREATE INDEX IF NOT EXISTS interactions_activity_b_idx
  ON revenue.interactions (activity_b_id);
CREATE INDEX IF NOT EXISTS overrides_version_idx
  ON revenue.overrides (version_id);
CREATE INDEX IF NOT EXISTS validations_version_idx
  ON revenue.validations (version_id);

COMMIT;
