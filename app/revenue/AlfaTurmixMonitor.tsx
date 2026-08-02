"use client";

import { useEffect, useState } from "react";

type FilterKey = "territory" | "account" | "accountGroup" | "channel" | "subchannel" | "family" | "product" | "period";
type Filters = Record<FilterKey, string>;
type MatrixBlock = { label: string; rows: Array<{ metric: string; kind: "value" | "percent"; values: Record<string, number | null> }> };
type Body = { dataset: { label: string; category: string }; options: Record<string, string[]>; matrix: MatrixBlock[]; rows: Array<AlfaRow>; exportRows?: Array<AlfaRow>; rowCount: number; totals: { actualValue: number; acceptedPlanValue: number; coverage: number | null; vsLastYearValue: number; vsLastYearPercent: number | null } };
type AlfaRow = { territory: string; account: string; accountGroup: string; channel: string; subchannel: string; family: string; product: string; period: string; actualValue: number; acceptedPlanValue: number };

const filterKeys: FilterKey[] = ["territory", "account", "accountGroup", "channel", "subchannel", "family", "product", "period"];
const labels: Record<FilterKey, string> = { territory: "Territorio", account: "Cuenta", accountGroup: "Agrupación", channel: "Canal", subchannel: "Subcanal", family: "Familia", product: "Producto", period: "Periodo" };
const columns = [{ key: "01", label: "Ene" }, { key: "02", label: "Feb" }, { key: "03", label: "Mar" }, { key: "Q1", label: "Q1" }, { key: "04", label: "Abr" }, { key: "05", label: "May" }, { key: "06", label: "Jun" }, { key: "Q2", label: "Q2" }, { key: "07", label: "Jul" }, { key: "08", label: "Ago" }, { key: "09", label: "Sep" }, { key: "Q3", label: "Q3" }, { key: "10", label: "Oct" }, { key: "11", label: "Nov" }, { key: "12", label: "Dic" }, { key: "Q4", label: "Q4" }, { key: "YTD", label: "YTD" }];
const initial: Filters = { territory: "Todos", account: "Todos", accountGroup: "Todos", channel: "Todos", subchannel: "Todos", family: "Todos", product: "Todos", period: "Todos" };

function money(value: number | null) { return value === null ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(value); }
function display(value: number | null, kind: "value" | "percent") { return value === null ? "—" : kind === "percent" ? `${(value * 100).toFixed(0)}%` : money(value); }

