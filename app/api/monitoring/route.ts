import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";

export const runtime = "edge";

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function owner(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? undefined;
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const aggregate = await database()
      .prepare("SELECT aggregate_json, updated_at FROM plan_aggregates WHERE plan_id = ?")
      .bind(planId)
      .first<{ aggregate_json: string; updated_at: string }>();
    if (!aggregate) throw new Error("Plan no encontrado");
    const plan = JSON.parse(aggregate.aggregate_json) as {
      companyName?: string; companyId: string; accountName?: string; accountId: string;
      year: number; currency: string; versions: Array<{ number: number; status: string; createdBy: string }>;
    };
    if (plan.versions[0]?.createdBy !== ownerId) throw new Error("Plan no autorizado");
    const active = plan.versions.at(-1);
    if (!active || !["SUBMITTED", "COMMERCIAL_APPROVED", "FINANCE_VALIDATED", "OFFICIAL"].includes(active.status)) {
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
      result: result ? JSON.parse(result.result_json) : null,
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
    const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
    return Response.json({ ok: false, error: message }, { status });
  }
}
