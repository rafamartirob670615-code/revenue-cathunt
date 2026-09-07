import { NextRequest, NextResponse } from "next/server";
import { readCanonicalRevenueMonitoringRows } from "../../../../application/canonical-data";
import { authorizeMonitoring } from "../../_access";
import {
  alfaTurmixOptions,
  createAlfaTurmixBillingMatrix,
  filterAlfaTurmixRows,
  summarizeAlfaTurmixRows,
  type AlfaBillingFilters,
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

function formatCanonicalAsOfDate(asOfDate: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${asOfDate}T12:00:00Z`));
}

export async function GET(request: NextRequest) {
  try {
    await authorizeMonitoring(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No tienes acceso autorizado a Monitoreo";
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }
  // All business inputs and calculated Billing rows are owned by CANÓNICOS.
  const allRows = await readCanonicalRevenueMonitoringRows();
  const filters = queryFilters(request);
  const rows = filterAlfaTurmixRows(allRows, filters);
  const representative = allRows[0];
  const optionKeys = ["period", "territory", "account", "accountGroup", "channel", "subchannel", "category", "family", "product"] as const;
  const options = Object.fromEntries(optionKeys.map((key) => {
    const siblingFilters = { ...filters };
    delete siblingFilters[key];
    return [key, alfaTurmixOptions(filterAlfaTurmixRows(allRows, siblingFilters), key)];
  }));
  return NextResponse.json({
    ok: true,
    dataset: { label: representative.datasetLabel, category: representative.category },
    cutoff: { asOfDate: representative.asOfDate, label: formatCanonicalAsOfDate(representative.asOfDate) },
    filters,
    options,
    totals: summarizeAlfaTurmixRows(rows),
    matrix: createAlfaTurmixBillingMatrix(rows),
  });
}