export default function AlfaTurmixMonitor() {
  const [filters, setFilters] = useState<Filters>(initial);
  const [accountQuery, setAccountQuery] = useState("");
  const [body, setBody] = useState<Body | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "Todos"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/monitoring/alfa-turmix?${params.toString()}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const result = await response.json() as Body & { error?: string };
      if (!response.ok) throw new Error(result.error || "No pudimos abrir ALFA Turmix");
      setBody(result); setError("");
    }).catch((problem: unknown) => { if (!(problem instanceof DOMException && problem.name === "AbortError")) setError(problem instanceof Error ? problem.message : "No pudimos abrir el monitoreo"); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters]);

  if (loading && !body) return <main className="revenue-content"><div className="platform-loading"><span /><b>Abriendo Billing File…</b></div></main>;
  if (error && !body) return <main className="revenue-content"><div className="platform-error">{error}</div></main>;
  if (!body) return null;
  function updateFilter(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === "account") setAccountQuery(value === "Todos" ? "" : value);
  }
  const selectedAccount = filters.account === "Todos" ? null : filters.account;
  const scopeLabel = selectedAccount ? `Cuenta · ${selectedAccount}` : filters.territory !== "Todos" ? `Territorio · ${filters.territory}` : filters.channel !== "Todos" ? `Canal · ${filters.channel}` : "Compañía completa";
  function clearAccount() {
    setAccountQuery("");
    setFilters((current) => ({ ...current, account: "Todos" }));
  }
  function exportBilling() {
    const header = ["Territorio","Cuenta","Agrupación","Canal","Subcanal","Familia","Producto","Periodo","Actual","Plan","Variación"];
    const rows = (body.exportRows ?? body.rows).map((row) => [row.territory,row.account,row.accountGroup,row.channel,row.subchannel,row.family,row.product,row.period,row.actualValue,row.acceptedPlanValue,row.actualValue - row.acceptedPlanValue]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `REVENUE_Billing_${selectedAccount ?? "compania"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return <main className="revenue-content"><div className="module-page billing-report">
    <header className="module-head"><div><p>Monitoreo · ALFA Turmix</p><h1>Billing File</h1><span>Reporte oficial de avance. La vista comienza con el total del negocio y conserva la lectura matricial del Excel.</span></div><span className="synthetic-badge">{body.dataset.label}</span></header>
    <section className="monitor-scope-bar"><div><small>Alcance seleccionado</small><b>{scopeLabel}</b><span>{body.rowCount.toLocaleString("es-MX")} líneas del universo · cambia filtros sin perder el contexto.</span></div><div><button className="paper-button" onClick={clearAccount} disabled={!selectedAccount}>← Todas las cuentas</button><button className="paper-button" onClick={() => window.print()}>Imprimir</button><button className="clay-primary" onClick={exportBilling}>Descargar Excel/CSV</button></div></section>
    {error && <div className="platform-error">{error}</div>}
    <section className="billing-report-head"><div><small>Cuenta / negocio</small><b>Electrodomésticos</b><span>ALFA Turmix · 2027 · MXN</span></div><div><small>Actual ERP</small><b>{money(body.totals.actualValue)}</b><span>Venta acumulada</span></div><div><small>Plan aceptado</small><b>{money(body.totals.acceptedPlanValue)}</b><span>Comparador oficial</span></div><div><small>Cobertura</small><b>{display(body.totals.coverage, "percent")}</b><span>Actual vs. Plan</span></div><div><small>Vs. año anterior</small><b>{money(body.totals.vsLastYearValue)}</b><span>{display(body.totals.vsLastYearPercent, "percent")}</span></div></section>
    <section className="billing-filters billing-report-filters"><div className="billing-report-filter-primary">{(["territory", "channel"] as FilterKey[]).map((key) => <label key={key}>{labels[key]}<select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}><option>Todos</option>{(body.options[key] ?? []).map((value) => <option key={value}>{value}</option>)}</select></label>)}<label>Cuenta <span className="billing-filter-hint">{body.options.account?.length ?? 0} disponibles</span><input aria-label="Cuenta" list="alfa-account-options" value={filters.account === "Todos" ? accountQuery : filters.account} placeholder="Buscar cuenta…" onChange={(event) => { const value = event.target.value; setAccountQuery(value); updateFilter("account", (body.options.account ?? []).includes(value) ? value : "Todos"); }} /><datalist id="alfa-account-options">{(body.options.account ?? []).map((value) => <option key={value} value={value} />)}</datalist></label></div><details className="billing-report-more"><summary>Más segmentaciones</summary><div>{filterKeys.filter((key) => !["territory", "account", "channel"].includes(key)).map((key) => <label key={key}>{labels[key]}<select value={filters[key]} onChange={(event) => updateFilter(key, event.target.value)}><option>Todos</option>{(body.options[key] ?? []).map((value) => <option key={value}>{value}</option>)}</select></label>)}</div></details></section>
    <section className="billing-matrix"><div className="billing-matrix-scroll"><table><thead><tr><th className="matrix-label">{filters.family === "Todos" ? "Total de la cuenta" : filters.family}</th>{columns.map((column) => <th key={column.key} className={column.key.startsWith("Q") || column.key === "FY" || column.key === "YTD" ? "summary-col" : ""}>{column.label}</th>)}</tr></thead><tbody>{body.matrix.map((block) => <>{<tr className="matrix-block"><th colSpan={columns.length + 1}>{block.label}</th></tr>}{block.rows.map((row) => <tr key={`${block.label}-${row.metric}`} className={`matrix-row ${row.kind === "percent" ? "percent-row" : ""}`}><th>{row.metric}</th>{columns.map((column) => <td key={column.key} className={`${column.key.startsWith("Q") || column.key === "FY" || column.key === "YTD" ? "summary-col" : ""} ${(row.values[column.key] ?? 0) < 0 ? "negative" : ""}`}>{display(row.values[column.key], row.kind)}</td>)}</tr>)}</>)}</tbody></table></div></section>
    <p className="billing-report-note"><b>Lectura:</b> las columnas verdes son meses y las azules son acumulados trimestrales y YTD. FY no se muestra porque no agrega una decisión distinta. Los bloques se calculan desde el universo filtrado y no son cifras capturadas manualmente.</p>
  </div></main>;
}
