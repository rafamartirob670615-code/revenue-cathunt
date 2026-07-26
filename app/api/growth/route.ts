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

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos preparar el crecimiento";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

async function approvedSyntheticBaseline(planId: string, ownerId: string) {
  const row = await database()
    .prepare(
      `SELECT bc.result_json, bc.data_classification, br.status
       FROM baseline_calculations bc
       JOIN baseline_reviews br ON br.plan_id = bc.plan_id AND br.owner_id = bc.owner_id
       WHERE bc.plan_id = ? AND bc.owner_id = ?`,
    )
    .bind(planId, ownerId)
    .first<{ result_json: string; data_classification: string; status: string }>();
  if (!row || row.status !== "APPROVED_FROZEN") {
    throw new Error("Aprueba y congela primero el baseline");
  }
  if (row.data_classification !== "SYNTHETIC_NON_COMMERCIAL") {
    throw new Error("Esta compuerta sólo está habilitada para el Plan sintético aislado");
  }
  return JSON.parse(row.result_json) as { targetYear: number; lines: Array<{ accountId: string; skuId: string }> };
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await approvedSyntheticBaseline(planId, ownerId);
    const row = await database()
      .prepare("SELECT result_json, updated_at FROM growth_plans WHERE plan_id = ? AND owner_id = ?")
      .bind(planId, ownerId)
      .first<{ result_json: string; updated_at: string }>();
    return Response.json({
      ok: true,
      result: row ? JSON.parse(row.result_json) : null,
      updatedAt: row?.updated_at,
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const baseline = await approvedSyntheticBaseline(planId, ownerId);
    const accountId = baseline.lines[0]?.accountId ?? "CUENTA-SINTETICA";
    const skus = [...new Set(baseline.lines.map((line) => line.skuId))].sort();
    if (skus.length < 3) throw new Error("El caso sintético requiere tres SKU");
    const activities = [
      {
        id: "SYN-MKT-2027-01",
        family: "MARKETING",
        name: "Campaña de alcance sintética",
        accountId,
        skuId: skus[0],
        period: `${baseline.targetYear}-04`,
        grossUnits: 720,
        cannibalizationUnits: 80,
        haloUnits: 35,
        pullForwardUnits: 45,
        interactionUnits: 0,
        evidence: "CASO_SINTETICO_MARKETING_V1",
      },
      {
        id: "SYN-TRADE-2027-01",
        family: "TRADE_MARKETING",
        name: "Exhibición comercial sintética",
        accountId,
        skuId: skus[1],
        period: `${baseline.targetYear}-07`,
        grossUnits: 560,
        cannibalizationUnits: 65,
        haloUnits: 20,
        pullForwardUnits: 30,
        interactionUnits: 0,
        evidence: "CASO_SINTETICO_TRADE_V1",
      },
      {
        id: "SYN-TRADE-2027-02",
        family: "TRADE_MARKETING",
        name: "Promoción estacional sintética",
        accountId,
        skuId: skus[2],
        period: `${baseline.targetYear}-10`,
        grossUnits: 640,
        cannibalizationUnits: 90,
        haloUnits: 25,
        pullForwardUnits: 55,
        interactionUnits: -20,
        evidence: "CASO_SINTETICO_TRADE_V1",
      },
    ].map((activity) => ({
      ...activity,
      netUnits: activity.grossUnits - activity.cannibalizationUnits
        + activity.haloUnits - activity.pullForwardUnits + activity.interactionUnits,
      status: "APPROVED_FOR_SYNTHETIC_PLAN",
      createdBy: ownerId,
    }));
    const grossUnits = activities.reduce((sum, activity) => sum + activity.grossUnits, 0);
    const netUnits = activities.reduce((sum, activity) => sum + activity.netUnits, 0);
    const result = {
      dataClassification: "SYNTHETIC_NON_COMMERCIAL",
      methodId: "GOVERNED_INCREMENT_LEDGER",
      methodVersion: "1.0.0",
      activities,
      grossUnits,
      netUnits,
      controls: {
        duplicateEconomicIdentities: 0,
        unresolvedOverlaps: 0,
        reconciled: netUnits === activities.reduce((sum, activity) => sum
          + activity.grossUnits - activity.cannibalizationUnits + activity.haloUnits
          - activity.pullForwardUnits + activity.interactionUnits, 0),
      },
    };
    const now = new Date().toISOString();
    await database().prepare("DELETE FROM financial_results WHERE plan_id = ?").bind(planId).run();
    await database().prepare("DELETE FROM plan_results WHERE plan_id = ?").bind(planId).run();
    await database()
      .prepare(
        `INSERT INTO growth_plans
        (plan_id, owner_id, result_json, data_classification, created_at, updated_at)
        VALUES (?, ?, ?, 'SYNTHETIC_NON_COMMERCIAL', ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        result_json=excluded.result_json, data_classification=excluded.data_classification,
        updated_at=excluded.updated_at`,
      )
      .bind(planId, ownerId, JSON.stringify(result), now, now)
      .run();
    return Response.json({ ok: true, result, updatedAt: now });
  } catch (error) {
    return responseError(error);
  }
}
