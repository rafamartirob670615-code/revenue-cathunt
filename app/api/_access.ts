import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../application/d1-repository.ts";
import type { Capability, BusinessFunction, RevenueIdentity } from "../revenue/access.ts";
import type { Plan } from "../../domain/types.ts";

export const ASSIGNABLE_CAPABILITIES = [
  "MARKETING_CONTRIBUTE",
  "TRADE_CONTRIBUTE",
  "PLAN_INTEGRATE",
  "REVIEW",
  "APPROVE",
  "VIEW_FINANCIALS",
] as const satisfies readonly Capability[];

export type AssignableCapability = (typeof ASSIGNABLE_CAPABILITIES)[number];

export function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

export function requestIdentity(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!email) throw new Error("Autenticación requerida");
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  let displayName = email;
  if (encoded && encoding === "percent-encoded-utf-8") {
    try { displayName = decodeURIComponent(encoded); } catch { /* email is the safe fallback */ }
  }
  return { id: `user:${email}`, email, displayName };
}

export async function ensureUser(request: Request) {
  const actor = requestIdentity(request);
  const now = new Date().toISOString();
  await database().prepare(
    `INSERT INTO users (id,email,display_name,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,status='ACTIVE',updated_at=excluded.updated_at`,
  ).bind(actor.id, actor.email, actor.displayName, "ACTIVE", now, now).run();
  return actor;
}

export async function planRecord(planId: string) {
  const row = await database().prepare(
    "SELECT aggregate_json FROM plan_aggregates WHERE plan_id = ?",
  ).bind(planId).first<{ aggregate_json: string }>();
  if (!row) throw new Error("Plan no encontrado");
  const plan = JSON.parse(row.aggregate_json) as Plan;
  const ownerEmail = plan.versions[0]?.createdBy?.toLowerCase();
  if (!ownerEmail) throw new Error("El Plan no tiene responsable identificable");
  return { plan, ownerEmail };
}

export async function planCapabilities(email: string, planId: string): Promise<Capability[]> {
  const result = await database().prepare(
    `SELECT DISTINCT aa.capability
     FROM access_assignments aa
     JOIN organization_memberships om ON om.id = aa.membership_id
     JOIN users u ON u.id = om.user_id
     WHERE lower(u.email) = lower(?) AND u.status = 'ACTIVE' AND om.status = 'ACTIVE'
       AND aa.scope_type = 'PLAN' AND aa.scope_id = ?
       AND datetime(aa.valid_from) <= datetime('now')
       AND (aa.valid_until IS NULL OR datetime(aa.valid_until) >= datetime('now'))`,
  ).bind(email, planId).run<{ capability: Capability }>();
  return (result.results ?? []).map((row) => row.capability);
}

export async function authorizePlan(
  request: Request,
  planId: string,
  allowed: readonly Capability[] = [],
) {
  const actor = requestIdentity(request);
  const record = await planRecord(planId);
  const owner = actor.email === record.ownerEmail;
  const capabilities = await planCapabilities(actor.email, planId);
  if (!owner && !capabilities.length) throw new Error("No tienes una asignación para este Plan");
  if (allowed.length && !owner && !allowed.some((capability) => capabilities.includes(capability))) {
    throw new Error("No estás autorizado para realizar esta acción");
  }
  return { ...record, actor, owner, capabilities, dataOwnerId: record.ownerEmail };
}

export async function resolveRevenueIdentity(request: Request): Promise<RevenueIdentity> {
  const actor = await ensureUser(request);
  const rows = await database().prepare(
    `SELECT DISTINCT om.business_function, aa.capability
     FROM organization_memberships om
     JOIN access_assignments aa ON aa.membership_id = om.id
     WHERE om.user_id = ? AND om.status = 'ACTIVE'
       AND datetime(aa.valid_from) <= datetime('now')
       AND (aa.valid_until IS NULL OR datetime(aa.valid_until) >= datetime('now'))`,
  ).bind(actor.id).run<{ business_function: BusinessFunction; capability: Capability }>();
  const functions = [...new Set((rows.results ?? []).map((row) => row.business_function))];
  const capabilities = [...new Set((rows.results ?? []).map((row) => row.capability))];
  const owned = await database().prepare(
    `SELECT 1 AS owned FROM plan_aggregates
     WHERE lower(json_extract(aggregate_json,'$.versions[0].createdBy'))=lower(?) LIMIT 1`,
  ).bind(actor.email).first<{ owned: number }>();
  if (owned) {
    for (const capability of ["PLAN_CREATE", "PLAN_INTEGRATE", "BASELINE_REVIEW", "MONITOR", "ADMINISTER_ACCESS"] as Capability[]) {
      if (!capabilities.includes(capability)) capabilities.push(capability);
    }
  }
  return {
    displayName: actor.displayName,
    email: actor.email,
    authenticated: true,
    functions: functions.length ? functions : ["PLAN_OWNER"],
    capabilities,
  };
}

export function accessError(error: unknown, fallback = "No pudimos completar la acción") {
  const message = error instanceof Error ? error.message : fallback;
  const status = /Autenticación/.test(message) ? 401
    : /asignación|autorizado/.test(message) ? 403
      : /no encontrado/.test(message) ? 404 : 422;
  return Response.json({ ok: false, error: message }, { status });
}
