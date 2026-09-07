/**
 * Presentation and aggregation helpers for the REVENUE Billing File.
 * The scenario, product definitions, account universe and calculated rows live
 * in CANÓNICOS (`revenue.monitoring_billing_lines`), never in this app.
 */
export type AlfaUniverseAccount = {
  id: string;
  name: string;
  group: string;
  territory: string;
  channel: string;
  subchannel: string;
};

export type AlfaBillingRow = {
  scenarioId: string;
  period: string;
  asOfDate: string;
  accountId: string;
  territory: string;
  account: string;
  accountGroup: string;
  channel: string;
  subchannel: string;
  category: string;
  family: string;
  familySort: number;
  product: string;
  productSort: number;
  currency: string;
  acceptedPlanUnits: number;
  acceptedPlanValue: number;
  acceptedPlanToDateUnits: number | null;
  acceptedPlanToDateValue: number | null;
  businessPlanUnits: number;
  businessPlanValue: number;
  businessPlanToDateUnits: number | null;
  businessPlanToDateValue: number | null;
  actualUnits: number | null;
  actualValue: number | null;
  lastYearUnits: number | null;
  lastYearValue: number | null;
  sourceClass: string;
  companyName: string;
  datasetLabel: string;
  erpStatus: string;
};

export type AlfaBillingFilters = Partial<Pick<AlfaBillingRow,
  "period" | "territory" | "account" | "accountGroup" | "channel" |
  "subchannel" | "category" | "family" | "product"
>>;

export function filterAlfaTurmixRows(rows: AlfaBillingRow[], filters: AlfaBillingFilters) {
  return rows.filter((row) => Object.entries(filters).every(([key, value]) => !value || row[key as keyof AlfaBillingRow] === value));
}

export function summarizeAlfaTurmixRows(rows: AlfaBillingRow[]) {
  const sum = (field: "acceptedPlanToDateValue" | "businessPlanToDateValue" | "actualValue" | "lastYearValue") => rows.reduce((total, row) => total + (row[field] ?? 0), 0);
  const acceptedPlanValue = sum("acceptedPlanToDateValue");
  const businessPlanValue = sum("businessPlanToDateValue");
  const actualValue = sum("actualValue");
  const lastYearValue = sum("lastYearValue");
  return {
    rows: rows.length,
    acceptedPlanValue,
    businessPlanValue,
    actualValue,
    lastYearValue,
    coverage: acceptedPlanValue ? actualValue / acceptedPlanValue : null,
    vsBusinessPlanValue: actualValue - businessPlanValue,
    vsBusinessPlanPercent: businessPlanValue ? actualValue / businessPlanValue - 1 : null,
    vsLastYearValue: actualValue - lastYearValue,
    vsLastYearPercent: lastYearValue ? actualValue / lastYearValue - 1 : null,
  };
}

export function alfaTurmixOptions(rows: AlfaBillingRow[], key: keyof AlfaBillingRow) {
  return [...new Set(rows.map((row) => String(row[key])))].sort((a, b) => a.localeCompare(b, "es"));
}

export const ALFA_BILLING_COLUMNS = [
  { key: "01", label: "Ene" }, { key: "02", label: "Feb" }, { key: "03", label: "Mar" }, { key: "Q1", label: "Q1" },
  { key: "04", label: "Abr" }, { key: "05", label: "May" }, { key: "06", label: "Jun" }, { key: "Q2", label: "Q2" },
  { key: "07", label: "Jul" }, { key: "08", label: "Ago" }, { key: "09", label: "Sep" }, { key: "Q3", label: "Q3" },
  { key: "10", label: "Oct" }, { key: "11", label: "Nov" }, { key: "12", label: "Dic" }, { key: "Q4", label: "Q4" },
  { key: "YTD", label: "YTD" },
] as const;

export type AlfaBillingMatrixRow = { metric: string; kind: "value" | "percent"; values: Record<string, number | null> };
export type AlfaBillingMatrixBlock = { label: string; rows: AlfaBillingMatrixRow[] };

function matrixValues(rows: AlfaBillingRow[], field: "acceptedPlanValue" | "actualValue" | "businessPlanValue" | "lastYearValue") {
  const byMonth = new Map<string, number>();
  for (const row of rows) {
    const amount = row[field];
    if (amount !== null) byMonth.set(row.period.slice(-2), (byMonth.get(row.period.slice(-2)) ?? 0) + amount);
  }
  const monthsFor = (key: string) => key === "Q1" ? ["01", "02", "03"] : key === "Q2" ? ["04", "05", "06"] : key === "Q3" ? ["07", "08", "09"] : key === "Q4" ? ["10", "11", "12"] : ALFA_BILLING_COLUMNS.filter((column) => column.key.length === 2).map((column) => column.key);
  const value = (key: string) => {
    if (/^\d{2}$/.test(key)) return byMonth.get(key) ?? null;
    const values = monthsFor(key).flatMap((month) => byMonth.has(month) ? [byMonth.get(month)!] : []);
    return values.length ? values.reduce((sum, current) => sum + current, 0) : null;
  };
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, value(key)]));
}

function matrixRatio(numerator: Record<string, number | null>, denominator: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, numerator[key] !== null && denominator[key] ? numerator[key]! / denominator[key] : null]));
}

function matrixDelta(numerator: Record<string, number | null>, denominator: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, numerator[key] !== null && denominator[key] ? numerator[key]! / denominator[key] - 1 : null]));
}

function matrixDifference(left: Record<string, number | null>, right: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, left[key] !== null && right[key] !== null ? left[key]! - right[key]! : null]));
}

function matrixBlock(label: string, rows: AlfaBillingRow[]): AlfaBillingMatrixBlock {
  const plan = matrixValues(rows, "acceptedPlanValue");
  const actual = matrixValues(rows, "actualValue");
  const businessPlan = matrixValues(rows, "businessPlanValue");
  const lastYear = matrixValues(rows, "lastYearValue");
  return { label, rows: [
    { metric: "Plan aceptado", kind: "value", values: plan },
    { metric: "Actuales (ERP)", kind: "value", values: actual },
    { metric: "Cobertura", kind: "percent", values: matrixRatio(actual, plan) },
    { metric: "Business Plan", kind: "value", values: businessPlan },
    { metric: "Cobertura Vs. BP ($)", kind: "value", values: matrixDifference(actual, businessPlan) },
    { metric: "Cobertura Vs. BP (%)", kind: "percent", values: matrixDelta(actual, businessPlan) },
    { metric: "Real facturado año anterior", kind: "value", values: lastYear },
    { metric: "Δ a año anterior ($)", kind: "value", values: matrixDifference(actual, lastYear) },
    { metric: "Δ a año anterior (%)", kind: "percent", values: matrixDelta(actual, lastYear) },
  ] };
}

export function createAlfaTurmixBillingMatrix(rows: AlfaBillingRow[]): AlfaBillingMatrixBlock[] {
  const families = [...new Map(rows.map((row) => [row.family, row.familySort])).entries()]
    .sort(([, left], [, right]) => left - right)
    .map(([family]) => family);
  const totalLabel = rows[0]?.category ? `TOTAL ${rows[0].category.toUpperCase()}` : "TOTAL";
  return [...families.map((family) => matrixBlock(family, rows.filter((row) => row.family === family))), matrixBlock(totalLabel, rows)];
}
