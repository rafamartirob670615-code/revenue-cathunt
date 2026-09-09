import type { AlfaBillingRow, AlfaUniverseAccount } from "../domain/alfa-turmix-monitoring.ts";
import postgres from "postgres";

type CanonicalAccountRow = {
  id_maestro: string;
  cuenta_cadena: string;
  grupo_corporativo: string | null;
  region: string | null;
  canal_consolidado: string | null;
  canal: string | null;
  subcanal: string | null;
};

type CanonicalMonitoringRow = {
  scenario_id: string;
  period: string;
  as_of_date: string | Date;
  account_id: string;
  territory: string;
  account: string;
  account_group: string;
  channel: string;
  subchannel: string;
  category: string;
  family: string;
  family_sort: number | string;
  product: string;
  product_sort: number | string;
  currency: string;
  accepted_plan_units: number | string;
  accepted_plan_value: number | string;
  accepted_plan_to_date_units: number | string | null;
  accepted_plan_to_date_value: number | string | null;
  business_plan_units: number | string;
  business_plan_value: number | string;
  business_plan_to_date_units: number | string | null;
  business_plan_to_date_value: number | string | null;
  actual_units: number | string | null;
  actual_value: number | string | null;
  last_year_units: number | string | null;
  last_year_value: number | string | null;
  source_class: string;
  company_name: string;
  dataset_label: string;
  erp_status: string;
};

const globalCanonicalDatabase = globalThis as typeof globalThis & {
  canonicalRevenuePostgres?: ReturnType<typeof postgres>;
};

function canonicalDatabase() {
  const connectionString = (process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("CANÓNICOS no está disponible: falta SUPABASE_DATABASE_URL.");
  }
  globalCanonicalDatabase.canonicalRevenuePostgres ??= postgres(connectionString, {
    max: 2,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return globalCanonicalDatabase.canonicalRevenuePostgres;
}

export async function readCanonicalRevenueAccounts(): Promise<AlfaUniverseAccount[]> {
  const rows = await canonicalDatabase()<CanonicalAccountRow[]>`
    SELECT id_maestro, cuenta_cadena, grupo_corporativo, region,
           canal_consolidado, canal, subcanal
    FROM public.cuentas
    ORDER BY id_maestro ASC
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("CANÓNICOS no devolvió un universo de cuentas utilizable.");
  }
  const ids = new Set<string>();
  return rows.map((row) => {
    if (!row.id_maestro || !row.cuenta_cadena || ids.has(row.id_maestro)) {
      throw new Error(`Cuenta canónica inválida o duplicada: ${row.id_maestro || "sin ID"}.`);
    }
    ids.add(row.id_maestro);
    return {
      id: row.id_maestro,
      name: row.cuenta_cadena,
      group: row.grupo_corporativo?.trim() || "(Individual)",
      territory: row.region?.trim() || "Nacional",
      channel: row.canal_consolidado?.trim() || row.canal?.trim() || "Sin clasificar",
      subchannel: row.subcanal?.trim() || "General",
    };
  });
}

type CanonicalProductRow = {
  id: string;
  nombre: string;
  sku_codigo: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
};

export type CanonicalProduct = {
  id: string;
  name: string;
  skuCode: string;
  categoryName: string;
};

export type CanonicalCategory = {
  id: string;
  name: string;
};

/** Único catálogo de productos del ecosistema; vive en CANÓNICOS, gobernado por la app Producto. */
export async function readCanonicalProducts(): Promise<CanonicalProduct[]> {
  const rows = await canonicalDatabase()<CanonicalProductRow[]>`
    SELECT p.id, p.nombre, p.sku_codigo, p.categoria_id, c.nombre AS categoria_nombre
    FROM public.productos p
    LEFT JOIN public.categorias c ON c.id = p.categoria_id
    WHERE p.competidor_id IS NULL
    ORDER BY p.nombre ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.nombre,
    skuCode: row.sku_codigo?.trim() || row.id,
    categoryName: row.categoria_nombre?.trim() || "Sin categoría",
  }));
}

export async function readCanonicalCategories(): Promise<CanonicalCategory[]> {
  const rows = await canonicalDatabase()<{ id: string; nombre: string }[]>`
    SELECT id, nombre FROM public.categorias ORDER BY nombre ASC
  `;
  return rows.map((row) => ({ id: row.id, name: row.nombre }));
}

function canonicalNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

function canonicalDate(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

/** Billing File de REVENUE: calculado y almacenado exclusivamente en CANÓNICOS. */
export async function readCanonicalRevenueMonitoringRows(): Promise<AlfaBillingRow[]> {
  const rows = await canonicalDatabase()<CanonicalMonitoringRow[]>`
    SELECT scenario_id, period, as_of_date, account_id, territory, account, account_group,
           channel, subchannel, category, family, family_sort, product, product_sort, currency,
           accepted_plan_units, accepted_plan_value,
           accepted_plan_to_date_units, accepted_plan_to_date_value,
           business_plan_units, business_plan_value,
           business_plan_to_date_units, business_plan_to_date_value,
           actual_units, actual_value, last_year_units, last_year_value,
           source_class, company_name, dataset_label, erp_status
    FROM revenue.monitoring_billing_lines
    ORDER BY family_sort ASC, product_sort ASC, period ASC, account_id ASC
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("CANÓNICOS no devolvió un Billing File de REVENUE utilizable.");
  }
  const scenarios = new Set(rows.map((row) => row.scenario_id));
  if (scenarios.size !== 1) {
    throw new Error("CANÓNICOS devolvió más de un escenario de Billing File activo.");
  }
  return rows.map((row) => ({
    scenarioId: row.scenario_id,
    period: row.period,
    asOfDate: canonicalDate(row.as_of_date),
    accountId: row.account_id,
    territory: row.territory,
    account: row.account,
    accountGroup: row.account_group,
    channel: row.channel,
    subchannel: row.subchannel,
    category: row.category,
    family: row.family,
    familySort: Number(row.family_sort),
    product: row.product,
    productSort: Number(row.product_sort),
    currency: row.currency,
    acceptedPlanUnits: Number(row.accepted_plan_units),
    acceptedPlanValue: Number(row.accepted_plan_value),
    acceptedPlanToDateUnits: canonicalNumber(row.accepted_plan_to_date_units),
    acceptedPlanToDateValue: canonicalNumber(row.accepted_plan_to_date_value),
    businessPlanUnits: Number(row.business_plan_units),
    businessPlanValue: Number(row.business_plan_value),
    businessPlanToDateUnits: canonicalNumber(row.business_plan_to_date_units),
    businessPlanToDateValue: canonicalNumber(row.business_plan_to_date_value),
    actualUnits: canonicalNumber(row.actual_units),
    actualValue: canonicalNumber(row.actual_value),
    lastYearUnits: canonicalNumber(row.last_year_units),
    lastYearValue: canonicalNumber(row.last_year_value),
    sourceClass: row.source_class,
    companyName: row.company_name,
    datasetLabel: row.dataset_label,
    erpStatus: row.erp_status,
  }));
}
