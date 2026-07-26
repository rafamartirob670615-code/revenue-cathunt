import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    companyId: text("company_id").notNull(),
    accountId: text("account_id").notNull(),
    year: integer("year").notNull(),
    currency: text("currency").notNull(),
    officialVersionId: text("official_version_id"),
  },
  (table) => [
    uniqueIndex("plan_identity_uq").on(
      table.organizationId,
      table.accountId,
      table.year,
    ),
  ],
);

export const planVersions = sqliteTable(
  "plan_versions",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().references(() => plans.id),
    number: integer("number").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    parentVersionId: text("parent_version_id"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    frozenAt: text("frozen_at"),
  },
  (table) => [
    uniqueIndex("plan_version_number_uq").on(table.planId, table.number),
    index("plan_version_status_idx").on(table.planId, table.status),
  ],
);

export const planLines = sqliteTable(
  "plan_lines",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull().references(() => planVersions.id),
    accountId: text("account_id").notNull(),
    skuId: text("sku_id").notNull(),
    month: text("month").notNull(),
    baselineCalculationId: text("baseline_calculation_id").notNull(),
    approvedBaselineUnits: real("approved_baseline_units").notNull(),
    authorizedAdjustmentUnits: real("authorized_adjustment_units").notNull().default(0),
    planUnits: real("plan_units"),
  },
  (table) => [
    uniqueIndex("plan_line_grain_uq").on(
      table.versionId,
      table.accountId,
      table.skuId,
      table.month,
    ),
  ],
);

export const baselineResults = sqliteTable("baseline_results", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => planVersions.id),
  accountId: text("account_id").notNull(),
  skuId: text("sku_id").notNull(),
  month: text("month").notNull(),
  state: text("state").notNull(),
  methodId: text("method_id").notNull(),
  methodVersion: text("method_version").notNull(),
  calculatedUnits: real("calculated_units").notNull(),
  adjustedUnits: real("adjusted_units"),
  approvedUnits: real("approved_units"),
  confidence: real("confidence"),
  evidenceJson: text("evidence_json").notNull(),
});

export const buildingBlockDefinitions = sqliteTable(
  "building_block_definitions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    family: text("family").notNull(),
    economicTreatment: text("economic_treatment").notNull(),
    ownerFunction: text("owner_function").notNull(),
    requiresEvidence: integer("requires_evidence", { mode: "boolean" }).notNull(),
    requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull(),
    version: integer("version").notNull(),
  },
  (table) => [uniqueIndex("building_block_code_version_uq").on(table.code, table.version)],
);

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    sourceSystem: text("source_system").notNull(),
    sourceActivityId: text("source_activity_id").notNull(),
    sourceVersion: text("source_version").notNull(),
    blockDefinitionId: text("block_definition_id").notNull().references(() => buildingBlockDefinitions.id),
    name: text("name").notNull(),
    status: text("status").notNull(),
    parentActivityId: text("parent_activity_id"),
    includesChildren: integer("includes_children", { mode: "boolean" }),
    baselineInclusionKey: text("baseline_inclusion_key"),
    ownerId: text("owner_id").notNull(),
    evidenceJson: text("evidence_json").notNull(),
  },
  (table) => [
    uniqueIndex("activity_economic_identity_uq").on(
      table.sourceSystem,
      table.sourceActivityId,
      table.sourceVersion,
    ),
  ],
);

export const incrementLedger = sqliteTable(
  "increment_ledger",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id").notNull().references(() => planVersions.id),
    activityId: text("activity_id").notNull().references(() => activities.id),
    accountId: text("account_id").notNull(),
    skuId: text("sku_id").notNull(),
    month: text("month").notNull(),
    channelId: text("channel_id"),
    geographyId: text("geography_id"),
    grossUnits: real("gross_units").notNull(),
    cannibalizationUnits: real("cannibalization_units").notNull(),
    haloUnits: real("halo_units").notNull(),
    pullForwardUnits: real("pull_forward_units").notNull(),
    otherInteractionUnits: real("other_interaction_units").notNull(),
    netUnits: real("net_units").notNull(),
  },
  (table) => [
    uniqueIndex("ledger_allocation_uq").on(
      table.versionId,
      table.activityId,
      table.accountId,
      table.skuId,
      table.month,
      table.channelId,
      table.geographyId,
    ),
    index("ledger_grain_idx").on(table.versionId, table.accountId, table.skuId, table.month),
  ],
);

