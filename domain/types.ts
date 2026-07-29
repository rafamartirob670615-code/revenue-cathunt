export type ISODateTime = string;
export type PlanStatus =
  | "DRAFT"
  | "READY"
  | "FROZEN"
  | "SUBMITTED"
  | "COMMERCIAL_APPROVED"
  | "OFFICIAL"
  | "RETURNED";

export type VersionKind = "PLAN" | "REVISION" | "SCENARIO";
export type BaselineState = "CALCULATED" | "ADJUSTED" | "APPROVED";
export type ValidationSeverity = "WARNING" | "BLOCKING";
export type ValidationStatus = "OPEN" | "RESOLVED" | "ACCEPTED";

export interface EvidenceReference {
  id: string;
  source: string;
  observedAt: ISODateTime;
  note?: string;
}

export interface Baseline {
  calculationId: string;
  state: BaselineState;
  methodId: string;
  methodVersion: string;
  calculatedUnits: number;
  adjustedUnits?: number;
  approvedUnits?: number;
  confidence?: number;
  evidence: EvidenceReference[];
}

export interface Override {
  id: string;
  kind: "BASELINE" | "AUTHORIZED_FINAL_ADJUSTMENT";
  priorUnits: number;
  proposedUnits: number;
  reasonCode: string;
  comment: string;
  evidence: EvidenceReference[];
  createdBy: string;
  createdAt: ISODateTime;
  approvedBy?: string;
  approvedAt?: ISODateTime;
}

export interface PlanLineKey {
  accountId: string;
  skuId: string;
  month: string;
}

export interface PlanLine extends PlanLineKey {
  baseline: Baseline;
  authorizedAdjustmentUnits: number;
  planUnits?: number;
}

export interface Validation {
  id: string;
  code: string;
  severity: ValidationSeverity;
  status: ValidationStatus;
  message: string;
  lineKey?: PlanLineKey;
}

export interface Approval {
  id: string;
  stage: "COMMERCIAL";
  decision: "APPROVED" | "RETURNED";
  actorId: string;
  decidedAt: ISODateTime;
  comment?: string;
}

export interface PlanVersion {
  id: string;
  planId: string;
  number: number;
  kind: VersionKind;
  status: PlanStatus;
  parentVersionId?: string;
  createdBy: string;
  createdAt: ISODateTime;
  frozenAt?: ISODateTime;
  lines: PlanLine[];
  overrides: Override[];
  validations: Validation[];
  approvals: Approval[];
}

export interface Plan {
  id: string;
  organizationId: string;
  companyId: string;
  companyName?: string;
  accountId: string;
  accountName?: string;
  year: number;
  currency: string;
  versions: PlanVersion[];
  officialVersionId?: string;
}

export interface BuildingBlockDefinition {
  id: string;
  code: string;
  name: string;
  family:
    | "MARKETING"
    | "TRADE_PROMOTION"
    | "INNOVATION"
    | "DISTRIBUTION"
    | "PRICE"
    | "CONSTRAINT"
    | "INTERACTION"
    | "AUTHORIZED_ADJUSTMENT";
  economicTreatment: "INCREMENTAL" | "CONSTRAINT" | "INTERACTION" | "ADJUSTMENT";
  ownerFunction: string;
  requiresEvidence: boolean;
  requiresApproval: boolean;
  active: boolean;
  version: number;
}

export interface Activity {
  id: string;
  sourceSystem: string;
  sourceActivityId: string;
  sourceVersion: string;
  blockDefinitionId: string;
  name: string;
  status: "PROPOSED" | "ELIGIBLE" | "APPROVED" | "CANCELLED" | "SUPERSEDED";
  parentActivityId?: string;
  includesChildren?: boolean;
  baselineInclusionKey?: string;
  ownerId: string;
  evidence: EvidenceReference[];
}

export interface IncrementAllocation {
  id: string;
  activityId: string;
  accountId: string;
  skuId: string;
  month: string;
  channelId?: string;
  geographyId?: string;
  grossUnits: number;
  cannibalizationUnits: number;
  haloUnits: number;
  pullForwardUnits: number;
  otherInteractionUnits: number;
}

export interface LedgerEntry {
  id: string;
  versionId: string;
  activity: Activity;
  allocation: IncrementAllocation;
  netUnits: number;
}

export interface Interaction {
  id: string;
  versionId: string;
  activityIds: [string, string];
  accountId: string;
  skuId: string;
  month: string;
  netUnits: number;
  methodId: string;
  evidence: EvidenceReference[];
  approvedBy?: string;
}
