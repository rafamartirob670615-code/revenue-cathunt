import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";

export const runtime = "edge";

type ContributionInput = {
  planId?: string;
  businessFunction?: "MARKETING" | "TRADE_MARKETING";
  lever?: string;
  title?: string;
  assumptionQuality?: "COMMITMENT" | "ESTIMATE" | "PROXY" | "IDEA";
  periodStart?: string;
  periodEnd?: string;
  productScope?: string;
  grossUnits?: number;
  investmentAmount?: number;
  currency?: string;
  evidence?: string;
};

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function identity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  if (!email) throw new Error("Autenticación requerida");
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let displayName = email;
  if (encoded && encoding === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(encoded); } catch { /* email is safe fallback */ }
  }
  return { email, displayName, id: `user:${email.toLowerCase()}` };
}

async function planFor(planId: string, email: string) {
  const row = await database().prepare(
    "SELECT aggregate_json FROM plan_aggregates WHERE plan_id = ?",
  ).bind(planId).first<{ aggregate_json: string }>();
  if (!row) throw new Error("Plan no encontrado");
  const plan = JSON.parse(row.aggregate_json) as {
    currency: string;
    versions: Array<{ id: string; createdBy: string; status: string }>;
  };
  const version = plan.versions.at(-1);
  if (!version) throw new Error("El Plan no tiene una versión activa");
  if (plan.versions[0]?.createdBy !== email) {
    const assignment = await database().prepare(
      `SELECT aa.capability FROM access_assignments aa
       JOIN organization_memberships om ON om.id = aa.membership_id
       JOIN users u ON u.id = om.user_id
       WHERE u.email = ? AND om.status = 'ACTIVE'
         AND aa.scope_type = 'PLAN' AND aa.scope_id = ?
         AND aa.capability IN ('MARKETING_CONTRIBUTE','TRADE_CONTRIBUTE','PLAN_INTEGRATE')
       LIMIT 1`,
    ).bind(email, planId).first<{ capability: string }>();
    if (!assignment) throw new Error("No tienes una asignación para este Plan");
  }
  return { plan, version };
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos guardar la aportación";
  const status = /Autenticación/.test(message) ? 401 : /asignación|autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const user = identity(request);
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await planFor(planId, user.email);
    const result = await database().prepare(
      `SELECT id, plan_id, version_id, owner_user_id, business_function, lever,
        title, source_mode, source_system, detail_level, assumption_quality,
        status, period_start, period_end, product_scope_json, gross_units,
        investment_amount, currency, evidence_json, created_at, updated_at,
        submitted_at
       FROM plan_contributions WHERE plan_id = ? ORDER BY updated_at DESC`,
    ).bind(planId).run<Record<string, unknown>>();
    return Response.json({ ok: true, contributions: result.results ?? [] });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = identity(request);
    const body = await request.json() as ContributionInput;
    const planId = body.planId ?? "";
    const { plan, version } = await planFor(planId, user.email);
    if (!["MARKETING", "TRADE_MARKETING"].includes(body.businessFunction ?? "")) throw new Error("Selecciona el área responsable");
    if (!body.lever?.trim() || !body.title?.trim()) throw new Error("Palanca y actividad son obligatorias");
    if (!["COMMITMENT","ESTIMATE","PROXY","IDEA"].includes(body.assumptionQuality ?? "")) throw new Error("Clasifica la calidad del supuesto");
    if (!/^\d{4}-\d{2}$/.test(body.periodStart ?? "") || !/^\d{4}-\d{2}$/.test(body.periodEnd ?? "")) throw new Error("Define el periodo de la aportación");
    if ((body.periodStart ?? "") > (body.periodEnd ?? "")) throw new Error("El periodo final no puede ser anterior al inicial");
    if (body.assumptionQuality !== "IDEA" && !(Number(body.grossUnits) > 0)) throw new Error("Una aportación cuantificada necesita volumen incremental");
    const now = new Date().toISOString();
    await database().prepare(
      `INSERT INTO users (id,email,display_name,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at`,
    ).bind(user.id, user.email, user.displayName, "ACTIVE", now, now).run();
    const id = `contribution:${crypto.randomUUID()}`;
    await database().prepare(
      `INSERT INTO plan_contributions
       (id,plan_id,version_id,owner_user_id,business_function,lever,title,
        source_mode,source_system,detail_level,assumption_quality,status,
        period_start,period_end,product_scope_json,account_scope_json,gross_units,
        investment_amount,currency,evidence_json,created_at,updated_at,submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).bind(
      id, planId, version.id, user.id, body.businessFunction, body.lever.trim(),
      body.title.trim(), "BUILT_IN_REVENUE", "REVENUE", "MINIMUM",
      body.assumptionQuality, "SUBMITTED", body.periodStart, body.periodEnd,
      JSON.stringify(body.productScope?.split(",").map((item) => item.trim()).filter(Boolean) ?? []),
      "[]", Number(body.grossUnits) || null, Number(body.investmentAmount) || null,
      body.currency || plan.currency, JSON.stringify({ note: body.evidence?.trim() ?? "" }),
      now, now, now,
    ).run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = identity(request);
    const body = await request.json() as { planId?: string; id?: string; status?: "ACCEPTED" | "RETURNED" };
    const planId = body.planId ?? "";
    await planFor(planId, user.email);
    if (!body.id || !["ACCEPTED","RETURNED"].includes(body.status ?? "")) throw new Error("Decisión inválida");
    const now = new Date().toISOString();
    const result = await database().prepare(
      "UPDATE plan_contributions SET status = ?, updated_at = ? WHERE id = ? AND plan_id = ? AND status = 'SUBMITTED'",
    ).bind(body.status, now, body.id, planId).run();
    if (!result.meta?.changes) throw new Error("La aportación ya fue decidida o no existe");
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
}