export const interactions = sqliteTable("interactions", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => planVersions.id),
  activityAId: text("activity_a_id").notNull().references(() => activities.id),
  activityBId: text("activity_b_id").notNull().references(() => activities.id),
  accountId: text("account_id").notNull(),
  skuId: text("sku_id").notNull(),
  month: text("month").notNull(),
  netUnits: real("net_units").notNull(),
  methodId: text("method_id").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  approvedBy: text("approved_by"),
});

export const overrides = sqliteTable("overrides", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => planVersions.id),
  kind: text("kind").notNull(),
  priorUnits: real("prior_units").notNull(),
  proposedUnits: real("proposed_units").notNull(),
  reasonCode: text("reason_code").notNull(),
  comment: text("comment").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
});

export const validations = sqliteTable("validations", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => planVersions.id),
  code: text("code").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull(),
  message: text("message").notNull(),
  lineKeyJson: text("line_key_json"),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull().references(() => planVersions.id),
  stage: text("stage").notNull(),
  decision: text("decision").notNull(),
  actorId: text("actor_id").notNull(),
  decidedAt: text("decided_at").notNull(),
  comment: text("comment"),
});

export const planAggregates = sqliteTable("plan_aggregates", {
  planId: text("plan_id").primaryKey(),
  revision: integer("revision").notNull(),
  aggregateJson: text("aggregate_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const commandReceipts = sqliteTable("command_receipts", {
  commandId: text("command_id").primaryKey(),
  planId: text("plan_id").notNull(),
  commandType: text("command_type").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const versionSnapshots = sqliteTable(
  "version_snapshots",
  {
    versionId: text("version_id").primaryKey(),
    planId: text("plan_id").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("version_snapshot_plan_idx").on(table.planId)],
);

export const inputPackageFiles = sqliteTable(
  "input_package_files",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull(),
    requirementId: text("requirement_id").notNull(),
    ownerId: text("owner_id").notNull(),
    originalName: text("original_name").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum").notNull(),
    status: text("status").notNull(),
    missingFieldsJson: text("missing_fields_json").notNull(),
    validationJson: text("validation_json").notNull().default("[]"),
    summaryJson: text("summary_json").notNull().default("{}"),
    receivedAt: text("received_at").notNull(),
  },
  (table) => [
    uniqueIndex("input_file_plan_requirement_uq").on(table.planId, table.requirementId),
    index("input_file_plan_idx").on(table.planId),
  ],
);

export const inputPackageReviews = sqliteTable("input_package_reviews", {
  planId: text("plan_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  contractVersion: text("contract_version").notNull(),
  status: text("status").notNull(),
  fileChecksumsJson: text("file_checksums_json").notNull(),
  acceptedAt: text("accepted_at").notNull(),
});

export const baselineCalculations = sqliteTable("baseline_calculations", {
  planId: text("plan_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  resultJson: text("result_json").notNull(),
  dataClassification: text("data_classification").notNull(),
  inputChecksumsJson: text("input_checksums_json").notNull(),
  calculatedAt: text("calculated_at").notNull(),
});

export const baselineReviews = sqliteTable("baseline_reviews", {
  planId: text("plan_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  calculationCalculatedAt: text("calculation_calculated_at").notNull(),
  status: text("status").notNull(),
  decision: text("decision").notNull(),
  reviewJson: text("review_json").notNull(),
  decidedBy: text("decided_by").notNull(),
  decidedAt: text("decided_at").notNull(),
  frozenAt: text("frozen_at"),
});
