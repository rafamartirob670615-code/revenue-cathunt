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
  actuals: { ready: boolean; cutoffDate: string | null; months: Record<string, { value: number; units: number }>; includedRows: number; excludedRows: number };
  quota: { ready: boolean; months: Record<string, { value: number; units: number }>; includedRows: number; excludedRows: number };
  priorYear: { year: number | null; months: Record<string, { value: number; units: number }> };
  datasets: Array<{ requirementId: string; status: string; summary: { periods: string[] }; receivedAt: string }>;
  updatedAt: string;
};

const periods = ["Ene", "Feb", "Mar", "T1", "Abr", "May", "Jun", "T2", "Jul", "Ago", "Sep", "T3", "Oct", "Nov", "Dic", "T4", "FY", "YTD"];
const monthKeys = ["01", "02", "03", "Q1", "04", "05", "06", "Q2", "07", "08", "09", "Q3", "10", "11", "12", "Q4", "FY", "YTD"];

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function annualView(monthly: Record<string, number>, ytdMonth: number | null) {
  const q = (start: number) => sum(Array.from({ length: 3 }, (_, index) => monthly[String(start + index).padStart(2, "0")] ?? 0));
  const fy = sum(Object.values(monthly));
  const ytd = ytdMonth === null ? null : sum(Array.from({ length: ytdMonth }, (_, index) => monthly[String(index + 1).padStart(2, "0")] ?? 0));
  return { ...monthly, Q1: q(1), Q2: q(4), Q3: q(7), Q4: q(10), FY: fy, YTD: ytd };
}

