import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";

export const runtime = "edge";
type DataClassification = "USER_PROVIDED" | "SYNTHETIC_NON_COMMERCIAL";
interface R2ObjectLike { text(): Promise<string> }
interface R2BucketLike { get(key: string): Promise<R2ObjectLike | null> }

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}
function files(): R2BucketLike {
  if (!env.FILES) throw new Error("Almacenamiento de archivos no disponible");
  return env.FILES as unknown as R2BucketLike;
}
function owner(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? undefined;
}
function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos preparar el crecimiento";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

async function approvedBaseline(planId: string, ownerId: string) {
  const row = await database().prepare(
    `SELECT bc.result_json, bc.data_classification, br.status
     FROM baseline_calculations bc
     JOIN baseline_reviews br ON br.plan_id = bc.plan_id AND br.owner_id = bc.owner_id
     WHERE bc.plan_id = ? AND bc.owner_id = ?`,
  ).bind(planId, ownerId).first<{
    result_json: string; data_classification: DataClassification; status: string;
  }>();
  if (!row || row.status !== "APPROVED_FROZEN") throw new Error("Aprueba y congela primero el baseline");
  return {
    ...(JSON.parse(row.result_json) as { targetYear: number; lines: Array<{ accountId: string; skuId: string }> }),
    dataClassification: row.data_classification,
  };
}

interface EditableActivity {
  id?: string; family?: "MARKETING" | "TRADE_MARKETING"; name?: string;
  accountId?: string; skuId?: string; period?: string; grossUnits?: number;
  cannibalizationUnits?: number; haloUnits?: number; pullForwardUnits?: number;
  interactionUnits?: number; evidence?: string;
}

function reconcileActivities(input: EditableActivity[], ownerId: string, classification: DataClassification) {
  if (input.length === 0) throw new Error("Agrega al menos una actividad");
  const ids = new Set<string>();
  const identities = new Set<string>();
  let duplicateEconomicIdentities = 0;
  const activities = input.map((item, index) => {
    const id = item.id?.trim() || `ACT-${index + 1}`;
    if (ids.has(id)) throw new Error(`Identificador duplicado: ${id}`);
    ids.add(id);
    if (item.family !== "MARKETING" && item.family !== "TRADE_MARKETING") throw new Error(`Familia inválida en ${id}`);
    if (!item.name?.trim() || !item.accountId?.trim() || !item.skuId?.trim()) throw new Error(`Actividad incompleta: ${id}`);
    if (!/^\d{4}-\d{2}$/.test(item.period ?? "")) throw new Error(`Periodo inválido en ${id}`);
    if (!item.evidence?.trim()) throw new Error(`Evidencia obligatoria en ${id}`);
    const values = [item.grossUnits, item.cannibalizationUnits, item.haloUnits, item.pullForwardUnits, item.interactionUnits].map(Number);
    if (values.some((value) => !Number.isFinite(value))) throw new Error(`Valores inválidos en ${id}`);
    if (values.slice(0, 4).some((value) => value < 0)) throw new Error(`Bruto, canibalización, halo y compra anticipada no pueden ser negativos en ${id}`);
    const [grossUnits, cannibalizationUnits, haloUnits, pullForwardUnits, interactionUnits] = values;
    const identity = `${item.accountId.trim()}|${item.skuId.trim()}|${item.period}|${item.family}|${item.name.trim().toLowerCase()}`;
    if (identities.has(identity)) duplicateEconomicIdentities += 1;
    identities.add(identity);
    return {
      id, family: item.family, name: item.name.trim(), accountId: item.accountId.trim(),
      skuId: item.skuId.trim(), period: item.period, grossUnits, cannibalizationUnits,
      haloUnits, pullForwardUnits, interactionUnits,
      netUnits: grossUnits - cannibalizationUnits + haloUnits - pullForwardUnits + interactionUnits,
      evidence: item.evidence.trim(),
      status: classification === "USER_PROVIDED" ? "IMPORTED_FROM_APPROVED_SOURCE" : "APPROVED_FOR_SYNTHETIC_PLAN",
      createdBy: ownerId,
    };
  });
  const grossUnits = activities.reduce((sum, activity) => sum + activity.grossUnits, 0);
  const netUnits = activities.reduce((sum, activity) => sum + activity.netUnits, 0);
  return {
    dataClassification: classification,
    methodId: "GOVERNED_INCREMENT_LEDGER",
    methodVersion: "2.0.0",
    activities, grossUnits, netUnits,
    controls: {
      duplicateEconomicIdentities,
      unresolvedOverlaps: duplicateEconomicIdentities,
      reconciled: duplicateEconomicIdentities === 0 && netUnits === activities.reduce(
        (sum, activity) => sum + activity.grossUnits - activity.cannibalizationUnits
          + activity.haloUnits - activity.pullForwardUnits + activity.interactionUnits, 0),
    },
  };
}

