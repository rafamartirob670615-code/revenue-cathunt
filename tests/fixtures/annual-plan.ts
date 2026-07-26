import type {
  Activity,
  IncrementAllocation,
  Interaction,
  Plan,
} from "../../domain/types.ts";

const evidence = [{
  id: "fixture-evidence",
  source: "caso-numérico-controlado-v1",
  observedAt: "2026-07-26T12:00:00Z",
}];

const months = Array.from(
  { length: 12 },
  (_, index) => `2027-${String(index + 1).padStart(2, "0")}`,
);

export const annualPlanFixture: Plan = {
  id: "plan-account-2027",
  organizationId: "org-controlled",
  companyId: "company-controlled",
  accountId: "account-controlled",
  year: 2027,
  currency: "MXN",
  versions: [{
    id: "version-1",
    planId: "plan-account-2027",
    number: 1,
    kind: "PLAN",
    status: "DRAFT",
    createdBy: "kam-1",
    createdAt: "2026-07-26T12:00:00Z",
    lines: months.map((month, index) => {
      const calculatedUnits = 1000 + index * 10;
      return {
        accountId: "account-controlled",
        skuId: "sku-controlled",
        month,
        baseline: {
          calculationId: `baseline-${month}`,
          state: "APPROVED",
          methodId: "fixture-seasonal-v1",
          methodVersion: "1",
          calculatedUnits,
          adjustedUnits: calculatedUnits + 5,
          approvedUnits: calculatedUnits + 5,
          confidence: 0.95,
          evidence,
        },
        authorizedAdjustmentUnits: index === 11 ? 25 : 0,
      };
    }),
    overrides: [],
    validations: [],
    approvals: [],
  }],
};

export const annualActivities: Activity[] = [{
  id: "activity-distribution",
  sourceSystem: "CONTROLLED_FIXTURE",
  sourceActivityId: "distribution-2027",
  sourceVersion: "1",
  blockDefinitionId: "bb-distribution",
  name: "Expansión controlada",
  status: "APPROVED",
  ownerId: "sales-1",
  evidence,
}];

export const annualAllocations: IncrementAllocation[] = months.map((month, index) => ({
  id: `allocation-${month}`,
  activityId: "activity-distribution",
  accountId: "account-controlled",
  skuId: "sku-controlled",
  month,
  grossUnits: 100 + index,
  cannibalizationUnits: 10,
  haloUnits: 2,
  pullForwardUnits: index === 11 ? 15 : 0,
  otherInteractionUnits: 0,
}));

export const annualInteractions: Interaction[] = [];

export const expectedAnnualBaseline = 12_720;
export const expectedAnnualIncremental = 1_155;
export const expectedAuthorizedAdjustment = 25;
export const expectedAnnualPlanUnits = 13_900;
