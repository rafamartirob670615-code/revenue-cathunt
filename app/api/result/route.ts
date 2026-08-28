import { accessError, authorizePlan } from "../_access.ts";
import { parseCsv } from "../../../domain/input-package.ts";
import { database, files } from "../_infrastructure.ts";
import { requireAdmin } from "../_session.ts";

export const runtime = "nodejs";

function responseError(error: unknown) {
  return accessError(error, "No pudimos consolidar unidades y valor");
}

function records(csvText: string) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])),
  );
}

async function prerequisites(planId: string, ownerId: string) {
  const row = await database()
    .prepare(
      `SELECT bc.result_json AS baseline_json, bc.data_classification,
       br.review_json, gp.result_json AS growth_json,
       gp.data_classification AS growth_classification
       FROM baseline_calculations bc
       JOIN baseline_reviews br ON br.plan_id = bc.plan_id AND br.owner_id = bc.owner_id
       JOIN growth_plans gp ON gp.plan_id = bc.plan_id AND gp.owner_id = bc.owner_id
       WHERE bc.plan_id = ? AND bc.owner_id = ?
         AND br.status = 'APPROVED_FROZEN'`,
    )
    .bind(planId, ownerId)
    .first<{
      baseline_json: string;
      data_classification: string;
      review_json: string;
      growth_json: string;
      growth_classification: string;
    }>();
  if (!row) throw new Error("Completa primero baseline y crecimiento");
  if (row.data_classification !== row.growth_classification) {
    throw new Error("Baseline y crecimiento deben provenir del mismo tipo de información");
  }
  return row;
}

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId);
    await prerequisites(planId, ownerId);
    const row = await database()
      .prepare("SELECT result_json, updated_at FROM plan_results WHERE plan_id = ? AND owner_id = ?")
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
    requireAdmin(request);
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["PLAN_INTEGRATE"]);
    const source = await prerequisites(planId, ownerId);
    const baseline = JSON.parse(source.baseline_json) as {
      lines: Array<{
        accountId: string;
        skuId: string;
        period: string;
        calculatedUnits: number;
      }>;
    };
    const review = JSON.parse(source.review_json) as {
      decision: "CALCULATED" | "ADJUSTED";
      adjustedLines?: Array<{
        accountId: string;
        skuId: string;
        period: string;
        adjustedUnits: number;
      }> | null;
    };
    const growth = JSON.parse(source.growth_json) as {
      activities: Array<{ accountId: string; skuId: string; period: string; netUnits: number }>;
      netUnits: number;
      controls: { reconciled: boolean };
    };
    if (!growth.controls.reconciled) throw new Error("El incremental neto no está reconciliado");

    const inputRows = await database()
      .prepare(
        `SELECT requirement_id, object_key
         FROM input_package_files
         WHERE plan_id = ? AND owner_id = ?
           AND requirement_id IN ('unit-conversions', 'prices-currency')`,
      )
      .bind(planId, ownerId)
      .run<{ requirement_id: string; object_key: string }>();
    const conversionRow = inputRows.results?.find((row) => row.requirement_id === "unit-conversions");
    const priceRow = inputRows.results?.find((row) => row.requirement_id === "prices-currency");
    if (!conversionRow || !priceRow) throw new Error("Faltan conversiones o precios aceptados");
    const conversionObject = await files().get(conversionRow.object_key);
    const priceObject = await files().get(priceRow.object_key);
    if (!conversionObject || !priceObject) throw new Error("No fue posible leer conversiones o precios aceptados");
    const conversions = records(await conversionObject.text());
    const prices = records(await priceObject.text());
    const conversionBySku = new Map(conversions.map((row) => [row.sku_id, row]));
    const adjustedByKey = new Map(
      (review.adjustedLines ?? []).map((line) => [`${line.accountId}|${line.skuId}|${line.period}`, line.adjustedUnits]),
    );
    const growthByKey = new Map<string, number>();
    for (const activity of growth.activities) {
      const key = `${activity.accountId}|${activity.skuId}|${activity.period}`;
      growthByKey.set(key, (growthByKey.get(key) ?? 0) + activity.netUnits);
    }

    const lines = baseline.lines.map((line) => {
      const key = `${line.accountId}|${line.skuId}|${line.period}`;
      const conversion = conversionBySku.get(line.skuId);
      const applicablePrices = prices
        .filter((row) =>
          row.account_id === line.accountId
          && row.sku_id === line.skuId
          && row.valid_from.slice(0, 7) <= line.period,
        )
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from));
      const price = applicablePrices[0];
      const factor = Number(conversion?.conversion_factor);
      const unitPrice = Number(price?.price);
      if (!Number.isFinite(factor) || factor <= 0) throw new Error(`Conversión inválida para ${line.skuId}`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Precio inválido para ${line.skuId}`);
      const baselineUnits = review.decision === "ADJUSTED"
        ? adjustedByKey.get(key) ?? line.calculatedUnits
        : line.calculatedUnits;
      const incrementalNetUnits = growthByKey.get(key) ?? 0;
      const planUnits = baselineUnits + incrementalNetUnits;
      return {
        accountId: line.accountId,
        skuId: line.skuId,
        period: line.period,
        baselineUnits,
        incrementalNetUnits,
        planUnits,
        sourceUnit: conversion?.source_unit,
        baseUnit: conversion?.base_unit,
        conversionFactor: factor,
        derivedCases: Number((planUnits / factor).toFixed(4)),
        unitPrice,
        currency: price?.currency,
        priceType: price?.price_type,
        validFrom: price?.valid_from,
        planValue: Number((planUnits * unitPrice).toFixed(2)),
      };
    });
    const appliedGrowthUnits = lines.reduce((sum, line) => sum + line.incrementalNetUnits, 0);
    if (Number(appliedGrowthUnits.toFixed(6)) !== Number(growth.netUnits.toFixed(6))) {
      throw new Error("Las cuentas, SKU y periodos de Crecimiento no coinciden completamente con el Baseline");
    }
    const annualUnits = lines.reduce((sum, line) => sum + line.planUnits, 0);
    const annualValue = Number(lines.reduce((sum, line) => sum + line.planValue, 0).toFixed(2));
    const result = {
      dataClassification: source.data_classification,
      methodId: "APPROVED_BASELINE_PLUS_NET_INCREMENT",
      methodVersion: "2.0.0",
      lines,
      annualUnits,
      annualValue,
      currency: "MXN",
      controls: {
        unitsReconciled: annualUnits === lines.reduce(
          (sum, line) => sum + line.baselineUnits + line.incrementalNetUnits,
          0,
        ),
        valueReconciled: annualValue === Number(lines.reduce(
          (sum, line) => sum + line.planUnits * line.unitPrice,
          0,
        ).toFixed(2)),
        missingConversions: 0,
        missingPrices: 0,
        growthFullyApplied: true,
      },
    };
    const now = new Date().toISOString();
    await database().prepare("DELETE FROM financial_results WHERE plan_id = ?").bind(planId).run();
    await database()
      .prepare(
        `INSERT INTO plan_results
        (plan_id, owner_id, result_json, data_classification, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        result_json=excluded.result_json, data_classification=excluded.data_classification,
        updated_at=excluded.updated_at`,
      )
      .bind(planId, ownerId, JSON.stringify(result), source.data_classification, now, now)
      .run();
    return Response.json({ ok: true, result, updatedAt: now });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(request);
    const body = (await request.json()) as {
      planId?: string;
      reason?: string;
      evidence?: string;
      lines?: Array<{ accountId?: string; skuId?: string; period?: string; authorizedAdjustmentUnits?: number; unitPrice?: number }>;
    };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId, actor } = await authorizePlan(request, planId, ["PLAN_INTEGRATE"]);
    if (!body.reason?.trim()) throw new Error("El motivo de edición es obligatorio");
    if (!body.evidence?.trim()) throw new Error("La evidencia de edición es obligatoria");
    await prerequisites(planId, ownerId);
    const stored = await database()
      .prepare("SELECT result_json FROM plan_results WHERE plan_id = ? AND owner_id = ?")
      .bind(planId, ownerId)
      .first<{ result_json: string }>();
    if (!stored) throw new Error("Calcula primero unidades y valor");
    const current = JSON.parse(stored.result_json) as {
      dataClassification: string;
      methodId: string;
      methodVersion: string;
      currency: string;
      lines: Array<{
        accountId: string; skuId: string; period: string; baselineUnits: number;
        incrementalNetUnits: number; sourceUnit: string; baseUnit: string;
        conversionFactor: number; currency: string; priceType: string; validFrom: string;
      }>;
    };
    const edits = body.lines ?? [];
    if (edits.length !== current.lines.length) {
      throw new Error("La edición debe incluir exactamente cada combinación SKU y mes");
    }
    const byKey = new Map<string, { authorizedAdjustmentUnits: number; unitPrice: number }>();
    for (const edit of edits) {
      const key = `${edit.accountId?.trim()}|${edit.skuId?.trim()}|${edit.period?.trim()}`;
      const authorizedAdjustmentUnits = Number(edit.authorizedAdjustmentUnits ?? 0);
      const unitPrice = Number(edit.unitPrice);
      if (!edit.accountId?.trim() || !edit.skuId?.trim() || !/^\d{4}-\d{2}$/.test(edit.period ?? "")) {
        throw new Error(`Llave inválida: ${key}`);
      }
      if (byKey.has(key)) throw new Error(`Línea duplicada: ${key}`);
      if (!Number.isFinite(authorizedAdjustmentUnits) || !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error(`Valores inválidos para ${key}`);
      }
      byKey.set(key, { authorizedAdjustmentUnits, unitPrice });
    }
    const lines = current.lines.map((line) => {
      const edit = byKey.get(`${line.accountId}|${line.skuId}|${line.period}`);
      if (!edit) throw new Error(`Falta la línea ${line.accountId}|${line.skuId}|${line.period}`);
      const planUnits = line.baselineUnits + line.incrementalNetUnits + edit.authorizedAdjustmentUnits;
      if (planUnits < 0) throw new Error(`Las unidades Plan no pueden ser negativas para ${line.skuId}|${line.period}`);
      return {
        ...line,
        authorizedAdjustmentUnits: edit.authorizedAdjustmentUnits,
        planUnits,
        derivedCases: Number((planUnits / line.conversionFactor).toFixed(4)),
        unitPrice: edit.unitPrice,
        planValue: Number((planUnits * edit.unitPrice).toFixed(2)),
      };
    });
    const annualUnits = lines.reduce((sum, line) => sum + line.planUnits, 0);
    const annualValue = Number(lines.reduce((sum, line) => sum + line.planValue, 0).toFixed(2));
    const result = {
      ...current,
      methodVersion: "1.1.0",
      lines,
      annualUnits,
      annualValue,
      controls: {
        unitsReconciled: annualUnits === lines.reduce(
          (sum, line) => sum + line.baselineUnits + line.incrementalNetUnits + line.authorizedAdjustmentUnits, 0,
        ),
        valueReconciled: annualValue === Number(lines.reduce(
          (sum, line) => sum + line.planUnits * line.unitPrice, 0,
        ).toFixed(2)),
        missingConversions: 0,
        missingPrices: 0,
      },
      edit: {
        reason: body.reason.trim(), evidence: body.evidence.trim(),
        editedBy: actor.email, editedAt: new Date().toISOString(),
      },
    };
    const now = new Date().toISOString();
    await database().prepare("DELETE FROM financial_results WHERE plan_id = ?").bind(planId).run();
    await database()
      .prepare("UPDATE plan_results SET result_json = ?, updated_at = ? WHERE plan_id = ? AND owner_id = ?")
      .bind(JSON.stringify(result), now, planId, ownerId)
      .run();
    return Response.json({ ok: true, result, updatedAt: now });
  } catch (error) {
    return responseError(error);
  }
}
