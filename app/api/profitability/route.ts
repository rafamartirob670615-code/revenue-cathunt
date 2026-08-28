import { authorizePlan } from "../_access.ts";
import { database, files } from "../_infrastructure.ts";
import { requireAdmin } from "../_session.ts";

export const runtime = "nodejs";

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
  return {
    ...(JSON.parse(row.result_json) as {
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
    }),
    dataClassification: row.data_classification,
  };
}

async function canonicalRows(planId:string, ownerId:string, requirementId:string) {
  const row=await database().prepare(
    "SELECT canonical_object_key, status FROM canonical_datasets WHERE plan_id=? AND owner_id=? AND requirement_id=?",
  ).bind(planId,ownerId,requirementId).first<{canonical_object_key:string;status:string}>();
  if(!row || row.status!=="READY") throw new Error(`Falta validar ${requirementId}`);
  const object=await files().get(row.canonical_object_key);
  if(!object) throw new Error(`No encontramos ${requirementId}`);
  return (JSON.parse(await object.text()) as {rows:Array<Record<string,string|number>>}).rows;
}

async function optionalCanonicalRows(planId: string, ownerId: string, requirementId: string) {
  try { return await canonicalRows(planId, ownerId, requirementId); } catch { return []; }
}

function sideDifference(plan: ReturnType<typeof pnl>, prior: ReturnType<typeof pnl>) {
  return {
    grossSales: Number((plan.grossSales - prior.grossSales).toFixed(2)),
    deductions: Number((plan.deductions - prior.deductions).toFixed(2)),
    netSales: Number((plan.netSales - prior.netSales).toFixed(2)),
    cogs: Number((plan.cogs - prior.cogs).toFixed(2)),
    grossMargin: Number((plan.grossMargin - prior.grossMargin).toFixed(2)),
    investment: Number((plan.investment - prior.investment).toFixed(2)),
    contribution: Number((plan.contribution - prior.contribution).toFixed(2)),
    grossMarginRate: null,
    contributionRate: null,
  };
}

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId") ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["VIEW_FINANCIALS","PLAN_INTEGRATE","REVIEW","APPROVE"]);
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
    requireAdmin(request);
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["PLAN_INTEGRATE"]);
    const source = await planResult(planId, ownerId);
    if (!source.controls.unitsReconciled || !source.controls.valueReconciled) {
      throw new Error("Unidades y valor deben estar reconciliados");
    }
    if(source.dataClassification==="USER_PROVIDED"){
      const conditions=await canonicalRows(planId,ownerId,"commercial-conditions");
      const costs=await canonicalRows(planId,ownerId,"product-costs");
      const investments=await canonicalRows(planId,ownerId,"activity-investments");
      const growthRow=await database().prepare(
        "SELECT result_json FROM growth_plans WHERE plan_id=? AND owner_id=?",
      ).bind(planId,ownerId).first<{result_json:string}>();
      if(!growthRow) throw new Error("Falta Crecimiento reconciliado");
      const growth=JSON.parse(growthRow.result_json) as {activities:Array<{id:string;accountId:string;skuId:string;period:string}>};
      const planYear = Number(String(source.lines[0]?.period ?? "").slice(0, 4));
      const priorYear = Number.isFinite(planYear) ? planYear - 1 : null;
      const history = await optionalCanonicalRows(planId, ownerId, "sales-history");
      const actualRows = await optionalCanonicalRows(planId, ownerId, "actual-sales");
      const expectedActivities=new Set(growth.activities.map((a)=>`${a.id}|${a.accountId}|${a.skuId}|${a.period}`));
      const receivedActivities=new Set(investments.map((a)=>`${a.activity_id}|${a.account_id}|${a.sku_id}|${a.period}`));
      const missing=[...expectedActivities].filter((key)=>!receivedActivities.has(key));
      if(missing.length) throw new Error("Faltan inversiones para actividades incorporadas al Crecimiento");
      const investmentByKey=new Map<string,number>();
      investments.forEach((row)=>{
        const key=`${row.account_id}|${row.sku_id}|${row.period}`;
        investmentByKey.set(key,(investmentByKey.get(key)??0)+Number(row.investment_value));
      });
      const realLines=source.lines.map((line)=>{
        const condition=conditions.filter((row)=>row.account_id===line.accountId&&row.sku_id===line.skuId&&String(row.valid_from)<=line.period)
          .sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        const cost=costs.filter((row)=>row.sku_id===line.skuId&&String(row.valid_from)<=line.period)
          .sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        if(!condition) throw new Error(`Faltan condiciones comerciales para ${line.accountId} · ${line.skuId}`);
        if(!cost) throw new Error(`Falta costo para ${line.skuId}`);
        if(String(cost.currency)!==source.currency) throw new Error(`Moneda de costo incompatible para ${line.skuId}`);
        const rates=["discount_rate","rebate_rate","returns_rate","other_deduction_rate"].map((field)=>Number(condition[field]));
        const deductionRate=rates.reduce((sum,value)=>sum+value,0);
        const unitCost=Number(cost.unit_cost);
        const build=(units:number,grossSales:number,investment:number)=>{
          const deductions=Number((grossSales*deductionRate).toFixed(2));
          const netSales=Number((grossSales-deductions).toFixed(2));
          const cogs=Number((units*unitCost).toFixed(2));
          const grossMargin=Number((netSales-cogs).toFixed(2));
          const contribution=Number((grossMargin-investment).toFixed(2));
          return {grossSales,deductions,netSales,cogs,grossMargin,investment,contribution,
            grossMarginRate:netSales===0?null:Number((grossMargin/netSales).toFixed(4)),
            contributionRate:netSales===0?null:Number((contribution/netSales).toFixed(4))};
        };
        const key=`${line.accountId}|${line.skuId}|${line.period}`;
        const comparator=build(line.baselineUnits,Number((line.baselineUnits*line.unitPrice).toFixed(2)),0);
        const plan=build(line.planUnits,line.planValue,investmentByKey.get(key)??0);
        return {accountId:line.accountId,skuId:line.skuId,period:line.period,comparator,plan,
          contributionVariance:Number((plan.contribution-comparator.contribution).toFixed(2))};
      });
      const sumSide=(side:"comparator"|"plan",field:keyof ReturnType<typeof pnl>)=>Number(realLines.reduce((total,line)=>total+Number(line[side][field]??0),0).toFixed(2));
      const annual=(side:"comparator"|"plan")=>{
        const grossSales=sumSide(side,"grossSales"),deductions=sumSide(side,"deductions"),netSales=sumSide(side,"netSales"),
          cogs=sumSide(side,"cogs"),grossMargin=sumSide(side,"grossMargin"),investment=sumSide(side,"investment"),
          contribution=sumSide(side,"contribution");
        return {grossSales,deductions,netSales,cogs,grossMargin,investment,contribution,
          grossMarginRate:netSales===0?null:Number((grossMargin/netSales).toFixed(4)),
          contributionRate:netSales===0?null:Number((contribution/netSales).toFixed(4))};
      };
      const comparatorAnnual=annual("comparator"),planAnnual=annual("plan");
      const priorParts = priorYear === null ? [] : history.filter((row) => String(row.period ?? "").startsWith(`${priorYear}-`)).map((row) => {
        const condition=conditions.filter((item)=>item.account_id===row.account_id&&item.sku_id===row.sku_id&&String(item.valid_from)<=String(row.period)).sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        const cost=costs.filter((item)=>item.sku_id===row.sku_id&&String(item.valid_from)<=String(row.period)).sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        if (!condition || !cost) return null;
        const rates=["discount_rate","rebate_rate","returns_rate","other_deduction_rate"].map((field)=>Number(condition[field]));
        const deductionRate=rates.reduce((sum,value)=>sum+value,0);
        const grossSales=Number(row.value ?? 0), units=Number(row.units ?? 0), deductions=Number((grossSales*deductionRate).toFixed(2));
        const netSales=Number((grossSales-deductions).toFixed(2)), cogs=Number((units*Number(cost.unit_cost)).toFixed(2)), grossMargin=Number((netSales-cogs).toFixed(2));
        return { grossSales, deductions, netSales, cogs, grossMargin, investment: 0, contribution: grossMargin, grossMarginRate: netSales === 0 ? null : Number((grossMargin/netSales).toFixed(4)), contributionRate: netSales === 0 ? null : Number((grossMargin/netSales).toFixed(4)) };
      }).filter((part): part is NonNullable<typeof part> => Boolean(part));
      const priorYearAnnual = priorParts.length ? priorParts.reduce((total, part) => ({
        grossSales: total.grossSales + part.grossSales, deductions: total.deductions + part.deductions, netSales: total.netSales + part.netSales,
        cogs: total.cogs + part.cogs, grossMargin: total.grossMargin + part.grossMargin, investment: 0, contribution: total.contribution + part.contribution,
        grossMarginRate: null, contributionRate: null,
      }), { grossSales: 0, deductions: 0, netSales: 0, cogs: 0, grossMargin: 0, investment: 0, contribution: 0, grossMarginRate: null, contributionRate: null }) : null;
      const actualParts = actualRows.filter((row) => String(row.period ?? "").startsWith(`${planYear}-`)).map((row) => {
        const condition=conditions.filter((item)=>item.account_id===row.account_id&&item.sku_id===row.sku_id&&String(item.valid_from)<=String(row.period)).sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        const cost=costs.filter((item)=>item.sku_id===row.sku_id&&String(item.valid_from)<=String(row.period)).sort((a,b)=>String(b.valid_from).localeCompare(String(a.valid_from)))[0];
        if (!condition || !cost) return null;
        const grossSales=Number(row.actual_value ?? 0), units=Number(row.actual_units ?? 0);
        const deductionRate=["discount_rate","rebate_rate","returns_rate","other_deduction_rate"].map((field)=>Number(condition[field])).reduce((sum,value)=>sum+value,0);
        const deductions=Number((grossSales*deductionRate).toFixed(2)), netSales=Number((grossSales-deductions).toFixed(2));
        const cogs=Number((units*Number(cost.unit_cost)).toFixed(2)), grossMargin=Number((netSales-cogs).toFixed(2));
        return { grossSales, deductions, netSales, cogs, grossMargin, investment: 0, contribution: grossMargin, grossMarginRate: netSales === 0 ? null : Number((grossMargin/netSales).toFixed(4)), contributionRate: netSales === 0 ? null : Number((grossMargin/netSales).toFixed(4)) };
      }).filter((part): part is NonNullable<typeof part> => Boolean(part));
      const actualYearAnnual = actualParts.length ? actualParts.reduce((total, part) => ({
        grossSales: total.grossSales + part.grossSales, deductions: total.deductions + part.deductions, netSales: total.netSales + part.netSales,
        cogs: total.cogs + part.cogs, grossMargin: total.grossMargin + part.grossMargin, investment: 0, contribution: total.contribution + part.contribution,
        grossMarginRate: null, contributionRate: null,
      }), { grossSales: 0, deductions: 0, netSales: 0, cogs: 0, grossMargin: 0, investment: 0, contribution: 0, grossMarginRate: null, contributionRate: null }) : null;
      const priorUnits = priorYear === null ? null : history.filter((row) => String(row.period ?? "").startsWith(`${priorYear}-`)).reduce((sum, row) => sum + Number(row.units ?? 0), 0);
      const actualUnits = actualRows.filter((row) => String(row.period ?? "").startsWith(`${planYear}-`)).reduce((sum, row) => sum + Number(row.actual_units ?? 0), 0);
      const planUnits = source.lines.reduce((sum, line) => sum + line.planUnits, 0);
      const result={dataClassification:"USER_PROVIDED",comparator:{id:"APPROVED_BASELINE_VALUE",name:"Valor del baseline aprobado",explanation:"Baseline aprobado con precios, condiciones y costos vigentes; sin inversión incremental."},
        parameters:{id:"COMMERCIAL_CONDITIONS_AND_COSTS",version:"1.0.0",
          deductionRate:planAnnual.grossSales===0?0:Number((planAnnual.deductions/planAnnual.grossSales).toFixed(4)),
          cogsRateOnNetSales:planAnnual.netSales===0?0:Number((planAnnual.cogs/planAnnual.netSales).toFixed(4)),
          investmentRateOnIncrementalGross:0,corporatePolicy:true,
          explanation:"Condiciones comerciales, costos e inversiones provenientes de archivos aprobados."},
        currency:source.currency,lines:realLines,priorYear,priorYearAnnual,priorYearVariance:priorYearAnnual ? sideDifference(planAnnual, priorYearAnnual) : null,actualYear: actualYearAnnual ? planYear : null,actualAnnual: actualYearAnnual,actualVariance: actualYearAnnual ? sideDifference(actualYearAnnual, planAnnual) : null,unitComparison:{prior:priorUnits,actual:actualRows.length ? actualUnits : null,plan:planUnits,planVsPrior:priorUnits === null ? null : planUnits-priorUnits,actualVsPlan:actualRows.length ? actualUnits-planUnits : null},comparatorAnnual,planAnnual,
        variance:{netSales:Number((planAnnual.netSales-comparatorAnnual.netSales).toFixed(2)),grossMargin:Number((planAnnual.grossMargin-comparatorAnnual.grossMargin).toFixed(2)),contribution:Number((planAnnual.contribution-comparatorAnnual.contribution).toFixed(2))},
        controls:{planReconciled:planAnnual.contribution===Number((planAnnual.netSales-planAnnual.cogs-planAnnual.investment).toFixed(2)),comparatorReconciled:comparatorAnnual.contribution===Number((comparatorAnnual.netSales-comparatorAnnual.cogs).toFixed(2)),corporatePolicyApproved:true}};
      const now=new Date().toISOString();
      await database().prepare(`INSERT INTO financial_results (plan_id,owner_id,result_json,data_classification,created_at,updated_at)
        VALUES (?,?,?,'USER_PROVIDED',?,?) ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,result_json=excluded.result_json,data_classification=excluded.data_classification,updated_at=excluded.updated_at`)
        .bind(planId,ownerId,JSON.stringify(result),now,now).run();
      return Response.json({ok:true,result,updatedAt:now});
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
    const planYear = Number(String(source.lines[0]?.period ?? "").slice(0, 4));
    const priorYear = Number.isFinite(planYear) ? planYear - 1 : null;
    const history = priorYear === null ? [] : await optionalCanonicalRows(planId, ownerId, "sales-history");
    const priorGrossSales = history.filter((row) => String(row.period ?? "").startsWith(`${priorYear}-`)).reduce((total, row) => total + Number(row.value ?? 0), 0);
    const priorYearAnnual = priorGrossSales > 0 ? pnl(priorGrossSales, 0) : null;
    const actualRows = await optionalCanonicalRows(planId, ownerId, "actual-sales");
    const actualGrossSales = actualRows.filter((row) => String(row.period ?? "").startsWith(`${planYear}-`)).reduce((total, row) => total + Number(row.actual_value ?? 0), 0);
    const actualAnnual = actualGrossSales > 0 ? pnl(actualGrossSales, 0) : null;
    const priorUnits = priorYear === null ? null : history.filter((row) => String(row.period ?? "").startsWith(`${priorYear}-`)).reduce((sum, row) => sum + Number(row.units ?? 0), 0);
    const actualUnits = actualRows.filter((row) => String(row.period ?? "").startsWith(`${planYear}-`)).reduce((sum, row) => sum + Number(row.actual_units ?? 0), 0);
    const planUnits = source.lines.reduce((sum, line) => sum + line.planUnits, 0);
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
      priorYear,
      priorYearAnnual,
      priorYearVariance: priorYearAnnual ? sideDifference(planAnnual, priorYearAnnual) : null,
      actualYear: actualAnnual ? planYear : null,
      actualAnnual,
      actualVariance: actualAnnual ? sideDifference(actualAnnual, planAnnual) : null,
      unitComparison: { prior: priorUnits, actual: actualRows.length ? actualUnits : null, plan: planUnits, planVsPrior: priorUnits === null ? null : planUnits - priorUnits, actualVsPlan: actualRows.length ? actualUnits - planUnits : null },
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
