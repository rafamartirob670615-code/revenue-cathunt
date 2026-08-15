import { NextRequest, NextResponse } from "next/server";
import { readCanonicalRevenueAccounts } from "../../../../application/canonical-data";
import { authorizeMonitoring } from "../../_access";
import {
  alfaTurmixCatalog,
  alfaTurmixOptions,
  createAlfaTurmixBillingMatrix,
  createAlfaTurmixRows,
  filterAlfaTurmixRows,
  summarizeAlfaTurmixRows,
  type AlfaBillingFilters,
  type AlfaBillingRow,
} from "../../../../domain/alfa-turmix-monitoring";

export const dynamic = "force-dynamic";

const filterKeys = [
  "period", "territory", "account", "accountGroup", "channel", "subchannel",
  "category", "family", "product",
] as const;

function queryFilters(request: NextRequest): AlfaBillingFilters {
  const filters: AlfaBillingFilters = {};
  for (const key of filterKeys) {
    const value = request.nextUrl.searchParams.get(key);
    if (value && value !== "Todos") filters[key] = value as never;
  }
  return filters;
}

function aggregateByPeriod(rows: AlfaBillingRow[]) {
  const groups = new Map<string, AlfaBillingRow[]>();
  for (const row of rows) groups.set(row.period, [...(groups.get(row.period) ?? []), row]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => ({ period, ...summarizeAlfaTurmixRows(group) }));
}

export async function GET(request: NextRequest) {
  try {
    await authorizeMonitoring(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No tienes acceso autorizado a Monitoreo";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }
  const accounts = await readCanonicalRevenueAccounts();
  const allRows = createAlfaTurmixRows(accounts);
  const rows = filterAlfaTurmixRows(allRows, queryFilters(request));
  const sample = rows.slice(0, 240);
  const catalog = alfaTurmixCatalog(accounts);
  const optionKeys = ["period", "territory", "account", "accountGroup", "channel", "subchannel", "category", "family", "product"] as const;
  const options = Object.fromEntries(optionKeys.map((key) => {
    const siblingFilters = { ...queryFilters(request) };
    delete siblingFilters[key];
    return [key, alfaTurmixOptions(filterAlfaTurmixRows(allRows, siblingFilters), key)];
  }));
  return NextResponse.json({
    ok: true,
    dataset: catalog,
    source: { class: "SYNTHETIC_NON_COMMERCIAL", accountUniverse: "CANONICOS", erpStatus: "SIMULATED_OFFICIAL_FEED" },
    filters: queryFilters(request),
    options,
    totals: summarizeAlfaTurmixRows(rows),
    byPeriod: aggregateByPeriod(rows),
    matrix: createAlfaTurmixBillingMatrix(rows),
    rows: sample,
    exportRows: rows,
    rowCount: rows.length,
    sampleLimit: 240,
  });
}
