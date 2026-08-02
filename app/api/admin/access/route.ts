import type { BusinessFunction } from "../../../revenue/access.ts";
import {
  accessError,
  ASSIGNABLE_CAPABILITIES,
  authorizePlan,
  database,
  ensureUser,
  planRecord,
  requestIdentity,
  type AssignableCapability,
} from "../../_access.ts";

export const runtime = "edge";

const FUNCTION_BY_CAPABILITY: Record<AssignableCapability, BusinessFunction> = {
  MARKETING_CONTRIBUTE: "MARKETING",
  TRADE_CONTRIBUTE: "TRADE_MARKETING",
  PLAN_INTEGRATE: "PLAN_OWNER",
  REVIEW: "APPROVER",
  APPROVE: "APPROVER",
  VIEW_FINANCIALS: "FINANCE",
  ADMINISTER_ACCESS: "ADMINISTRATOR",
};

async function requireAdministrator(request: Request, planId?: string) {
  const actor = requestIdentity(request);
  if (actor.email === "pilot@revenue.local") return actor;
  if (planId) {
    const { ownerEmail } = await planRecord(planId);
    if (actor.email === ownerEmail) throw new Error("Sólo el administrador puede usar Administración");
  }
  const row = await database().prepare(
    `SELECT 1 AS allowed
     FROM access_assignments aa
     JOIN organization_memberships om ON om.id = aa.membership_id
     JOIN users u ON u.id = om.user_id
     WHERE lower(u.email)=lower(?) AND aa.capability='ADMINISTER_ACCESS'
       AND (aa.scope_type='ORGANIZATION' OR (aa.scope_type='PLAN' AND aa.scope_id=?))
       AND om.status='ACTIVE' LIMIT 1`,
  ).bind(actor.email, planId ?? "").first<{ allowed: number }>();
  if (!row) throw new Error("No estás autorizado para administrar accesos");
  return actor;
}

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    await requireAdministrator(request, planId || undefined);
    if (!planId) {
      const [users, plans] = await Promise.all([
        database().prepare(`SELECT u.email,u.display_name,om.business_function,aa.capability,aa.scope_type,aa.scope_id,aa.valid_from,aa.valid_until FROM users u LEFT JOIN organization_memberships om ON om.user_id=u.id AND om.status='ACTIVE' LEFT JOIN access_assignments aa ON aa.membership_id=om.id ORDER BY u.display_name,aa.capability`).run<Record<string, unknown>>(),
        database().prepare("SELECT aggregate_json FROM plan_aggregates ORDER BY updated_at DESC").run<{ aggregate_json: string }>(),
      ]);
      return Response.json({ ok: true, users: users.results ?? [], plans: (plans.results ?? []).map((row) => { const plan = JSON.parse(row.aggregate_json) as { id: string; companyName?: string; accountName?: string; year: number; organizationId: string }; return { id: plan.id, company: plan.companyName ?? "", account: plan.accountName ?? "", year: plan.year, organizationId: plan.organizationId }; }), assignableCapabilities: ASSIGNABLE_CAPABILITIES });
    }
    const result = await database().prepare(
      `SELECT u.email,u.display_name,om.business_function,aa.capability,aa.valid_from,aa.valid_until
       FROM access_assignments aa
       JOIN organization_memberships om ON om.id=aa.membership_id
       JOIN users u ON u.id=om.user_id
       WHERE aa.scope_type='PLAN' AND aa.scope_id=?
       ORDER BY u.display_name,aa.capability`,
    ).bind(planId).run<Record<string, unknown>>();
    return Response.json({ ok: true, assignments: result.results ?? [], assignableCapabilities: ASSIGNABLE_CAPABILITIES });
  } catch (error) { return accessError(error, "No pudimos recuperar los accesos"); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      planId?: string; email?: string; displayName?: string; capability?: AssignableCapability;
    };
    const planId = body.planId ?? "";
    if ((!planId && body.capability !== "ADMINISTER_ACCESS") || !body.email?.trim() || !ASSIGNABLE_CAPABILITIES.includes(body.capability as AssignableCapability)) {
      throw new Error("Cuenta, usuario y capacidad son obligatorios");
    }
    const admin = await requireAdministrator(request, planId || undefined);
    const plan = planId ? (await authorizePlan(request, planId)).plan : { organizationId: "revenue-pilot" };
    const email = body.email.trim().toLowerCase();
    const userId = `user:${email}`;
    const capability = body.capability as AssignableCapability;
    const businessFunction = FUNCTION_BY_CAPABILITY[capability];
    const now = new Date().toISOString();
    await ensureUser(request);
    await database().prepare(
      `INSERT INTO users (id,email,display_name,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,status='ACTIVE',updated_at=excluded.updated_at`,
    ).bind(userId, email, body.displayName?.trim() || email, "ACTIVE", now, now).run();
    const membershipId = `membership:${plan.organizationId}:${userId}:${businessFunction}`;
    await database().prepare(
      `INSERT INTO organization_memberships
       (id,organization_id,user_id,business_function,status,granted_by,granted_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(organization_id,user_id,business_function)
       DO UPDATE SET status='ACTIVE',granted_by=excluded.granted_by,granted_at=excluded.granted_at`,
    ).bind(membershipId, plan.organizationId, userId, businessFunction, "ACTIVE", admin.email, now).run();
    await database().prepare(
      `INSERT INTO access_assignments
       (id,membership_id,capability,scope_type,scope_id,sensitivity_json,valid_from,valid_until,granted_by)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(membership_id,capability,scope_type,scope_id)
       DO UPDATE SET valid_from=excluded.valid_from,valid_until=NULL,granted_by=excluded.granted_by`,
    ).bind(
      `assignment:${membershipId}:${capability}:${capability === "ADMINISTER_ACCESS" ? "ORGANIZATION" : "PLAN"}:${planId || plan.organizationId}`, membershipId, capability,
      capability === "ADMINISTER_ACCESS" ? "ORGANIZATION" : "PLAN", planId || plan.organizationId, capability === "VIEW_FINANCIALS" ? '["FINANCIALS"]' : "[]", now, null, admin.email,
    ).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return accessError(error, "No pudimos conceder el acceso"); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { planId?: string; email?: string; capability?: AssignableCapability };
    const planId = body.planId ?? "";
    if (!planId || !body.email || !ASSIGNABLE_CAPABILITIES.includes(body.capability as AssignableCapability)) {
      throw new Error("Plan, usuario y capacidad son obligatorios");
    }
    await requireAdministrator(request, planId);
    await database().prepare(
      `DELETE FROM access_assignments
       WHERE scope_type='PLAN' AND scope_id=? AND capability=?
         AND membership_id IN (
           SELECT om.id FROM organization_memberships om
           JOIN users u ON u.id=om.user_id WHERE lower(u.email)=lower(?)
         )`,
    ).bind(planId, body.capability, body.email).run();
    return Response.json({ ok: true });
  } catch (error) { return accessError(error, "No pudimos retirar el acceso"); }
}
