import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../../application/d1-repository.ts";
import { authorizePlan } from "../../_access.ts";

export const runtime = "edge";

interface R2BucketLike {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
}

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function files(): R2BucketLike {
  if (!env.FILES) throw new Error("Almacenamiento de archivos no disponible");
  return env.FILES as unknown as R2BucketLike;
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos guardar la acción";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

async function planContext(planId: string, ownerId: string) {
  const aggregate = await database().prepare(
    "SELECT aggregate_json FROM plan_aggregates WHERE plan_id = ?",
  ).bind(planId).first<{ aggregate_json: string }>();
  if (!aggregate) throw new Error("Plan no encontrado");
  const plan = JSON.parse(aggregate.aggregate_json) as {
    year: number;
    currency: string;
    versions: Array<{ number: number; status: string; createdBy: string }>;
  };
  const active = plan.versions.at(-1);
  if (!active || !["SUBMITTED","COMMERCIAL_APPROVED","OFFICIAL"].includes(active.status)) {
    throw new Error("El Plan debe estar enviado o aprobado para gestionar desviaciones");
  }
  return { plan, active };
}

async function actualRows(planId: string, ownerId: string) {
  const dataset = await database().prepare(
    "SELECT canonical_object_key, status FROM canonical_datasets WHERE plan_id = ? AND owner_id = ? AND requirement_id = 'actual-sales'",
  ).bind(planId, ownerId).first<{ canonical_object_key: string; status: string }>();
  if (!dataset || dataset.status !== "READY") throw new Error("Carga Actuals válidos antes de registrar acciones");
  const object = await files().get(dataset.canonical_object_key);
  if (!object) throw new Error("No encontramos los Actuals procesados");
  const payload = JSON.parse(await object.text()) as { rows?: Array<Record<string, string | number>> };
  return payload.rows ?? [];
}

const selectActions = `SELECT id, plan_id, version_number, period, comparison, plan_value,
  actual_value, variance_value, variance_rate, material, cause, evidence, action,
  responsible, due_date, status, outcome_note, created_by, created_at, updated_at, closed_at
  FROM monitoring_actions WHERE plan_id = ? AND owner_id = ? ORDER BY
  CASE status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, due_date, created_at DESC`;

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["MONITOR","PLAN_INTEGRATE"]);
    await planContext(planId, ownerId);
    const rows = await database().prepare(selectActions).bind(planId, ownerId).run<Record<string, unknown>>();
    return Response.json({ ok: true, actions: rows.results ?? [] });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      planId?: string; period?: string; cause?: string; evidence?: string;
      action?: string; responsible?: string; dueDate?: string;
    };
    const planId = body.planId ?? "";
    const { dataOwnerId: ownerId, actor } = await authorizePlan(request, planId, ["MONITOR","PLAN_INTEGRATE"]);
    const period = body.period ?? "";
    if (!planId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Selecciona un mes válido");
    if (![body.cause,body.evidence,body.action,body.responsible].every((value) => value?.trim())) {
      throw new Error("Causa, evidencia, acción y responsable son obligatorios");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")) throw new Error("Define una fecha compromiso válida");
    const { plan, active } = await planContext(planId, ownerId);
    if (!period.startsWith(`${plan.year}-`)) throw new Error("El periodo no pertenece al año del Plan");
    const resultRow = await database().prepare(
      "SELECT result_json FROM plan_results WHERE plan_id = ? AND owner_id = ?",
    ).bind(planId, ownerId).first<{ result_json: string }>();
    if (!resultRow) throw new Error("Falta el Resultado guardado del Plan");
    const result = JSON.parse(resultRow.result_json) as {
      currency: string;
      lines: Array<{ accountId: string; skuId: string; period: string; planValue: number }>;
    };
    const planLines = result.lines.filter((line) => line.period === period);
    if (!planLines.length) throw new Error("El Plan no contiene líneas para ese mes");
    const allowed = new Set(planLines.map((line) => `${line.accountId}|${line.skuId}`));
    const actuals = (await actualRows(planId, ownerId)).filter((row) =>
      row.period === period
      && allowed.has(`${row.account_id}|${row.sku_id}`)
      && String(row.currency) === result.currency,
    );
    if (!actuals.length) throw new Error("No hay Actuals comparables para ese mes");
    const planValue = Number(planLines.reduce((sum, line) => sum + line.planValue, 0).toFixed(2));
    const actualValue = Number(actuals.reduce((sum, row) => sum + Number(row.actual_value), 0).toFixed(2));
    const varianceValue = Number((actualValue - planValue).toFixed(2));
    const varianceRate = planValue === 0 ? null : Number((varianceValue / planValue).toFixed(4));
    const material = varianceRate !== null && Math.abs(varianceRate) >= 0.05;
    const existing = await database().prepare(
      "SELECT id FROM monitoring_actions WHERE plan_id = ? AND owner_id = ? AND period = ? AND status IN ('OPEN','IN_PROGRESS')",
    ).bind(planId, ownerId, period).first<{ id: string }>();
    if (existing) throw new Error("Ese periodo ya tiene una acción abierta");
    const now = new Date().toISOString();
    const id = `monitor-action:${crypto.randomUUID()}`;
    await database().prepare(
      `INSERT INTO monitoring_actions
      (id, plan_id, owner_id, version_number, period, comparison, plan_value, actual_value,
      variance_value, variance_rate, material, cause, evidence, action, responsible, due_date,
      status, outcome_note, created_by, created_at, updated_at, closed_at)
      VALUES (?, ?, ?, ?, ?, 'PLAN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NULL, ?, ?, ?, NULL)`,
    ).bind(
      id, planId, ownerId, active.number, period, planValue, actualValue, varianceValue,
      varianceRate, material ? 1 : 0, body.cause!.trim(), body.evidence!.trim(),
      body.action!.trim(), body.responsible!.trim(), body.dueDate, actor.email, now, now,
    ).run();
    const created = await database().prepare(
      `${selectActions.replace("WHERE plan_id = ? AND owner_id = ?", "WHERE id = ? AND owner_id = ?")}`,
    ).bind(id, ownerId).run<Record<string, unknown>>();
    return Response.json({ ok: true, action: created.results?.[0] });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as {
      planId?: string; actionId?: string; status?: string; outcomeNote?: string;
    };
    const planId = body.planId ?? "";
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["MONITOR","PLAN_INTEGRATE"]);
    const actionId = body.actionId ?? "";
    if (!planId || !actionId) throw new Error("Acción no reconocida");
    await planContext(planId, ownerId);
    if (!["OPEN","IN_PROGRESS","CLOSED"].includes(body.status ?? "")) throw new Error("Estado no válido");
    if (body.status === "CLOSED" && !body.outcomeNote?.trim()) {
      throw new Error("Documenta el resultado antes de cerrar la acción");
    }
    const now = new Date().toISOString();
    const updated = await database().prepare(
      `UPDATE monitoring_actions SET status = ?, outcome_note = ?, updated_at = ?,
      closed_at = ? WHERE id = ? AND plan_id = ? AND owner_id = ?`,
    ).bind(
      body.status, body.outcomeNote?.trim() || null, now,
      body.status === "CLOSED" ? now : null, actionId, planId, ownerId,
    ).run();
    if ((updated.meta?.changes ?? 0) !== 1) throw new Error("Acción no encontrada o no autorizada");
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
}
