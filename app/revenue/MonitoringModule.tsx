"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyAnswer, Metric, ModuleHead, formatMoney } from "./ui";

type MonitorData = {
  plan: { year: number; currency: string; status: string };
  result: null | { currency: string; lines: Array<{ period: string; planValue: number }> };
  actuals: { ready: boolean; cutoffDate: string | null; months: Record<string, { value: number }>; includedRows: number };
  quota: { ready: boolean; months: Record<string, { value: number }> };
  priorYear: { year: number | null; months: Record<string, { value: number }> };
  updatedAt: string;
  billing: Array<BillingRow>;
  growth: { activities: Array<{ id: string; family: string; name: string; skuId: string; period: string; grossUnits: number; netUnits: number; evidence: string }> } | null;
};

type BillingRow = {
  accountId: string; skuId: string; period: string; planValue: number;
  quotaValue: number | null; actualValue: number | null; varianceValue: number | null;
  territory: string; channel: string; category: string; segment: string;
};

type Action = {
  id: string; period: string; variance_value: number; variance_rate: number | null;
  cause: string; evidence: string; action: string; responsible: string; due_date: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED"; outcome_note: string | null;
};

const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const officialColumns = [{ key:"01", label:"Ene" },{ key:"02", label:"Feb" },{ key:"03", label:"Mar" },{ key:"Q1", label:"Q1" },{ key:"04", label:"Abr" },{ key:"05", label:"May" },{ key:"06", label:"Jun" },{ key:"Q2", label:"Q2" },{ key:"07", label:"Jul" },{ key:"08", label:"Ago" },{ key:"09", label:"Sep" },{ key:"Q3", label:"Q3" },{ key:"10", label:"Oct" },{ key:"11", label:"Nov" },{ key:"12", label:"Dic" },{ key:"Q4", label:"Q4" },{ key:"YTD", label:"YTD" }];