function periodsBetween(start: string, end: string) {
  const result: string[] = [];
  let [year, month] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    result.push(`${year}-${String(month).padStart(2,"0")}`);
    month += 1;
    if (month === 13) { month = 1; year += 1; }
  }
  return result;
}

async function realActivities(
  planId: string,
  ownerId: string,
  baseline: { lines: Array<{ accountId: string; skuId: string }> },
) {
  const result = await database().prepare(
    `SELECT requirement_id, canonical_object_key, status
     FROM canonical_datasets
     WHERE plan_id = ? AND owner_id = ? AND requirement_id IN ('marketing-plan','trade-marketing-plan')`,
  ).bind(planId, ownerId).run<{ requirement_id: string; canonical_object_key: string; status: string }>();
  const rows = result.results ?? [];
  const activities: EditableActivity[] = [];
  for (const row of rows) {
    const object = await files().get(row.canonical_object_key);
    if (!object) throw new Error(`No encontramos el dataset canónico de ${row.requirement_id}`);
    const payload = JSON.parse(await object.text()) as { rows?: EditableActivity[] };
    activities.push(...(payload.rows ?? []));
  }
  const contributionResult = await database().prepare(
    `SELECT id,business_function,title,period_start,period_end,product_scope_json,
      gross_units,evidence_json FROM plan_contributions
     WHERE plan_id = ? AND status = 'ACCEPTED'
       AND business_function IN ('MARKETING','TRADE_MARKETING')`,
  ).bind(planId).run<{
    id:string; business_function:"MARKETING"|"TRADE_MARKETING"; title:string;
    period_start:string; period_end:string; product_scope_json:string;
    gross_units:number|null; evidence_json:string;
  }>();
  const baselineSkus = [...new Set(baseline.lines.map((line) => line.skuId))];
  const accountId = baseline.lines[0]?.accountId;
  for (const contribution of contributionResult.results ?? []) {
    if (!contribution.gross_units || !accountId) continue;
    const requested = JSON.parse(contribution.product_scope_json || "[]") as string[];
    const skus = requested.filter((sku) => baselineSkus.includes(sku));
    const allocatedSkus = skus.length ? skus : baselineSkus;
    const periods = periodsBetween(contribution.period_start, contribution.period_end);
    const grainCount = Math.max(1, allocatedSkus.length * periods.length);
    const units = contribution.gross_units / grainCount;
    const note = (JSON.parse(contribution.evidence_json || "{}") as { note?: string }).note;
    for (const period of periods) for (const skuId of allocatedSkus) {
      activities.push({
        id: `${contribution.id}:${period}:${skuId}`,
        family: contribution.business_function,
        name: contribution.title,
        accountId,
        skuId,
        period,
        grossUnits: units,
        cannibalizationUnits: 0,
        haloUnits: 0,
        pullForwardUnits: 0,
        interactionUnits: 0,
        evidence: note || `Aportación aceptada ${contribution.id}`,
      });
    }
  }
  const hasMarketing = activities.some((item) => item.family === "MARKETING");
  const hasTrade = activities.some((item) => item.family === "TRADE_MARKETING");
  if (!hasMarketing || !hasTrade) {
    throw new Error("Marketing y Trade deben entregar al menos una fuente o aportación aceptada");
  }
  return activities;
}

