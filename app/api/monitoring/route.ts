import { planRecord, requestIdentity } from "../_access.ts";
import { database, files } from "../_infrastructure.ts";

export const runtime = "nodejs";

async function canonicalRows(planId: string, ownerId: string, requirementId: string) {
  const dataset = await database().prepare(
    "SELECT canonical_object_key, status FROM canonical_datasets WHERE plan_id = ? AND owner_id = ? AND requirement_id = ?",
  ).bind(planId, ownerId, requirementId).first<{ canonical_object_key: string; status: string }>();
  if (!dataset || dataset.status !== "READY") return [];
  const object = await files().get(dataset.canonical_object_key);
  if (!object) throw new Error(`No encontramos el dataset canónico de ${requirementId}`);
  const payload = JSON.parse(await object.text()) as { rows?: Array<Record<string, string | number>> };
  return payload.rows ?? [];
}

function aggregateRows(
  rows: Array<Record<string, string | number>>,
  year: number,
  valueField: string,
  unitsField?: string,
) {
  const months: Record<string, { value: number; units: number }> = {};
  for (const row of rows) {
    const period = String(row.period ?? "");
    if (!period.startsWith(`${year}-`)) continue;
    const current = months[period] ?? { value: 0, units: 0 };
    current.value = Number((current.value + Number(row[valueField] ?? 0)).toFixed(2));
    current.units = Number((current.units + Number(unitsField ? row[unitsField] ?? 0 : 0)).toFixed(2));
    months[period] = current;
  }
  return months;
}

