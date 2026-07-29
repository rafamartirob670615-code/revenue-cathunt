import type { Plan } from "../../domain/types";

export type DashboardPlan = {
  id: string;
  company: string;
  account: string;
  year: number;
  currency: string;
  version: number;
  status: string;
  nextAction: string;
  readyFiles: number;
  packageAccepted: boolean;
  updatedAt: string;
};

export type Contribution = {
  id: string;
  plan_id: string;
  owner_user_id: string;
  business_function: "MARKETING" | "TRADE_MARKETING";
  lever: string;
  title: string;
  source_mode: "BUILT_IN_REVENUE" | "IMPORTED";
  assumption_quality: "COMMITMENT" | "ESTIMATE" | "PROXY" | "IDEA";
  status: "SUBMITTED" | "ACCEPTED" | "RETURNED";
  period_start: string;
  period_end: string;
  product_scope_json: string;
  gross_units: number | null;
  investment_amount: number | null;
  currency: string;
  evidence_json: string;
};

export type ReceivedFile = {
  requirementId: string;
  originalName: string;
  status: "READY" | "INCOMPLETE";
  missingFields: string[];
  issues: Array<{ code: string; message: string; rows?: number[] }>;
  summary: {
    rowCount: number;
    accountIds: string[];
    skuIds: string[];
    periods: string[];
    workbook?: {
      sheetNames: string[];
      selectedSheet: string | null;
      headerRow: number | null;
      mapping: Record<string, string>;
      confidence: number;
      validRowCount: number;
      rejectedRowCount: number;
    };
  };
  synthetic?: boolean;
};

export type BaselineResult = {
  targetYear: number;
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  lines: Array<{ accountId: string; skuId: string; period: string; calculatedUnits: number; confidence: number }>;
  annualUnits: number;
  historyPeriods: number;
  explanation: string;
};

export type BaselineReview = {
  status: "ADJUSTMENT_PROPOSED" | "APPROVED_FROZEN";
  decision: "CALCULATED" | "ADJUSTED";
  adjustedAnnualUnits?: number | null;
  approvedAnnualUnits?: number | null;
  reason: string;
  evidence: string;
  decidedBy: string;
  decidedAt: string;
  officializationAllowed?: boolean;
};

export type GrowthResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  activities: Array<{
    id: string;
    family: "MARKETING" | "TRADE_MARKETING";
    name: string;
    skuId: string;
    period: string;
    grossUnits: number;
    netUnits: number;
    evidence: string;
  }>;
  grossUnits: number;
  netUnits: number;
  controls: { duplicateEconomicIdentities: number; unresolvedOverlaps: number; reconciled: boolean };
};

export type PlanResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  lines: Array<{
    skuId: string;
    period: string;
    baselineUnits: number;
    incrementalNetUnits: number;
    planUnits: number;
    unitPrice: number;
    currency: string;
    planValue: number;
  }>;
  annualUnits: number;
  annualValue: number;
  currency: string;
  controls: { unitsReconciled: boolean; valueReconciled: boolean; missingConversions: number; missingPrices: number };
};

export type FinancialSide = {
  grossSales: number;
  deductions: number;
  netSales: number;
  cogs: number;
  grossMargin: number;
  investment: number;
  contribution: number;
  grossMarginRate: number | null;
  contributionRate: number | null;
};

export type ProfitabilityResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  currency: string;
  comparatorAnnual: FinancialSide;
  planAnnual: FinancialSide;
  variance: { netSales: number; grossMargin: number; contribution: number };
  controls: { planReconciled: boolean; comparatorReconciled: boolean };
};

export type PlanState = {
  plan: Plan;
  files: ReceivedFile[];
  packageAccepted: boolean;
  systemReady: boolean;
  packageIssues: Array<{ code: string; message: string }>;
  baseline: BaselineResult | null;
  baselineReview: BaselineReview | null;
  growth: GrowthResult | null;
  result: PlanResult | null;
  profitability: ProfitabilityResult | null;
};
