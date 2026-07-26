import { env } from "cloudflare:workers";
import { calculateBaselineFromAcceptedPackage } from "../../../domain/baseline-engine.ts";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";

export const runtime = "edge";

interface StoredObject {
  text(): Promise<string>;
}

interface R2BucketLike {
  get(key: string): Promise<StoredObject | null>;
}

function owner(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? undefined;
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
  const message = error instanceof Error ? error.message : "No pudimos calcular el baseline";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

async function planForOwner(planId: string, ownerId: string) {
  const row = await database()
    .prepare("SELECT aggregate_json FROM plan_aggregates WHERE plan_id = ?")
    .bind(planId)
    .first<{ aggregate_json: string }>();
  if (!row) throw new Error("Plan no encontrado");
  const plan = JSON.parse(row.aggregate_json) as {
    year: number;
    versions?: Array<{ createdBy?: string }>;
  };
  if (plan.versions?.[0]?.createdBy !== ownerId) throw new Error("Plan no autorizado");
  return plan;
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await planForOwner(planId, ownerId);
    const row = await database()
      .prepare(
        "SELECT result_json, data_classification, calculated_at FROM baseline_calculations WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .first<{ result_json: string; data_classification: string; calculated_at: string }>();
    const review = await database()
      .prepare(
        "SELECT review_json FROM baseline_reviews WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .first<{ review_json: string }>();
    return Response.json({
      ok: true,
      result: row ? JSON.parse(row.result_json) : null,
      review: review ? JSON.parse(review.review_json) : null,
      calculatedAt: row?.calculated_at,
      synthetic: row?.data_classification === "SYNTHETIC_NON_COMMERCIAL",
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
    const plan = await planForOwner(planId, ownerId);
    const review = await database()
      .prepare("SELECT file_checksums_json FROM input_package_reviews WHERE plan_id = ? AND owner_id = ? AND status = 'ACCEPTED'")
      .bind(planId, ownerId)
      .first<{ file_checksums_json: string }>();
    if (!review) throw new Error("Acepta primero el paquete completo");

    const inputRows = await database()
      .prepare(
        "SELECT requirement_id, original_name, object_key, checksum FROM input_package_files WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .run<{ requirement_id: string; original_name: string; object_key: string; checksum: string }>();
    const rows = inputRows.results ?? [];
    const expectedChecksums = JSON.parse(review.file_checksums_json) as Record<string, string>;
    if (rows.some((row) => expectedChecksums[row.requirement_id] !== row.checksum)) {
      throw new Error("El paquete cambió después de aceptarse; vuelve a revisarlo");
    }
    const salesRow = rows.find((row) => row.requirement_id === "sales-history");
    if (!salesRow) throw new Error("Falta la historia de ventas aceptada");
    const activityRow = rows.find((row) => row.requirement_id === "activity-history");
    const salesObject = await files().get(salesRow.object_key);
    const activityObject = activityRow ? await files().get(activityRow.object_key) : null;
    if (!salesObject) throw new Error("No fue posible leer la historia aceptada");
    const synthetic = rows.every((row) => row.original_name.startsWith("SINTETICO_NO_COMERCIAL_"));
    const result = calculateBaselineFromAcceptedPackage({
      salesCsv: await salesObject.text(),
      activitiesCsv: activityObject ? await activityObject.text() : undefined,
      targetYear: plan.year,
      synthetic,
    });
    const calculatedAt = new Date().toISOString();
    await database().prepare("DELETE FROM plan_results WHERE plan_id = ?").bind(planId).run();
    await database().prepare("DELETE FROM growth_plans WHERE plan_id = ?").bind(planId).run();
    await database().prepare("DELETE FROM baseline_reviews WHERE plan_id = ?").bind(planId).run();
    await database()
      .prepare(
        `INSERT INTO baseline_calculations
        (plan_id, owner_id, result_json, data_classification, input_checksums_json, calculated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        result_json=excluded.result_json, data_classification=excluded.data_classification,
        input_checksums_json=excluded.input_checksums_json, calculated_at=excluded.calculated_at`,
      )
      .bind(
        planId,
        ownerId,
        JSON.stringify(result),
        result.dataClassification,
        review.file_checksums_json,
        calculatedAt,
      )
      .run();
    return Response.json({ ok: true, result, calculatedAt, synthetic });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = (await request.json()) as {
      planId?: string;
      proposedAnnualUnits?: number;
      reason?: string;
      evidence?: string;
    };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await planForOwner(planId, ownerId);
    const calculation = await database()
      .prepare(
        "SELECT result_json, calculated_at FROM baseline_calculations WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .first<{ result_json: string; calculated_at: string }>();
    if (!calculation) throw new Error("Calcula primero el baseline");
    const proposedAnnualUnits = Number(body.proposedAnnualUnits);
    if (!Number.isFinite(proposedAnnualUnits) || proposedAnnualUnits <= 0) {
      throw new Error("El valor ajustado debe ser mayor que cero");
    }
    if (!body.reason?.trim()) throw new Error("El motivo del ajuste es obligatorio");
    if (!body.evidence?.trim()) throw new Error("La evidencia del ajuste es obligatoria");
    const result = JSON.parse(calculation.result_json) as {
      annualUnits: number;
      lines: Array<{ calculatedUnits: number }>;
      methodId: string;
      methodVersion: string;
    };
    const ratio = proposedAnnualUnits / result.annualUnits;
    let assigned = 0;
    const adjustedLines = result.lines.map((line, index) => {
      const adjustedUnits = index === result.lines.length - 1
        ? Math.round(proposedAnnualUnits - assigned)
        : Math.round(line.calculatedUnits * ratio);
      assigned += adjustedUnits;
      return { ...line, adjustedUnits };
    });
    const decidedAt = new Date().toISOString();
    const review = {
      status: "ADJUSTMENT_PROPOSED",
      decision: "ADJUSTED",
      calculatedAnnualUnits: result.annualUnits,
      adjustedAnnualUnits: proposedAnnualUnits,
      approvedAnnualUnits: null,
      adjustedLines,
      reason: body.reason.trim(),
      evidence: body.evidence.trim(),
      decidedBy: ownerId,
      decidedAt,
      frozenAt: null,
      methodId: result.methodId,
      methodVersion: result.methodVersion,
    };
    await database()
      .prepare(
        `INSERT INTO baseline_reviews
        (plan_id, owner_id, calculation_calculated_at, status, decision, review_json, decided_by, decided_at, frozen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        calculation_calculated_at=excluded.calculation_calculated_at, status=excluded.status,
        decision=excluded.decision, review_json=excluded.review_json,
        decided_by=excluded.decided_by, decided_at=excluded.decided_at, frozen_at=NULL`,
      )
      .bind(
        planId,
        ownerId,
        calculation.calculated_at,
        review.status,
        review.decision,
        JSON.stringify(review),
        ownerId,
        decidedAt,
      )
      .run();
    return Response.json({ ok: true, review });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = (await request.json()) as {
      planId?: string;
      decision?: "CALCULATED" | "ADJUSTED";
    };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await planForOwner(planId, ownerId);
    const calculation = await database()
      .prepare(
        "SELECT result_json, data_classification, calculated_at FROM baseline_calculations WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .first<{ result_json: string; data_classification: string; calculated_at: string }>();
    if (!calculation) throw new Error("Calcula primero el baseline");
    const result = JSON.parse(calculation.result_json) as {
      annualUnits: number;
      lines: Array<{ calculatedUnits: number }>;
      methodId: string;
      methodVersion: string;
    };
    const existing = await database()
      .prepare("SELECT review_json FROM baseline_reviews WHERE plan_id = ? AND owner_id = ?")
      .bind(planId, ownerId)
      .first<{ review_json: string }>();
    const proposed = existing ? JSON.parse(existing.review_json) as {
      status: string;
      adjustedAnnualUnits?: number;
      adjustedLines?: Array<{ adjustedUnits: number }>;
      reason?: string;
      evidence?: string;
    } : null;
    if (body.decision === "ADJUSTED" && proposed?.status !== "ADJUSTMENT_PROPOSED") {
      throw new Error("Propón y documenta el ajuste antes de aprobarlo");
    }
    const frozenAt = new Date().toISOString();
    const adjusted = body.decision === "ADJUSTED";
    const review = {
      status: "APPROVED_FROZEN",
      decision: adjusted ? "ADJUSTED" : "CALCULATED",
      calculatedAnnualUnits: result.annualUnits,
      adjustedAnnualUnits: adjusted ? proposed?.adjustedAnnualUnits : null,
      approvedAnnualUnits: adjusted ? proposed?.adjustedAnnualUnits : result.annualUnits,
      adjustedLines: adjusted ? proposed?.adjustedLines : null,
      approvedLines: adjusted
        ? proposed?.adjustedLines
        : result.lines.map((line) => ({ ...line, approvedUnits: line.calculatedUnits })),
      reason: adjusted ? proposed?.reason : "Cálculo aceptado sin ajuste",
      evidence: adjusted ? proposed?.evidence : "Paquete aceptado y resultado reproducible",
      decidedBy: ownerId,
      decidedAt: frozenAt,
      frozenAt,
      methodId: result.methodId,
      methodVersion: result.methodVersion,
      dataClassification: calculation.data_classification,
      officializationAllowed: calculation.data_classification !== "SYNTHETIC_NON_COMMERCIAL",
    };
    await database()
      .prepare(
        `INSERT INTO baseline_reviews
        (plan_id, owner_id, calculation_calculated_at, status, decision, review_json, decided_by, decided_at, frozen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        calculation_calculated_at=excluded.calculation_calculated_at, status=excluded.status,
        decision=excluded.decision, review_json=excluded.review_json,
        decided_by=excluded.decided_by, decided_at=excluded.decided_at, frozen_at=excluded.frozen_at`,
      )
      .bind(
        planId,
        ownerId,
        calculation.calculated_at,
        review.status,
        review.decision,
        JSON.stringify(review),
        ownerId,
        frozenAt,
        frozenAt,
      )
      .run();
    return Response.json({ ok: true, review });
  } catch (error) {
    return responseError(error);
  }
}