function dimension(row: Record<string, string | number> | undefined, names: string[]) {
  if (!row) return "";
  for (const name of names) {
    const value = String(row[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await requestIdentity(request);
    const { ownerEmail: ownerId } = await planRecord(planId);
    const aggregate = await database()
      .prepare("SELECT aggregate_json, updated_at FROM plan_aggregates WHERE plan_id = ?")
      .bind(planId)
      .first<{ aggregate_json: string; updated_at: string }>();
    if (!aggregate) throw new Error("Plan no encontrado");
    const plan = JSON.parse(aggregate.aggregate_json) as {
      companyName?: string; companyId: string; accountName?: string; accountId: string;
      year: number; currency: string; versions: Array<{ number: number; status: string; createdBy: string }>;
    };
    const active = plan.versions.at(-1);
    if (!active || !["SUBMITTED", "COMMERCIAL_APPROVED", "OFFICIAL"].includes(active.status)) {
      throw new Error("Monitoreo requiere una versión enviada o aprobada");
    }
    const growth = await database().prepare(
      "SELECT result_json, updated_at FROM growth_plans WHERE plan_id = ? AND owner_id = ?",
    ).bind(planId, ownerId).first<{ result_json: string; updated_at: string }>();
    const result = await database().prepare(
      "SELECT result_json, updated_at FROM plan_results WHERE plan_id = ? AND owner_id = ?",
    ).bind(planId, ownerId).first<{ result_json: string; updated_at: string }>();
    const inputs = await database().prepare(
      "SELECT requirement_id, status, summary_json, received_at FROM input_package_files WHERE plan_id = ? AND owner_id = ?",
    ).bind(planId, ownerId).run<{
      requirement_id: string; status: string; summary_json: string; received_at: string;
    }>();
    const planResult = result ? JSON.parse(result.result_json) as {
      currency: string;
      lines: Array<{ accountId: string; skuId: string; period: string; planUnits: number; planValue: number }>;
    } : null;
    const actualRows = await canonicalRows(planId, ownerId, "actual-sales");
    const quotaRows = await canonicalRows(planId, ownerId, "sales-quota");
    const historyRows = await canonicalRows(planId, ownerId, "sales-history");
    const allowed = new Set((planResult?.lines ?? []).map((line) => `${line.accountId}|${line.skuId}|${line.period}`));
    const allowedDimensions = new Set((planResult?.lines ?? []).map((line) => `${line.accountId}|${line.skuId}`));
    const compatible = (rows: Array<Record<string, string | number>>) => rows.filter((row) =>
      allowed.has(`${row.account_id}|${row.sku_id}|${row.period}`)
      && (!row.currency || String(row.currency) === plan.currency),
    );
    const compatibleActuals = compatible(actualRows);
    const compatibleQuota = compatible(quotaRows);
    const rowByKey = new Map<string, Record<string, string | number>>();
    for (const row of [...compatibleQuota, ...compatibleActuals]) {
      const key = `${row.account_id}|${row.sku_id}|${row.period}`;
      if (!rowByKey.has(key) || compatibleActuals.includes(row)) rowByKey.set(key, row);
    }
    const billingRows = (planResult?.lines ?? []).filter((line) => line.period.startsWith(`${plan.year}-`)).map((line) => {
      const key = `${line.accountId}|${line.skuId}|${line.period}`;
      const source = rowByKey.get(key);
      const actual = compatibleActuals.find((row) => `${row.account_id}|${row.sku_id}|${row.period}` === key);
      const quota = compatibleQuota.find((row) => `${row.account_id}|${row.sku_id}|${row.period}` === key);
      const actualValue = actual ? Number(actual.actual_value ?? 0) : null;
      const quotaValue = quota ? Number(quota.quota_value ?? 0) : null;
      const varianceValue = actualValue === null ? null : Number((actualValue - line.planValue).toFixed(2));
      return {
        accountId: line.accountId,
        skuId: line.skuId,
        period: line.period,
        planValue: line.planValue,
        quotaValue,
        actualValue,
        varianceValue,
        territory: dimension(source, ["territory", "territorio"]),
        channel: dimension(source, ["channel", "canal"]),
        category: dimension(source, ["category", "categoria", "categoría"]),
        segment: dimension(source, ["segment", "segmento"]),
      };
    });
    const actualMonths = aggregateRows(compatibleActuals, plan.year, "actual_value", "actual_units");
    const quotaMonths = aggregateRows(compatibleQuota, plan.year, "quota_value");
    const compatibleHistory = historyRows.filter((row) =>
      allowedDimensions.has(`${row.account_id}|${row.sku_id}`)
      && (!row.currency || String(row.currency) === plan.currency),
    );
    const priorYears = [...new Set(compatibleHistory.map((row) => Number(String(row.period).slice(0, 4)))
      .filter((year) => Number.isFinite(year) && year < plan.year))].sort((a, b) => b - a);
    const priorYear = priorYears[0] ?? null;
    const priorMonths = priorYear
      ? aggregateRows(compatibleHistory.filter((row) => String(row.period).startsWith(`${priorYear}-`)).map((row) => ({
          ...row,
          period: `${plan.year}-${String(row.period).slice(5, 7)}`,
        })), plan.year, "value", "units")
      : {};
    const cutoffDate = actualRows.map((row) => String(row.cutoff_date ?? "")).filter(Boolean).sort().at(-1) ?? null;
    return Response.json({
      ok: true,
      plan: {
        id: planId,
        company: plan.companyName ?? plan.companyId,
        account: plan.accountName ?? plan.accountId,
        year: plan.year,
        currency: plan.currency,
        version: active.number,
        status: active.status,
      },
      growth: growth ? JSON.parse(growth.result_json) : null,
      result: planResult,
      actuals: {
        ready: actualRows.length > 0,
        cutoffDate,
        months: actualMonths,
        includedRows: compatible(actualRows).length,
        excludedRows: actualRows.length - compatible(actualRows).length,
      },
      quota: {
        ready: quotaRows.length > 0,
        months: quotaMonths,
        includedRows: compatible(quotaRows).length,
        excludedRows: quotaRows.length - compatible(quotaRows).length,
      },
      billing: billingRows,
      priorYear: { year: priorYear, months: priorMonths },
      datasets: (inputs.results ?? []).map((row) => ({
        requirementId: row.requirement_id,
        status: row.status,
        summary: JSON.parse(row.summary_json),
        receivedAt: row.received_at,
      })),
      updatedAt: aggregate.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos abrir Monitoreo";
    const status = /Autenticación/.test(message) ? 401 : /asignación|no autorizado/.test(message) ? 403 : 422;
    return Response.json({ ok: false, error: message }, { status });
  }
}
