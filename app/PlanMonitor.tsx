"use client";

import { useEffect, useMemo, useState } from "react";

type Activity = {
  id: string; family: "MARKETING" | "TRADE_MARKETING"; name: string;
  skuId: string; period: string; grossUnits: number; netUnits: number; status: string;
};
type MonitorData = {
  plan: { id: string; company: string; account: string; year: number; currency: string; version: number; status: string };
  growth: null | { activities: Activity[]; grossUnits: number; netUnits: number; controls: { reconciled: boolean } };
  result: null | { currency: string; lines: Array<{ period: string; skuId: string; planUnits: number; planValue: number }> };
  datasets: Array<{ requirementId: string; status: string; summary: { periods: string[] }; receivedAt: string }>;
  updatedAt: string;
};

const periods = ["Ene", "Feb", "Mar", "T1", "Abr", "May", "Jun", "T2", "Jul", "Ago", "Sep", "T3", "Oct", "Nov", "Dic", "T4", "FY", "YTD"];
const monthKeys = ["01", "02", "03", "Q1", "04", "05", "06", "Q2", "07", "08", "09", "Q3", "10", "11", "12", "Q4", "FY", "YTD"];

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export default function PlanMonitor({ planId, onExit }: { planId: string; onExit: () => void }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"blocks" | "billing">("blocks");
  const [family, setFamily] = useState<"TODOS" | "MARKETING" | "TRADE_MARKETING">("TODOS");

  useEffect(() => {
    fetch(`/api/monitoring?planId=${encodeURIComponent(planId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as MonitorData & { ok?: boolean; error?: string };
        if (!response.ok || body.ok === false) throw new Error(body.error);
        setData(body);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No pudimos abrir Monitoreo"));
  }, [planId]);

  const activities = useMemo(() =>
    (data?.growth?.activities ?? []).filter((item) => family === "TODOS" || item.family === family),
  [data, family]);
  const planValues = useMemo(() => {
    const monthly = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return [month, sum((data?.result?.lines ?? []).filter((line) => line.period.endsWith(`-${month}`)).map((line) => line.planValue))];
    }));
    const q = (start: number) => sum(Array.from({ length: 3 }, (_, index) => monthly[String(start + index).padStart(2, "0")]));
    return { ...monthly, Q1: q(1), Q2: q(4), Q3: q(7), Q4: q(10), FY: sum(Object.values(monthly)), YTD: null };
  }, [data]);

  if (error) return <div className="monitor-shell"><div className="recoverable-error" role="alert">{error}</div><button className="secondary" onClick={onExit}>Volver al lobby</button></div>;
  if (!data) return <div className="recovery-loading"><span /><b>Abriendo Monitoreo…</b></div>;
  const quotaReady = data.datasets.some((item) => item.requirementId === "sales-quota" && item.status === "READY");
  const actualReady = data.datasets.some((item) => item.requirementId === "actual-sales" && item.status === "READY");

  return (
    <div className="monitor-shell">
      <header className="monitor-head">
        <div><p className="eyebrow">Monitoreo · {data.plan.status}</p><h1>{data.plan.account} · {data.plan.year}</h1><p>{data.plan.company} · Versión {data.plan.version} · {data.plan.currency}</p></div>
        <button className="secondary" onClick={onExit}>← Volver al lobby</button>
      </header>
      <nav className="monitor-tabs" aria-label="Vistas de Monitoreo">
        <button className={view === "blocks" ? "active" : ""} onClick={() => setView("blocks")}>Building blocks</button>
        <button className={view === "billing" ? "active" : ""} onClick={() => setView("billing")}>Vista integral Billing</button>
      </nav>

      {view === "blocks" ? (
        <section className="monitor-panel">
          <div className="monitor-title"><div><p className="eyebrow">Entrada de Monitoreo</p><h2>Building blocks del Plan</h2></div><button className="primary" onClick={() => setView("billing")}>Abrir vista integral →</button></div>
          <div className="monitor-kpis">
            <article><span>Incremental bruto</span><b>{data.growth ? data.growth.grossUnits.toLocaleString("es-MX") : "Sin resultado"}</b><small>unidades</small></article>
            <article><span>Incremental neto</span><b>{data.growth ? data.growth.netUnits.toLocaleString("es-MX") : "Sin resultado"}</b><small>unidades reconciliadas</small></article>
            <article><span>Building blocks</span><b>{data.growth?.activities.length ?? 0}</b><small>Marketing + Trade Marketing</small></article>
            <article><span>Reconciliación</span><b>{data.growth?.controls.reconciled ? "Lista" : "Pendiente"}</b><small>versión guardada</small></article>
          </div>
          <div className="monitor-filters">
            {(["TODOS", "MARKETING", "TRADE_MARKETING"] as const).map((item) => <button key={item} className={family === item ? "active" : ""} onClick={() => setFamily(item)}>{item === "TODOS" ? "Todos" : item === "MARKETING" ? "Marketing" : "Trade Marketing"}</button>)}
          </div>
          <div className="blocks-table">
            <div className="blocks-row head"><span>Building block</span><span>Familia</span><span>Periodo</span><span>SKU</span><span>Bruto</span><span>Neto</span><span>Estado</span></div>
            {activities.map((item) => <div className="blocks-row" key={item.id}><b>{item.name}</b><span>{item.family === "MARKETING" ? "Marketing" : "Trade Marketing"}</span><span>{item.period}</span><span>{item.skuId}</span><span>{item.grossUnits.toLocaleString("es-MX")}</span><strong>{item.netUnits.toLocaleString("es-MX")}</strong><small>{item.status}</small></div>)}
            {!activities.length && <div className="monitor-empty">Esta versión no tiene building blocks guardados.</div>}
          </div>
        </section>
      ) : (
        <section className="monitor-panel billing-panel">
          <div className="monitor-title"><div><p className="eyebrow">Billing File Customer</p><h2>Vista integral del Plan</h2><p>Meses, trimestres, FY y YTD · valores en {data.result?.currency ?? data.plan.currency}</p></div></div>
          <div className="dataset-health">
            <span className="ready">Plan guardado</span>
            <span className={quotaReady ? "ready" : "missing"}>{quotaReady ? "Cuota recibida" : "Cuota · sin dataset"}</span>
            <span className={actualReady ? "ready" : "missing"}>{actualReady ? "Actual recibido" : "Actual · sin dataset"}</span>
            <span className="ready">Año anterior · historia disponible</span>
          </div>
          <div className="billing-scroll">
            <div className="billing-grid header"><b>Métrica</b>{periods.map((period) => <span key={period}>{period}</span>)}</div>
            <div className="billing-grid"><b>Plan</b>{monthKeys.map((key) => <span key={key}>{key === "YTD" ? "N/D" : (planValues[key as keyof typeof planValues] ?? 0).toLocaleString("es-MX")}</span>)}</div>
            {["Cuota", "Actual", "Vs. cuota %", "Vs. cuota valor", "Año anterior", "Variación %", "Variación valor"].map((metric) => <div className="billing-grid muted" key={metric}><b>{metric}</b>{monthKeys.map((key) => <span key={key}>Sin dato</span>)}</div>)}
          </div>
          <div className="billing-note"><b>Comparaciones protegidas</b><span>REVENUE no calcula porcentajes ni variaciones hasta recibir cuota, Actuals y un corte comparable válido.</span></div>
        </section>
      )}
      <footer className="monitor-footer"><span>Última actualización · {new Date(data.updatedAt).toLocaleString("es-MX")}</span><button className="secondary" onClick={onExit}>Volver al lobby</button></footer>
    </div>
  );
}
