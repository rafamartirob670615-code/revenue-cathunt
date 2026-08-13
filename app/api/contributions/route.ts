import { accessError, authorizePlan, ensureUser, requestIdentity } from "../_access.ts";
import { database } from "../_infrastructure.ts";

export const runtime = "nodejs";

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

function responseError(error: unknown) {
  return accessError(error, "No pudimos guardar la aportación");
}

export async function GET(request: Request) {
  try {
    requestIdentity(request);
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await authorizePlan(request, planId);
    const result = await database().prepare(
      `SELECT pc.id, pc.plan_id, pc.version_id, pc.owner_user_id, u.display_name AS owner_display_name, pc.business_function, pc.lever,
        pc.title, pc.source_mode, pc.source_system, pc.detail_level, pc.assumption_quality,
        pc.status, pc.period_start, pc.period_end, pc.product_scope_json, pc.gross_units,
        pc.investment_amount, pc.currency, pc.evidence_json, pc.created_at, pc.updated_at,
        pc.submitted_at
       FROM plan_contributions pc JOIN users u ON u.id=pc.owner_user_id
       WHERE pc.plan_id = ? ORDER BY pc.updated_at DESC`,
    ).bind(planId).run<Record<string, unknown>>();
    return Response.json({ ok: true, contributions: result.results ?? [] });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser(request);
    const body = await request.json() as ContributionInput;
    const planId = body.planId ?? "";
    const requiredCapability = body.businessFunction === "MARKETING" ? "MARKETING_CONTRIBUTE" : "TRADE_CONTRIBUTE";
    const { plan } = await authorizePlan(request, planId, [requiredCapability]);
    const version = plan.versions.at(-1);
    if (!version) throw new Error("El Plan no tiene una versión activa");
    if (!["MARKETING", "TRADE_MARKETING"].includes(body.businessFunction ?? "")) throw new Error("Selecciona el área responsable");
    if (!body.lever?.trim() || !body.title?.trim()) throw new Error("Palanca y actividad son obligatorias");
    if (!["COMMITMENT","ESTIMATE","PROXY","IDEA"].includes(body.assumptionQuality ?? "")) throw new Error("Clasifica la calidad del supuesto");
    if (!/^\d{4}-\d{2}$/.test(body.periodStart ?? "") || !/^\d{4}-\d{2}$/.test(body.periodEnd ?? "")) throw new Error("Define el periodo de la aportación");
    if ((body.periodStart ?? "") > (body.periodEnd ?? "")) throw new Error("El periodo final no puede ser anterior al inicial");
    if (body.assumptionQuality !== "IDEA" && !(Number(body.grossUnits) > 0)) throw new Error("Una aportación cuantificada necesita volumen incremental");
    const now = new Date().toISOString();
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
    requestIdentity(request);
    const body = await request.json() as { planId?: string; id?: string; status?: "ACCEPTED" | "RETURNED" };
    const planId = body.planId ?? "";
    await authorizePlan(request, planId, ["PLAN_INTEGRATE"]);
    if (!body.id || !["ACCEPTED","RETURNED"].includes(body.status ?? "")) throw new Error("Decisión inválida");
    const now = new Date().toISOString();
    const result = await database().prepare(
      "UPDATE plan_contributions SET status = ?, updated_at = ? WHERE id = ? AND plan_id = ? AND status = 'SUBMITTED'",
    ).bind(body.status, now, body.id, planId).run();
    if (!result.meta?.changes) throw new Error("La aportación ya fue decidida o no existe");
    if (body.status === "ACCEPTED") {
      await database().prepare("DELETE FROM financial_results WHERE plan_id = ?").bind(planId).run();
      await database().prepare("DELETE FROM plan_results WHERE plan_id = ?").bind(planId).run();
      await database().prepare("DELETE FROM growth_plans WHERE plan_id = ?").bind(planId).run();
    }
    return Response.json({ ok: true });
  } catch (error) {
    return responseError(error);
  }
}
