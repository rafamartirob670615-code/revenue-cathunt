export const ALFA_TURMIX_DATASET = "ALFA_TURMIX_SINTETICO_NO_COMERCIAL" as const;
export const ALFA_TURMIX_LABEL = "ALFA Turmix · Datos sintéticos no comerciales" as const;
export const ALFA_TURMIX_YEAR = 2027;
export const ALFA_UNIVERSE_SOURCE = "CANÓNICOS · public.cuentas";

export type AlfaUniverseAccount = {
  id: string;
  name: string;
  group: string;
  territory: string;
  channel: string;
  subchannel: string;
};

export const ALFA_FAMILIES = [
  "Complementos de cocina",
  "Café y Bebidas",
  "Purificadores de agua",
  "Parrillas y asadores",
  "Licuadoras",
  "Extractores de Jugo",
] as const;

export type AlfaFamily = typeof ALFA_FAMILIES[number];

export type AlfaBillingRow = {
  period: string;
  territory: string;
  account: string;
  accountGroup: string;
  channel: string;
  subchannel: string;
  category: "Electrodomésticos";
  family: AlfaFamily;
  product: string;
  currency: "MXN";
  acceptedPlanUnits: number;
  acceptedPlanValue: number;
  businessPlanUnits: number;
  businessPlanValue: number;
  actualUnits: number;
  actualValue: number;
  lastYearUnits: number;
  lastYearValue: number;
  sourceClass: typeof ALFA_TURMIX_DATASET;
};

export type AlfaBillingFilters = Partial<Pick<AlfaBillingRow,
  "period" | "territory" | "account" | "accountGroup" | "channel" |
  "subchannel" | "category" | "family" | "product"
>>;

const products: Record<AlfaFamily, Array<{ name: string; base: number; price: number }>> = {
  "Complementos de cocina": [{ name: "Accesorios Cocina A", base: 420, price: 780 }, { name: "Accesorios Cocina B", base: 310, price: 540 }],
  "Café y Bebidas": [{ name: "Cafetera Turmix", base: 360, price: 1450 }, { name: "Hervidor Turmix", base: 285, price: 890 }],
  "Purificadores de agua": [{ name: "Purificador Hogar", base: 180, price: 2380 }, { name: "Purificador Plus", base: 125, price: 3250 }],
  "Parrillas y asadores": [{ name: "Parrilla Compacta", base: 210, price: 1980 }, { name: "Asador Familiar", base: 150, price: 2890 }],
  "Licuadoras": [{ name: "Licuadora Clásica", base: 520, price: 920 }, { name: "Licuadora Pro", base: 270, price: 1760 }],
  "Extractores de Jugo": [{ name: "Extractor Compacto", base: 175, price: 1560 }, { name: "Extractor Pro", base: 115, price: 2490 }],
};
const seasonal = [0.88, 0.92, 0.98, 1.01, 1.04, 1.07, 1.02, 0.97, 1.03, 1.09, 1.17, 1.24];

function period(month: number) {
  return `${ALFA_TURMIX_YEAR}-${String(month).padStart(2, "0")}`;
}

function stableAdjustment(seed: number) {
  return 1 + ((seed % 7) - 3) / 100;
}