export default function MonitoringModule({ planId }: { planId: string }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [form, setForm] = useState({ cause:"", evidence:"", action:"", responsible:"", dueDate:"" });
  const [outcomes, setOutcomes] = useState<Record<string,string>>({});
  const [billingFilters, setBillingFilters] = useState({ territory:"Todos", account:"Todos", channel:"Todos", category:"Todos", segment:"Todos", sku:"Todos", period:"Todos" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [monitorResponse, actionResponse] = await Promise.all([
        fetch(`/api/monitoring?planId=${encodeURIComponent(planId)}`, { cache:"no-store" }),
        fetch(`/api/monitoring/actions?planId=${encodeURIComponent(planId)}`, { cache:"no-store" }),
      ]);
      const monitor = await monitorResponse.json() as MonitorData & { ok?: boolean; error?: string };
      const actionBody = await actionResponse.json() as { ok?: boolean; actions?: Action[]; error?: string };
      if (!monitorResponse.ok || monitor.ok === false) throw new Error(monitor.error);
      if (!actionResponse.ok || actionBody.ok === false) throw new Error(actionBody.error);
      setData(monitor);
      setActions(actionBody.actions ?? []);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No pudimos abrir Seguimiento");
    }
  }, [planId]);

  // The effect initiates an asynchronous request; the request callbacks update the view state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function upload(requirementId: "sales-quota" | "actual-sales", file?: File) {
    if (!file) return;
    setBusy(requirementId);
    setError("");
    try {
      const body = new FormData();
      body.set("planId", planId); body.set("requirementId", requirementId); body.set("file", file);
      const response = await fetch("/api/inputs", { method:"POST", body });
      const result = await response.json() as { ok?: boolean; error?: string; result?: { status: string } };
      if (!response.ok || !result.ok || result.result?.status !== "READY") throw new Error(result.error || "El archivo necesita correcciones.");
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "No pudimos procesar el archivo"); }
    finally { setBusy(""); }
  }

  async function createAction(event: React.FormEvent) {
    event.preventDefault();
    setBusy("action");
    try {
      const response = await fetch("/api/monitoring/actions", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ planId, period:selectedPeriod, ...form }) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error);
      setSelectedPeriod(""); setForm({ cause:"", evidence:"", action:"", responsible:"", dueDate:"" }); await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "No pudimos guardar la acción"); }
    finally { setBusy(""); }
  }

  async function updateAction(item: Action, status: Action["status"]) {
    setBusy(item.id);
    try {
      const response = await fetch("/api/monitoring/actions", { method:"PUT", headers:{ "content-type":"application/json" }, body:JSON.stringify({ planId, actionId:item.id, status, outcomeNote:status === "CLOSED" ? outcomes[item.id] : item.outcome_note }) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error);
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : "No pudimos actualizar la acción"); }
    finally { setBusy(""); }
  }

  const comparison = useMemo(() => {
    if (!data) return [];
    return Array.from({ length:12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      const period = `${data.plan.year}-${month}`;
      const plan = (data.result?.lines ?? []).filter((line) => line.period.endsWith(`-${month}`)).reduce((sum, line) => sum + line.planValue, 0);
      const actual = data.actuals.months[period]?.value ?? null;
      const quota = data.quota.months[period]?.value ?? null;
      const gap = actual === null ? null : actual - plan;
      const rate = gap === null || plan === 0 ? null : gap / plan;
      return { period, month:monthNames[index], plan, actual, quota, gap, rate };
    });
  }, [data]);

  if (!data) return <div className="module-page"><ModuleHead eyebrow="Seguimiento" title="Abriendo el Plan…" description="Recuperando venta real, cuota y acciones." />{error && <div className="platform-error">{error}</div>}</div>;
  const comparable = comparison.filter((row) => row.actual !== null);
  const planYtd = comparable.reduce((sum, row) => sum + row.plan, 0);
  const actualYtd = comparable.reduce((sum, row) => sum + (row.actual ?? 0), 0);
  const deviations = comparable.filter((row) => row.rate !== null && Math.abs(row.rate) >= .05);
  const currency = data.result?.currency ?? data.plan.currency;
  const billingDimensions = [
    ["territory", "Territorio"], ["accountId", "Cuenta"], ["channel", "Canal"],
    ["category", "Categoría"], ["segment", "Segmento"], ["skuId", "Producto"], ["period", "Periodo"],
  ] as const;
  const billingFiltered = data.billing.filter((row) => Object.entries(billingFilters).every(([key, value]) => value === "Todos" || String(row[key as keyof BillingRow]) === value));
  const billingTotals = billingFiltered.reduce((totals, row) => ({
    plan: totals.plan + row.planValue,
    quota: totals.quota + (row.quotaValue ?? 0),
    actual: totals.actual + (row.actualValue ?? 0),
    variance: totals.variance + (row.varianceValue ?? 0),
  }), { plan:0, quota:0, actual:0, variance:0 });
  const billingHasMissingDimensions = data.billing.some((row) => [row.territory, row.channel, row.category, row.segment].some((value) => !value));
  const matrixValue = (metric: "plan" | "quota" | "actual" | "variance", key: string) => {
    const months = key === "YTD" ? ["01","02","03","04","05","06","07","08","09","10","11","12"] : key.startsWith("Q") ? (key === "Q1" ? ["01","02","03"] : key === "Q2" ? ["04","05","06"] : key === "Q3" ? ["07","08","09"] : ["10","11","12"]) : [key];
    return billingFiltered.filter((row) => months.includes(row.period.slice(5, 7))).reduce((sum, row) => sum + (metric === "plan" ? row.planValue : metric === "quota" ? (row.quotaValue ?? 0) : metric === "actual" ? (row.actualValue ?? 0) : (row.varianceValue ?? 0)), 0);
  };
  function exportBilling() {
    const header = ["Territorio","Cuenta","Canal","Categoría","Segmento","Producto","Periodo","Plan","Cuota","Venta real","Variación"];
    const rows = billingFiltered.map((row) => [row.territory || "", row.accountId, row.channel || "", row.category || "", row.segment || "", row.skuId, row.period, row.planValue, row.quotaValue ?? "", row.actualValue ?? "", row.varianceValue ?? ""]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" })); link.download = `REVENUE_Seguimiento_Billing_${planId}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <div className="module-page">
    <ModuleHead eyebrow="Ejecutar el Plan · Seguimiento" title="Plan contra venta real" description="Un solo comparativo mensual. Las desviaciones materiales se convierten en acciones con responsable y fecha." />
    {error && <div className="platform-error">{error}<button onClick={() => setError("")}>Cerrar</button></div>}
    <section className="monitor-sources">
      <div><b>Plan aprobado</b><span>Fuente de comparación</span><strong>Listo</strong></div>
      <label className={data.quota.ready ? "ready" : ""}><b>Cuota comercial</b><span>{data.quota.ready ? "Archivo recibido" : "Falta el Excel"}</span><strong>{busy === "sales-quota" ? "Leyendo…" : data.quota.ready ? "Reemplazar" : "Cargar"}<input type="file" accept=".xlsx,.xls" onChange={(event) => upload("sales-quota", event.target.files?.[0])} /></strong></label>
      <label className={data.actuals.ready ? "ready" : ""}><b>Venta real</b><span>{data.actuals.cutoffDate ? `Corte ${data.actuals.cutoffDate}` : "Falta el Excel"}</span><strong>{busy === "actual-sales" ? "Leyendo…" : data.actuals.ready ? "Actualizar" : "Cargar"}<input type="file" accept=".xlsx,.xls" onChange={(event) => upload("actual-sales", event.target.files?.[0])} /></strong></label>
    </section>
    <section className="paper-metrics"><Metric label="Plan comparable" value={formatMoney(planYtd, currency)} note="hasta el corte" /><Metric label="Venta real" value={data.actuals.ready ? formatMoney(actualYtd, currency) : "Pendiente"} note={data.actuals.cutoffDate ?? "sin corte"} /><Metric label="Variación" value={planYtd ? `${((actualYtd / planYtd - 1) * 100).toFixed(1)}%` : "N/D"} note="Actual vs. Plan" tone={actualYtd < planYtd ? "warn" : "good"} /><Metric label="Desviaciones" value={String(deviations.length)} note="umbral operativo 5%" /></section>
    <section className="billing-matrix"><div className="section-title"><small>Documento oficial de seguimiento</small><h2>Billing File · Plan, cuota, real y variación</h2><p>La misma estructura mensual del Plan oficial, con fuentes faltantes visibles como —.</p></div><div className="billing-matrix-scroll"><table><thead><tr><th className="matrix-label">Métrica</th>{officialColumns.map((column) => <th key={column.key} className={column.key.startsWith("Q") || column.key === "YTD" ? "summary-col" : ""}>{column.label}</th>)}</tr></thead><tbody>{([['Plan','plan'],['Cuota','quota'],['Venta real','actual'],['Variación','variance']] as const).map(([label, metric]) => <tr className={`matrix-row ${metric === "variance" ? "percent-row" : ""}`} key={metric}><th>{label}</th>{officialColumns.map((column) => <td key={column.key} className={column.key.startsWith("Q") || column.key === "YTD" ? "summary-col" : ""}>{formatMoney(matrixValue(metric, column.key), currency)}</td>)}</tr>)}</tbody></table></div></section>
    {data.growth?.activities?.length ? <section className="activity-sheet"><header className="section-title"><small>Building blocks ejecutables</small><h2>Actividades que explican el Plan</h2></header>{data.growth.activities.map((activity) => <article key={activity.id}><div><small>{activity.family === "MARKETING" ? "Marketing" : "Trade Marketing"} · {activity.period} · {activity.skuId}</small><b>{activity.name}</b><span>{activity.evidence}</span></div><div><span>Bruto {activity.grossUnits.toLocaleString("es-MX")}</span><strong>Neto +{activity.netUnits.toLocaleString("es-MX")}</strong></div></article>)}</section> : null}
    <section className="billing-explorer">
      <div className="section-title"><small>Vista de negocio completo</small><h2>Billing consolidado</h2><p>Comienza con todos los canales y desciende por territorio, cuenta, canal, categoría, segmento, producto y periodo.</p><div><button className="paper-button" onClick={() => window.print()}>Imprimir Billing</button> <button className="clay-primary" onClick={exportBilling}>Descargar Excel/CSV</button></div></div>
      <div className="billing-filters">{billingDimensions.map(([key, label]) => {
        const values = Array.from(new Set(data.billing.map((row) => String(row[key as keyof BillingRow] ?? "").trim()).filter(Boolean))).sort();
        return <label key={key}>{label}<select value={billingFilters[key as keyof typeof billingFilters]} onChange={(event) => setBillingFilters({ ...billingFilters, [key]:event.target.value })}><option>Todos</option>{values.map((value) => <option key={value}>{value}</option>)}</select></label>;
      })}</div>
      {billingHasMissingDimensions && <p className="billing-note">La fuente no trae alguna dimensión comercial para todas las líneas. Se deja vacía y se muestra como “—”; no se inventan territorios, canales, categorías ni segmentos.</p>}
      <div className="billing-table-wrap"><table className="billing-table"><thead><tr><th>Territorio</th><th>Cuenta</th><th>Canal</th><th>Categoría</th><th>Segmento</th><th>Producto</th><th>Periodo</th><th>Plan</th><th>Cuota</th><th>Venta real</th><th>Variación</th></tr></thead><tbody><tr className="billing-total"><th colSpan={7}>Total consolidado · {billingFiltered.length} filas</th><td>{formatMoney(billingTotals.plan, currency)}</td><td>{formatMoney(billingTotals.quota, currency)}</td><td>{formatMoney(billingTotals.actual, currency)}</td><td>{formatMoney(billingTotals.variance, currency)}</td></tr>{billingFiltered.map((row) => <tr key={`${row.accountId}-${row.skuId}-${row.period}`}><td>{row.territory || "—"}</td><td>{row.accountId}</td><td>{row.channel || "—"}</td><td>{row.category || "—"}</td><td>{row.segment || "—"}</td><td>{row.skuId}</td><td>{row.period}</td><td>{formatMoney(row.planValue, currency)}</td><td>{row.quotaValue === null ? "—" : formatMoney(row.quotaValue, currency)}</td><td>{row.actualValue === null ? "—" : formatMoney(row.actualValue, currency)}</td><td className={(row.varianceValue ?? 0) < 0 ? "negative" : "positive"}>{row.varianceValue === null ? "—" : formatMoney(row.varianceValue, currency)}</td></tr>)}</tbody></table></div>
    </section>
    <section className="monthly-comparison">
      <header><b>Mes</b><span>Plan</span><span>Cuota</span><span>Venta real</span><span>Variación</span><span>Acción</span></header>
      {comparison.map((row) => {
        const existing = actions.find((action) => action.period === row.period && action.status !== "CLOSED");
        return <article key={row.period}><b>{row.month}</b><span>{formatMoney(row.plan, currency)}</span><span>{row.quota === null ? "—" : formatMoney(row.quota, currency)}</span><span>{row.actual === null ? "—" : formatMoney(row.actual, currency)}</span><strong className={(row.rate ?? 0) < 0 ? "negative" : "positive"}>{row.rate === null ? "—" : `${(row.rate * 100).toFixed(1)}%`}</strong><button disabled={row.rate === null || Math.abs(row.rate) < .05 || Boolean(existing)} onClick={() => setSelectedPeriod(row.period)}>{existing ? "En seguimiento" : "Registrar"}</button></article>;
      })}
    </section>
    {selectedPeriod && <form className="action-form" onSubmit={createAction}><div><small>Nueva acción</small><h2>{selectedPeriod}</h2></div><label>Causa<textarea required value={form.cause} onChange={(event) => setForm({ ...form, cause:event.target.value })} /></label><label>Evidencia<textarea required value={form.evidence} onChange={(event) => setForm({ ...form, evidence:event.target.value })} /></label><label>Acción correctiva<textarea required value={form.action} onChange={(event) => setForm({ ...form, action:event.target.value })} /></label><label>Responsable<input required value={form.responsible} onChange={(event) => setForm({ ...form, responsible:event.target.value })} /></label><label>Fecha compromiso<input required placeholder="AAAA-MM-DD" pattern="\d{4}-\d{2}-\d{2}" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate:event.target.value })} /></label><div><button type="button" className="paper-button" onClick={() => setSelectedPeriod("")}>Cancelar</button><button className="clay-primary" disabled={busy === "action"}>Guardar acción</button></div></form>}
    <section className="action-register"><div className="section-title"><small>Registro vivo</small><h2>Acciones y responsables</h2></div>{actions.map((item) => <article key={item.id}><div><span>{item.status === "OPEN" ? "Abierta" : item.status === "IN_PROGRESS" ? "En seguimiento" : "Cerrada"}</span><b>{item.period}</b><small>Vence {item.due_date}</small></div><div><b>{item.action}</b><p>{item.cause}</p><small>{item.responsible}</small></div>{item.status !== "CLOSED" && <div>{item.status === "OPEN" && <button className="paper-button" onClick={() => updateAction(item, "IN_PROGRESS")}>Iniciar</button>}<textarea placeholder="Resultado obtenido" value={outcomes[item.id] ?? ""} onChange={(event) => setOutcomes({ ...outcomes, [item.id]:event.target.value })} /><button className="clay-primary" disabled={!outcomes[item.id]?.trim() || busy === item.id} onClick={() => updateAction(item, "CLOSED")}>Cerrar</button></div>}</article>)}{!actions.length && <EmptyAnswer title="No hay acciones registradas" copy="Cuando una desviación supere el umbral, podrás documentarla desde el comparativo." />}</section>
  </div>;
}
