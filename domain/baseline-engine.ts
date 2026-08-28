import { parseCsv } from "./input-package.ts";
import type { CanonicalSalesRow } from "./excel-intake.ts";

export interface BaselineLine {
  accountId: string;
  skuId: string;
  period: string;
  observedAverageUnits: number;
  observedAverageValue: number;
  calculatedValue: number;
  calculatedUnits: number;
  observedUnits: number[];
  confidence: number;
}

export interface BaselineCalculation {
  methodId: "SEASONAL_DEIMPACTED_AVERAGE";
  methodVersion: "1.0.0";
  targetYear: number;
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  lines: BaselineLine[];
  annualUnits: number;
  historyPeriods: number;
  explanation: string;
}

function records(csvText: string) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])),
  );
}

export function calculateBaselineFromAcceptedPackage(input: {
  salesCsv: string;
  activitiesCsv?: string;
  targetYear: number;
  synthetic: boolean;
}): BaselineCalculation {
  const sales = records(input.salesCsv);
  return calculateBaseline({
    sales,
    activitiesCsv: input.activitiesCsv,
    targetYear: input.targetYear,
    synthetic: input.synthetic,
  });
}

export function calculateBaselineFromCanonicalSales(input: {
  sales: CanonicalSalesRow[];
  activitiesCsv?: string;
  targetYear: number;
}): BaselineCalculation {
  return calculateBaseline({
    sales: input.sales.map((row) => ({
      account_id: row.account_id,
      sku_id: row.sku_id,
      period: row.period,
      units: String(row.units),
      value: String(row.value),
      currency: row.currency,
    })),
    activitiesCsv: input.activitiesCsv,
    targetYear: input.targetYear,
    synthetic: false,
  });
}

function calculateBaseline(input: {
  sales: Array<Record<string, string>>;
  activitiesCsv?: string;
  targetYear: number;
  synthetic: boolean;
}): BaselineCalculation {
  const sales = input.sales;
  if (!sales.length) throw new Error("La historia aceptada no contiene ventas para calcular");
  const activities = input.activitiesCsv ? records(input.activitiesCsv) : [];
  const activityImpact = new Map<string, number>();
  for (const row of activities) {
    const units = Number(row.impact_units ?? 0);
    if (!Number.isFinite(units) || units < 0) {
      throw new Error("La historia de actividades contiene impactos inválidos");
    }
    const key = `${row.account_id}|${row.sku_id}|${row.start_period}`;
    activityImpact.set(key, (activityImpact.get(key) ?? 0) + units);
  }

  const observations = new Map<string, { units: number[]; values: number[] }>();
  const periods = new Set<string>();
  for (const row of sales) {
    const units = Number(row.units);
    if (!Number.isFinite(units) || units < 0) throw new Error("La historia contiene unidades inválidas");
    const month = row.period?.slice(5, 7);
    if (!/^(0[1-9]|1[0-2])$/.test(month)) throw new Error("La historia contiene periodos inválidos");
    const key = `${row.account_id}|${row.sku_id}|${month}`;
    const activityUnits = activityImpact.get(`${row.account_id}|${row.sku_id}|${row.period}`) ?? 0;
    const recurringUnits = Math.max(0, units - activityUnits);
    const unitPrice = units > 0 ? Number(row.value ?? 0) / units : 0;
    const current = observations.get(key) ?? { units: [], values: [] };
    current.units.push(recurringUnits);
    current.values.push(recurringUnits * unitPrice);
    observations.set(key, current);
    periods.add(row.period);
  }

  const lines = [...observations.entries()]
    .map(([key, values]) => {
      const [accountId, skuId, month] = key.split("|");
      const average = values.units.reduce((sum, value) => sum + value, 0) / values.units.length;
      const averageValue = values.values.reduce((sum, value) => sum + value, 0) / values.values.length;
      const spread = values.units.length > 1
        ? Math.abs(Math.max(...values.units) - Math.min(...values.units)) / Math.max(average, 1)
        : 0.25;
      return {
        accountId,
        skuId,
        period: `${input.targetYear}-${month}`,
        observedAverageUnits: Number(average.toFixed(2)),
        calculatedUnits: Math.round(average),
        observedAverageValue: Number(averageValue.toFixed(2)),
        calculatedValue: Number((average === 0 ? 0 : averageValue * (Math.round(average) / average)).toFixed(2)),
        observedUnits: values.units,
        confidence: Number(Math.max(0.5, Math.min(0.98, 1 - spread)).toFixed(2)),
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period) || a.skuId.localeCompare(b.skuId));

  return {
    methodId: "SEASONAL_DEIMPACTED_AVERAGE",
    methodVersion: "1.0.0",
    targetYear: input.targetYear,
    dataClassification: input.synthetic ? "SYNTHETIC_NON_COMMERCIAL" : "USER_PROVIDED",
    lines,
    annualUnits: lines.reduce((sum, line) => sum + line.calculatedUnits, 0),
    historyPeriods: periods.size,
    explanation: "Promedio del mismo mes en los años disponibles después de retirar impactos de actividades identificadas.",
  };
}
