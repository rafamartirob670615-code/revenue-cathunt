export type BusinessFunction =
  | "PLAN_OWNER"
  | "MARKETING"
  | "TRADE_MARKETING"
  | "FINANCE"
  | "APPROVER"
  | "ADMINISTRATOR";

export type Capability =
  | "PLAN_CREATE"
  | "PLAN_INTEGRATE"
  | "BASELINE_REVIEW"
  | "MARKETING_CONTRIBUTE"
  | "TRADE_CONTRIBUTE"
  | "VIEW_FINANCIALS"
  | "REVIEW"
  | "APPROVE"
  | "OFFICIALIZE"
  | "MONITOR"
  | "ADMINISTER_ACCESS";

export type RevenueIdentity = {
  displayName: string;
  email: string;
  authenticated: boolean;
  functions: BusinessFunction[];
  capabilities: Capability[];
};

export const FUNCTION_LABELS: Record<BusinessFunction, string> = {
  PLAN_OWNER: "Responsable del Plan",
  MARKETING: "Marketing",
  TRADE_MARKETING: "Trade Marketing",
  FINANCE: "Finanzas · sólo consulta",
  APPROVER: "Revisión y aprobación",
  ADMINISTRATOR: "Administración",
};

export const ASSIGNABLE_CAPABILITIES: Capability[] = [
  "MARKETING_CONTRIBUTE", "TRADE_CONTRIBUTE", "PLAN_INTEGRATE",
  "REVIEW", "APPROVE", "VIEW_FINANCIALS", "MONITOR",
];