export default function PlanMonitor({ planId, onExit }: { planId: string; onExit: () => void }) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<"blocks" | "billing">("blocks");
  const [family, setFamily] = useState<"TODOS" | "MARKETING" | "TRADE_MARKETING">("TODOS");
  const [uploading, setUploading] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");

  function loadMonitoring() {
    setError("");
    fetch(`/api/monitoring?planId=${encodeURIComponent(planId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as MonitorData & { ok?: boolean; error?: string };
        if (!response.ok || body.ok === false) throw new Error(body.error);
        setData(body);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No pudimos abrir Monitoreo"));
  }

  useEffect(() => {
    loadMonitoring();
    // planId identifica por completo el Monitoreo que debe cargarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function uploadDataset(requirementId: "sales-quota" | "actual-sales", file?: File) {
    if (!file) return;
    setUploading(requirementId);
    setUploadMessage("");
    try {
      const form = new FormData();
      form.set("planId", planId);
      form.set("requirementId", requirementId);
      form.set("file", file);
      const response = await fetch("/api/inputs", { method: "POST", body: form });
      const body = await response.json() as { ok?: boolean; error?: string; result?: { status: string } };
      if (!response.ok || !body.ok) throw new Error(body.error);
      if (body.result?.status !== "READY") throw new Error("El Excel se recibió, pero tiene campos o filas que deben corregirse.");
      setUploadMessage(requirementId === "actual-sales" ? "Actuals listos y comparados." : "Cuota lista y comparada.");
      loadMonitoring();
    } catch (cause) {
      setUploadMessage(cause instanceof Error ? cause.message : "No pudimos procesar el Excel.");
    } finally {
      setUploading("");
    }
  }

  const activities = useMemo(() =>
    (data?.growth?.activities ?? []).filter((item) => family === "TODOS" || item.family === family),
  [data, family]);
  const planValues = useMemo(() => {
    const monthly = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return [month, sum((data?.result?.lines ?? []).filter((line) => line.period.endsWith(`-${month}`)).map((line) => line.planValue))];
    }));
    const cutoffMonth = data?.actuals.cutoffDate ? Number(data.actuals.cutoffDate.slice(5, 7)) : null;
    return annualView(monthly, cutoffMonth);
  }, [data]);
  if (error) return <div className="monitor-shell"><div className="recoverable-error" role="alert">{error}</div><button className="secondary" onClick={onExit}>Volver al lobby</button></div>;
  if (!data) return <div className="recovery-loading"><span /><b>Abriendo Monitoreo…</b></div>;
  const cutoffMonth = data.actuals.cutoffDate ? Number(data.actuals.cutoffDate.slice(5, 7)) : null;
  const actualValues = annualView(Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return [month, data.actuals.months[`${data.plan.year}-${month}`]?.value ?? 0];
  })), cutoffMonth);
  const quotaValues = annualView(Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return [month, data.quota.months[`${data.plan.year}-${month}`]?.value ?? 0];
  })), cutoffMonth);
  const priorValues = annualView(Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return [month, data.priorYear.months[`${data.plan.year}-${month}`]?.value ?? 0];
  })), cutoffMonth);
  const variance = (actual: number | null, comparison: number | null, percent = false) =>
    actual === null || comparison === null || (percent && comparison === 0)
      ? null : percent ? actual / comparison - 1 : actual - comparison;
  const formatValue = (value: number | null, percent = false) =>
    value === null ? "N/D" : percent
      ? value.toLocaleString("es-MX", { style: "percent", maximumFractionDigits: 1 })
      : value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  const actualComparable = (key: string) => {
    if (cutoffMonth === null) return null;
    if (/^\d{2}$/.test(key)) return Number(key) <= cutoffMonth ? actualValues[key] ?? 0 : null;
    if (/^Q[1-4]$/.test(key)) return cutoffMonth >= Number(key.slice(1)) * 3 ? actualValues[key] ?? 0 : null;
    if (key === "FY") return cutoffMonth === 12 ? actualValues.FY : null;
    return actualValues.YTD;
  };
  const quotaReady = data.quota.ready;
  const actualReady = data.actuals.ready;

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
            <label className={quotaReady ? "ready monitor-upload" : "missing monitor-upload"}>
              {uploading === "sales-quota" ? "Procesando cuota…" : quotaReady ? "Cuota recibida · reemplazar" : "Cargar cuota Excel"}
              <input type="file" accept=".xlsx,.xls" disabled={Boolean(uploading)} onChange={(event) => uploadDataset("sales-quota", event.target.files?.[0])} />
            </label>
            <label className={actualReady ? "ready monitor-upload" : "missing monitor-upload"}>
              {uploading === "actual-sales" ? "Procesando Actuals…" : actualReady ? "Actuals recibidos · actualizar" : "Cargar Actuals Excel"}
              <input type="file" accept=".xlsx,.xls" disabled={Boolean(uploading)} onChange={(event) => uploadDataset("actual-sales", event.target.files?.[0])} />
            </label>
            <span className={data.priorYear.year ? "ready" : "missing"}>{data.priorYear.year ? `Año anterior · ${data.priorYear.year}` : "Año anterior · sin comparador"}</span>
          </div>
          {uploadMessage && <div className="monitor-upload-message">{uploadMessage}</div>}
          {actualReady && <div className="monitor-cutoff"><b>Corte comparable</b><span>{data.actuals.cutoffDate ?? "Sin fecha"} · {data.actuals.includedRows} filas incorporadas{data.actuals.excludedRows ? ` · ${data.actuals.excludedRows} fuera del Plan` : ""}</span></div>}
          <div className="billing-scroll">
            <div className="billing-grid header"><b>Métrica</b>{periods.map((period) => <span key={period}>{period}</span>)}</div>
            <div className="billing-grid"><b>Plan</b>{monthKeys.map((key) => <span key={key}>{formatValue(planValues[key as keyof typeof planValues] ?? null)}</span>)}</div>
            <div className={`billing-grid ${quotaReady ? "" : "muted"}`}><b>Cuota</b>{monthKeys.map((key) => <span key={key}>{quotaReady ? formatValue(quotaValues[key as keyof typeof quotaValues] ?? null) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid actual-row ${actualReady ? "" : "muted"}`}><b>Actual</b>{monthKeys.map((key) => <span key={key}>{actualReady ? formatValue(actualComparable(key)) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid ${actualReady ? "" : "muted"}`}><b>Vs. Plan %</b>{monthKeys.map((key) => <span key={key}>{actualReady ? formatValue(variance(actualComparable(key), planValues[key as keyof typeof planValues] ?? null, true), true) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid ${actualReady ? "" : "muted"}`}><b>Gap vs. Plan</b>{monthKeys.map((key) => <span key={key}>{actualReady ? formatValue(variance(actualComparable(key), planValues[key as keyof typeof planValues] ?? null)) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid ${actualReady && quotaReady ? "" : "muted"}`}><b>Vs. cuota %</b>{monthKeys.map((key) => <span key={key}>{actualReady && quotaReady ? formatValue(variance(actualComparable(key), quotaValues[key as keyof typeof quotaValues] ?? null, true), true) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid ${data.priorYear.year && actualReady ? "" : "muted"}`}><b>Año anterior</b>{monthKeys.map((key) => <span key={key}>{data.priorYear.year ? formatValue(priorValues[key as keyof typeof priorValues] ?? null) : "Sin dato"}</span>)}</div>
            <div className={`billing-grid ${data.priorYear.year && actualReady ? "" : "muted"}`}><b>Variación vs. AA</b>{monthKeys.map((key) => <span key={key}>{data.priorYear.year && actualReady ? formatValue(variance(actualComparable(key), priorValues[key as keyof typeof priorValues] ?? null, true), true) : "Sin dato"}</span>)}</div>
          </div>
          <div className="billing-note"><b>Comparaciones protegidas</b><span>Los cálculos sólo usan cuenta, SKU, periodo y moneda que coinciden con el Plan. YTD termina en el mes de la fecha de corte recibida.</span></div>
        </section>
      )}
      <footer className="monitor-footer"><span>Última actualización · {new Date(data.updatedAt).toLocaleString("es-MX")}</span><button className="secondary" onClick={onExit}>Volver al lobby</button></footer>
    </div>
  );
}