function syntheticActivities(baseline: { targetYear: number; lines: Array<{ accountId: string; skuId: string }> }) {
  const accountId = baseline.lines[0]?.accountId ?? "CUENTA-SINTETICA";
  const skus = [...new Set(baseline.lines.map((line) => line.skuId))].sort();
  if (skus.length < 3) throw new Error("El caso sintético requiere tres SKU");
  return [
    { id:"SYN-MKT-2027-01", family:"MARKETING" as const, name:"Campaña de alcance sintética", accountId, skuId:skus[0], period:`${baseline.targetYear}-04`, grossUnits:720, cannibalizationUnits:80, haloUnits:35, pullForwardUnits:45, interactionUnits:0, evidence:"CASO_SINTETICO_MARKETING_V1" },
    { id:"SYN-TRADE-2027-01", family:"TRADE_MARKETING" as const, name:"Exhibición comercial sintética", accountId, skuId:skus[1], period:`${baseline.targetYear}-07`, grossUnits:560, cannibalizationUnits:65, haloUnits:20, pullForwardUnits:30, interactionUnits:0, evidence:"CASO_SINTETICO_TRADE_V1" },
    { id:"SYN-TRADE-2027-02", family:"TRADE_MARKETING" as const, name:"Promoción estacional sintética", accountId, skuId:skus[2], period:`${baseline.targetYear}-10`, grossUnits:640, cannibalizationUnits:90, haloUnits:25, pullForwardUnits:55, interactionUnits:-20, evidence:"CASO_SINTETICO_TRADE_V1" },
  ];
}

async function persistGrowth(planId: string, ownerId: string, result: ReturnType<typeof reconcileActivities>) {
  const now = new Date().toISOString();
  await database().prepare("DELETE FROM financial_results WHERE plan_id = ?").bind(planId).run();
  await database().prepare("DELETE FROM plan_results WHERE plan_id = ?").bind(planId).run();
  await database().prepare(
    `INSERT INTO growth_plans (plan_id, owner_id, result_json, data_classification, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id, result_json=excluded.result_json,
     data_classification=excluded.data_classification, updated_at=excluded.updated_at`,
  ).bind(planId, ownerId, JSON.stringify(result), result.dataClassification, now, now).run();
  return now;
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await approvedBaseline(planId, ownerId);
    const row = await database().prepare(
      "SELECT result_json, updated_at FROM growth_plans WHERE plan_id = ? AND owner_id = ?",
    ).bind(planId, ownerId).first<{ result_json: string; updated_at: string }>();
    return Response.json({ ok:true, result:row ? JSON.parse(row.result_json) : null, updatedAt:row?.updated_at });
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = await request.json() as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const baseline = await approvedBaseline(planId, ownerId);
    const activities = baseline.dataClassification === "USER_PROVIDED"
      ? await realActivities(planId, ownerId, baseline)
      : syntheticActivities(baseline);
    const result = reconcileActivities(activities, ownerId, baseline.dataClassification);
    const updatedAt = await persistGrowth(planId, ownerId, result);
    return Response.json({ ok:true, result, updatedAt });
  } catch (error) { return responseError(error); }
}

export async function PUT(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = await request.json() as { planId?: string; activities?: EditableActivity[] };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const baseline = await approvedBaseline(planId, ownerId);
    const result = reconcileActivities(body.activities ?? [], ownerId, baseline.dataClassification);
    const updatedAt = await persistGrowth(planId, ownerId, result);
    return Response.json({ ok:true, result, updatedAt });
  } catch (error) { return responseError(error); }
}
