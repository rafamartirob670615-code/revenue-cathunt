import { env } from "cloudflare:workers";
import type { D1DatabaseLike } from "../../../application/d1-repository.ts";

export const runtime = "edge";

const SYNTHETIC_PARAMETERS = {
  id: "SYNTHETIC_PNL_PARAMETERS",
  version: "1.0.0",
  deductionRate: 0.1,
  cogsRateOnNetSales: 0.55,
  investmentRateOnIncrementalGross: 0.08,
  classification: "SYNTHETIC_NON_COMMERCIAL",
  corporatePolicy: false,
  explanation: "Parámetros artificiales para probar la reconciliación; no representan políticas corporativas.",
} as const;

function database(): D1DatabaseLike {
  if (!env.DB) throw new Error("Persistencia no disponible");
  return env.DB as unknown as D1DatabaseLike;
}

function owner(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? undefined;
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos calcular la rentabilidad";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

async function planResult(planId: string, ownerId: string) {
  const row = await database()
    .prepare(
      "SELECT result_json, data_classification FROM plan_results WHERE plan_id = ? AND owner_id = ?",
    )
    .bind(planId, ownerId)
    .first<{ result_json: string; data_classification: string }>();
  if (!row) throw new Error("Consolida primero unidades y valor");
  if (row.data_classification !== "SYNTHETIC_NON_COMMERCIAL") {
    throw new Error("Esta compuerta sólo está habilitada para el Plan sintético aislado");
  }
  return JSON.parse(row.result_json) as {
    currency: string;
    lines: Array<{
      accountId: string;
      skuId: string;
      period: string;
      baselineUnits: number;
      incrementalNetUnits: number;
      planUnits: number;
      unitPrice: number;
      planValue: number;
    }>;
    controls: { unitsReconciled: boolean; valueReconciled: boolean };
  };
}

export async function GET(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    await planResult(planId, ownerId);
    const row = await database()
      .prepare("SELECT result_json, updated_at FROM financial_results WHERE plan_id = ? AND owner_id = ?")
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

function pnl(grossSales: number, investment: number) {
  const deductions = Number((grossSales * SYNTHETIC_PARAMETERS.deductionRate).toFixed(2));
  const netSales = Number((grossSales - deductions).toFixed(2));
  const cogs = Number((netSales * SYNTHETIC_PARAMETERS.cogsRateOnNetSales).toFixed(2));
  const grossMargin = Number((netSales - cogs).toFixed(2));
  const contribution = Number((grossMargin - investment).toFixed(2));
  return {
    grossSales,
    deductions,
    netSales,
    cogs,
    grossMargin,
    investment,
    contribution,
    grossMarginRate: netSales === 0 ? null : Number((grossMargin / netSales).toFixed(4)),
    contributionRate: netSales === 0 ? null : Number((contribution / netSales).toFixed(4)),
  };
}

export async function POST(request: Request) {
  try {
    const ownerId = owner(request);
    if (!ownerId) throw new Error("Autenticación requerida");
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const source = await planResult(planId, ownerId);
    if (!source.controls.unitsReconciled || !source.controls.valueReconciled) {
      throw new Error("Unidades y valor deben estar reconciliados");
    }
    const lines = source.lines.map((line) => {
      const comparatorGrossSales = Number((line.baselineUnits * line.unitPrice).toFixed(2));
      const incrementalGrossSales = Number((line.incrementalNetUnits * line.unitPrice).toFixed(2));
      const investment = Number((
        Math.max(0, incrementalGrossSales) * SYNTHETIC_PARAMETERS.investmentRateOnIncrementalGross
      ).toFixed(2));
      const comparator = pnl(comparatorGrossSales, 0);
      const plan = pnl(line.planValue, investment);
      return {
        accountId: line.accountId,
        skuId: line.skuId,
        period: line.period,
        comparator,
        plan,
        contributionVariance: Number((plan.contribution - comparator.contribution).toFixed(2)),
      };
    });
    const sum = (side: "comparator" | "plan", field: keyof ReturnType<typeof pnl>) =>
      Number(lines.reduce((total, line) => total + Number(line[side][field] ?? 0), 0).toFixed(2));
    const comparatorAnnual = pnl(sum("comparator", "grossSales"), sum("comparator", "investment"));
    const planAnnual = pnl(sum("plan", "grossSales"), sum("plan", "investment"));
    const result = {
      dataClassification: "SYNTHETIC_NON_COMMERCIAL",
      comparator: {
        id: "APPROVED_BASELINE_VALUE",
        name: "Valor del baseline aprobado",
        explanation: "Mismas unidades base, precios y parámetros sintéticos; sin incremental ni inversión incremental.",
      },
      parameters: SYNTHETIC_PARAMETERS,
      currency: source.currency,
      lines,
      comparatorAnnual,
      planAnnual,
      variance: {
        netSales: Number((planAnnual.netSales - comparatorAnnual.netSales).toFixed(2)),
        grossMargin: Number((planAnnual.grossMargin - comparatorAnnual.grossMargin).toFixed(2)),
        contribution: Number((planAnnual.contribution - comparatorAnnual.contribution).toFixed(2)),
      },
      controls: {
        planReconciled: planAnnual.contribution === Number((
          planAnnual.netSales - planAnnual.cogs - planAnnual.investment
        ).toFixed(2)),
        comparatorReconciled: comparatorAnnual.contribution === Number((
          comparatorAnnual.netSales - comparatorAnnual.cogs - comparatorAnnual.investment
        ).toFixed(2)),
        corporatePolicyApproved: false,
      },
    };
    const now = new Date().toISOString();
    await database()
      .prepare(
        `INSERT INTO financial_results
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
