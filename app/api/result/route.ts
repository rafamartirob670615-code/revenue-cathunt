import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";
import { parseCsv } from "../../../domain/input-package.ts";

export const runtime = "edge";

interface StoredObject {
  text(): Promise<string>;
}

interface R2BucketLike {
  get(key: string): Promise<StoredObject | null>;
}

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
  const message = error instanceof Error ? error.message : "No pudimos consolidar unidades y valor";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
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
       br.review_json, gp.result_json AS growth_json
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
    }>();
  if (!row) throw new Error("Completa primero baseline y crecimiento");
  if (row.data_classification !== "SYNTHETIC_NON_COMMERCIAL") {
    throw new Error("Esta compuerta sólo está habilitada para el Plan sintético aislado");
  }
  return row;
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
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
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
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
      activities: Array<{ skuId: string; period: string; netUnits: number }>;
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
    const priceBySku = new Map(prices.map((row) => [row.sku_id, row]));
    const adjustedByKey = new Map(
      (review.adjustedLines ?? []).map((line) => [`${line.skuId}|${line.period}`, line.adjustedUnits]),
    );
    const growthByKey = new Map<string, number>();
    for (const activity of growth.activities) {
      const key = `${activity.skuId}|${activity.period}`;
      growthByKey.set(key, (growthByKey.get(key) ?? 0) + activity.netUnits);
    }

    const lines = baseline.lines.map((line) => {
      const key = `${line.skuId}|${line.period}`;
      const conversion = conversionBySku.get(line.skuId);
      const price = priceBySku.get(line.skuId);
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
    const annualUnits = lines.reduce((sum, line) => sum + line.planUnits, 0);
    const annualValue = Number(lines.reduce((sum, line) => sum + line.planValue, 0).toFixed(2));
    const result = {
      dataClassification: "SYNTHETIC_NON_COMMERCIAL",
      methodId: "APPROVED_BASELINE_PLUS_NET_INCREMENT",
      methodVersion: "1.0.0",
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
      },
    };
    const now = new Date().toISOString();
    await database()
      .prepare(
        `INSERT INTO plan_results
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