export function createAlfaTurmixRows(accounts: readonly AlfaUniverseAccount[]): AlfaBillingRow[] {
  const rows: AlfaBillingRow[] = [];
  let seed = 0;
  for (let month = 1; month <= 12; month += 1) {
    for (const account of accounts) {
      for (const family of ALFA_FAMILIES) {
        for (const product of products[family]) {
          seed += 1;
          const accountSeed = [...account.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
          const accountFactor = account.channel === "Especialistas" ? 0.72 : account.territory === "Norte" ? 1.1 : 0.96;
          const lastYearUnits = Math.round(product.base * seasonal[month - 1] * accountFactor * stableAdjustment(seed + accountSeed));
          const acceptedPlanUnits = Math.round(lastYearUnits * (1.04 + (family === "Café y Bebidas" ? 0.025 : 0)));
          const businessPlanUnits = Math.round(lastYearUnits * 1.055);
          const actualUnits = Math.round(acceptedPlanUnits * (0.95 + ((month + seed) % 9) / 100));
          rows.push({
            period: period(month), territory: account.territory, account: account.name,
            accountGroup: account.group, channel: account.channel, subchannel: account.subchannel,
            category: "Electrodomésticos", family, product: product.name, currency: "MXN",
            acceptedPlanUnits, acceptedPlanValue: acceptedPlanUnits * product.price,
            businessPlanUnits, businessPlanValue: businessPlanUnits * product.price,
            actualUnits, actualValue: actualUnits * product.price,
            lastYearUnits, lastYearValue: lastYearUnits * product.price,
            sourceClass: ALFA_TURMIX_DATASET,
          });
        }
      }
    }
  }
  return rows;
}

export function filterAlfaTurmixRows(rows: AlfaBillingRow[], filters: AlfaBillingFilters) {
  return rows.filter((row) => Object.entries(filters).every(([key, value]) => !value || row[key as keyof AlfaBillingRow] === value));
}

export function summarizeAlfaTurmixRows(rows: AlfaBillingRow[]) {
  const acceptedPlanValue = rows.reduce((sum, row) => sum + row.acceptedPlanValue, 0);
  const businessPlanValue = rows.reduce((sum, row) => sum + row.businessPlanValue, 0);
  const actualValue = rows.reduce((sum, row) => sum + row.actualValue, 0);
  const lastYearValue = rows.reduce((sum, row) => sum + row.lastYearValue, 0);
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

export function alfaTurmixCatalog(accounts: readonly AlfaUniverseAccount[]) {
  const territories = [...new Set(accounts.map((account) => account.territory))]
    .sort((a, b) => a.localeCompare(b, "es"));
  return {
    dataset: ALFA_TURMIX_DATASET,
    label: ALFA_TURMIX_LABEL,
    year: ALFA_TURMIX_YEAR,
    category: "Electrodomésticos",
    families: [...ALFA_FAMILIES],
    territories: [...territories],
    universeSource: ALFA_UNIVERSE_SOURCE,
    accounts: accounts.map(({ id, name, group, territory, channel, subchannel }) => ({ id, name, group, territory, channel, subchannel })),
  };
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
  for (const row of rows) byMonth.set(row.period.slice(-2), (byMonth.get(row.period.slice(-2)) ?? 0) + row[field]);
  const value = (key: string) => ["Q1", "Q2", "Q3", "Q4"].includes(key) ? [...(key === "Q1" ? ["01", "02", "03"] : key === "Q2" ? ["04", "05", "06"] : key === "Q3" ? ["07", "08", "09"] : ["10", "11", "12"])].reduce((sum, month) => sum + (byMonth.get(month) ?? 0), 0) : key.length === 2 ? byMonth.get(key) ?? 0 : [...byMonth.values()].reduce((sum, current) => sum + current, 0);
  return Object.fromEntries([...ALFA_BILLING_COLUMNS.map(({ key }) => [key, value(key)])]);
}

function matrixRatio(numerator: Record<string, number | null>, denominator: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, denominator[key] ? (numerator[key] ?? 0) / denominator[key] : null]));
}

function matrixDelta(numerator: Record<string, number | null>, denominator: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, denominator[key] ? (numerator[key] ?? 0) / denominator[key] - 1 : null]));
}

function matrixDifference(left: Record<string, number | null>, right: Record<string, number | null>) {
  return Object.fromEntries(ALFA_BILLING_COLUMNS.map(({ key }) => [key, (left[key] ?? 0) - (right[key] ?? 0)]));
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
    { metric: "Vs. Business Plan", kind: "value", values: businessPlan },
    { metric: "Cobertura Vs. BP ($)", kind: "value", values: matrixDifference(actual, businessPlan) },
    { metric: "Cobertura Vs. BP (%)", kind: "percent", values: matrixDelta(actual, businessPlan) },
    { metric: "Real facturado año anterior", kind: "value", values: lastYear },
    { metric: "Δ a año anterior ($)", kind: "value", values: matrixDifference(actual, lastYear) },
    { metric: "Δ a año anterior (%)", kind: "percent", values: matrixDelta(actual, lastYear) },
  ] };
}

export function createAlfaTurmixBillingMatrix(rows: AlfaBillingRow[]): AlfaBillingMatrixBlock[] {
  const blocks = ALFA_FAMILIES.map((family) => matrixBlock(family, rows.filter((row) => row.family === family)));
  return [...blocks, matrixBlock("TOTAL ELECTRODOMÉSTICOS", rows)];
}
