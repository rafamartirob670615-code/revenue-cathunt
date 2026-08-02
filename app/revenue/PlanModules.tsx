"use client";

import type { Plan } from "../../domain/types";
import { PILOT_INPUT_REQUIREMENTS } from "../../domain/input-package";
import type { BaselineResult, BaselineReview, Contribution, GrowthResult, PlanResult, ProfitabilityResult, ReceivedFile } from "./model";
import { EmptyAnswer, Metric, ModuleHead, formatMoney } from "./ui";

const billingColumns = [
  ["01", "Ene"], ["02", "Feb"], ["03", "Mar"], ["Q1", "Q1"],
  ["04", "Abr"], ["05", "May"], ["06", "Jun"], ["Q2", "Q2"],
  ["07", "Jul"], ["08", "Ago"], ["09", "Sep"], ["Q3", "Q3"],
  ["10", "Oct"], ["11", "Nov"], ["12", "Dic"], ["Q4", "Q4"], ["YTD", "YTD"],
] as const;

function OfficialPlanBilling({ result }: { result: PlanResult }) {
  const products = [...new Set(result.lines.map((line) => line.skuId))];
  const quarterMonths: Record<string, string[]> = { Q1: ["01", "02", "03"], Q2: ["04", "05", "06"], Q3: ["07", "08", "09"], Q4: ["10", "11", "12"] };
  const valueFor = (skuId: string, period: string, field: "planUnits" | "planValue") => result.lines.filter((line) => line.skuId === skuId && line.period.endsWith(`-${period}`)).reduce((sum, line) => sum + line[field], 0);
  const cells = (skuId: string, field: "planUnits" | "planValue") => billingColumns.map(([key]) => {
    if (key === "YTD") return result.lines.filter((line) => line.skuId === skuId).reduce((sum, line) => sum + line[field], 0);
    if (key.startsWith("Q")) return (quarterMonths[key] ?? []).reduce((sum, month) => sum + valueFor(skuId, month, field), 0);
    return valueFor(skuId, key, field);
  });
  return <section className="billing-matrix"><div className="billing-matrix-scroll"><table><thead><tr><th className="matrix-label">Billing File · Plan</th>{billingColumns.map(([key, label]) => <th key={key} className={key.startsWith("Q") || key === "YTD" ? "summary-col" : ""}>{label}</th>)}</tr></thead><tbody><tr className="matrix-block"><th colSpan={billingColumns.length + 1}>Unidades del Plan</th></tr>{products.map((skuId) => <tr className="matrix-row" key={`units-${skuId}`}><th>{skuId}</th>{cells(skuId, "planUnits").map((value, index) => <td key={billingColumns[index][0]} className={billingColumns[index][0].startsWith("Q") || billingColumns[index][0] === "YTD" ? "summary-col" : ""}>{value.toLocaleString("es-MX")}</td>)}</tr>)}<tr className="matrix-block"><th colSpan={billingColumns.length + 1}>Valor del Plan · {result.currency}</th></tr>{products.map((skuId) => <tr className="matrix-row" key={`value-${skuId}`}><th>{skuId}</th>{cells(skuId, "planValue").map((value, index) => <td key={billingColumns[index][0]} className={billingColumns[index][0].startsWith("Q") || billingColumns[index][0] === "YTD" ? "summary-col" : ""}>{formatMoney(value, result.currency)}</td>)}</tr>)}</tbody></table></div></section>;
}

export function ContextModule({ plan }: { plan: Plan }) {
  const version = plan.versions.at(-1);
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 1 de 8 · Contexto" title="El Plan comienza con una sola cuenta" description="Este contexto gobierna archivos, cálculos, decisiones, aprobaciones y seguimiento. No se vuelve a capturar en cada pantalla." />
    <section className="context-sheet">
      <div><span>Compañía</span><strong>{plan.companyName}</strong><small>Organización responsable</small></div>
      <div><span>Cuenta</span><strong>{plan.accountName}</strong><small>Cliente que se está planeando</small></div>
      <div><span>Año</span><strong>{plan.year}</strong><small>Horizonte anual</small></div>
      <div><span>Moneda</span><strong>{plan.currency}</strong><small>Moneda de reporte</small></div>
      <div><span>Versión</span><strong>V{version?.number ?? 1}</strong><small>Historia controlada del Plan</small></div>
      <div><span>Estado</span><strong>{version?.status === "DRAFT" ? "En construcción" : version?.status ?? "Borrador"}</strong><small>Gobierno de la versión</small></div>
    </section>
    <section className="plain-note"><b>Regla del recorrido</b><p>Cada pantalla responde una sola pregunta. Puedes abrir todas las etapas desde el menú; cuando falte una dependencia, REVENUE te dirá exactamente cuál es.</p></section>
  </div>;
}

export function InformationModule({
  files, accepted, systemReady, busy, onUpload, onAccept,
}: {
  files: ReceivedFile[]; accepted: boolean; systemReady: boolean; busy: string;
  onUpload: (requirementId: string, file?: File) => void; onAccept: () => void;
}) {
  const essential = PILOT_INPUT_REQUIREMENTS.filter((requirement) => requirement.criticality === "ESSENTIAL");
  const salesReceived = files.some((file) => file.requirementId === "sales-history" && file.status === "READY");
  const visibleEssential = salesReceived ? essential : essential.filter((requirement) => requirement.id === "sales-history");
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 2 de 8 · Información" title="Entrega los archivos que la empresa ya usa" description="No hay formatos escondidos ni una captura interminable. REVENUE conserva el original, interpreta la tabla y muestra qué entendió." />
    <section className="plain-note"><b>Cómo preparar la información</b><p>Obligatorios para calcular el Volumen base: historia de ventas, catálogo y correspondencias, unidades/conversiones y precios/moneda. Las fuentes opcionales se solicitan sólo cuando desbloquean una etapa concreta: Marketing, Trade Marketing, condiciones comerciales, costos, inversiones, cuota y venta actual. Cada tarjeta indica para qué se usa, quién suele entregar el archivo y qué cobertura mínima necesita.</p></section>
    <section className="source-board">
      {visibleEssential.map((requirement, index) => {
        const received = files.find((file) => file.requirementId === requirement.id);
        return <article className={received?.status === "READY" ? "ready" : ""} key={requirement.id}>
          <i>{received?.status === "READY" ? "✓" : index + 1}</i>
          <div><b>{requirement.name} <em>{requirement.criticality === "ESSENTIAL" ? "· Obligatorio" : "· Opcional según etapa"}</em></b><p>{requirement.purpose}</p><small>Responsable sugerido: {requirement.suggestedOwner} · Cobertura: {requirement.minimumCoverage}</small>{received && <small>{received.originalName} · {received.summary.rowCount} filas</small>}{received?.status === "INCOMPLETE" && <small className="negative">Falta: {received.missingFields.join(", ") || "corregir filas"}</small>}</div>
          <label>{busy === requirement.id ? "Leyendo…" : received ? "Reemplazar" : "Seleccionar archivo"}<input type="file" accept=".xlsx,.xls,.csv" disabled={Boolean(busy)} onChange={(event) => onUpload(requirement.id, event.target.files?.[0])} /></label>
        </article>;
      })}
    </section>
    <details className="paper-detail"><summary>Fuentes complementarias</summary><div className="source-board compact">
      {PILOT_INPUT_REQUIREMENTS.filter((requirement) => requirement.criticality === "CONDITIONAL").map((requirement) => {
        const received = files.find((file) => file.requirementId === requirement.id);
        return <article className={received?.status === "READY" ? "ready" : ""} key={requirement.id}><i>{received?.status === "READY" ? "✓" : "·"}</i><div><b>{requirement.name} <em>· Opcional según etapa</em></b><p>{requirement.purpose}</p><small>Se usa en: {requirement.suggestedOwner} · Necesita: {requirement.minimumCoverage}</small>{received?.status === "INCOMPLETE" && <small className="negative">Falta: {received.missingFields.join(", ") || "corregir filas"}</small>}</div><label>{received ? "Reemplazar" : "Cargar"}<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onUpload(requirement.id, event.target.files?.[0])} /></label></article>;
      })}
    </div></details>
    {!accepted && systemReady && <EmptyAnswer title="La información esencial está completa" copy="Confirma la interpretación para construir el Volumen base." action={<button className="clay-primary" onClick={onAccept}>Confirmar información</button>} />}
    {!accepted && !systemReady && <section className="plain-note"><b>Demo sintética oficial</b><p>Carga directamente los 11 archivos desde <code>outputs/demo_sintetica_oficial/inputs/</code>. La antigua acción “Usar prueba guiada” no genera ni sustituye fuentes.</p></section>}
    {accepted && <section className="answer-card good"><div><small>Resultado</small><h2>Información aceptada</h2><p>Los datasets canónicos ya pueden alimentar los cálculos de este Plan.</p></div><span>Listo</span></section>}
  </div>;
}

export function BaselineModule({ baseline, review, ready, busy, onCalculate, onApprove }: { baseline: BaselineResult | null; review: BaselineReview | null; ready: boolean; busy: string; onCalculate: () => void; onApprove: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 3 de 8 · Volumen base" title="¿Qué venderíamos sin nuevas actividades?" description="La historia aceptada se limpia de impactos conocidos y produce una base mensual defendible." />
    <span className="billing-filter-hint">Resultado mensual por producto · trazabilidad línea por línea</span>
    {baseline ? <>
      <section className="single-answer"><span>Volumen base anual</span><strong>{baseline.annualUnits.toLocaleString("es-MX")}</strong><small>unidades · {baseline.targetYear}</small><p>{baseline.explanation}</p></section>
      <section className="paper-metrics"><Metric label="Historia utilizada" value={`${baseline.historyPeriods} periodos`} note="fuente aceptada" /><Metric label="Decisión" value={review?.status === "APPROVED_FROZEN" ? "Aprobada" : "Pendiente"} note="antes de sumar crecimiento" tone={review?.status === "APPROVED_FROZEN" ? "good" : "warn"} /></section>
      <details className="paper-detail" open><summary>De dónde venía cada línea y a qué base llegó</summary><div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>De · promedio observado</span><span>A · base calculada</span></div>{baseline.lines.map((line) => <div className="paper-row" key={`${line.accountId}|${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span><b>{line.observedAverageUnits.toLocaleString("es-MX")}</b><small>{(line.observedUnits ?? []).length ? ` · historia: ${(line.observedUnits ?? []).map((value) => value.toLocaleString("es-MX")).join(" · ")}` : " · sin detalle histórico"}</small></span><span><b>{line.calculatedUnits.toLocaleString("es-MX")}</b><small> · confianza {Math.round(line.confidence * 100)}%</small></span></div>)}</div></details>
      {review?.status !== "APPROVED_FROZEN" && <button className="clay-primary action-wide" onClick={onApprove}>Aprobar y congelar Volumen base</button>}
    </> : <EmptyAnswer title={ready ? "Falta calcular esta respuesta" : "Primero confirma la Información"} copy={ready ? "Los archivos esenciales están aceptados y el motor puede construir la respuesta." : "Regresa a Información, completa las fuentes esenciales y confirma la interpretación."} action={ready ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onCalculate}>{busy ? "Calculando…" : "Calcular Volumen base"}</button> : undefined} />}
  </div>;
}

export function GrowthPlanModule({ family, plan, contributions, growth, source, synthetic, canBuild, canContribute, canIntegrate, waitingFor, busy, onUpload, onBuild, onContribute, onDecide }: {
  plan: Plan; contributions: Contribution[];
  family: "MARKETING" | "TRADE_MARKETING"; growth: GrowthResult | null; source?: ReceivedFile;
  synthetic: boolean; canBuild: boolean; canContribute: boolean; canIntegrate: boolean; waitingFor: string; busy: string; onUpload: (requirementId: string, file?: File) => void; onBuild: () => void;
  onContribute: (event: React.FormEvent<HTMLFormElement>, family: "MARKETING" | "TRADE_MARKETING") => void;
  onDecide: (id: string, status: "ACCEPTED" | "RETURNED") => void;
}) {
  const isMarketing = family === "MARKETING";
  const activities = growth?.activities.filter((activity) => activity.family === family) ?? [];
  const gross = activities.reduce((sum, activity) => sum + activity.grossUnits, 0);
  const net = activities.reduce((sum, activity) => sum + activity.netUnits, 0);
  const requirementId = isMarketing ? "marketing-plan" : "trade-marketing-plan";
  const areaContributions = contributions.filter((item) => item.business_function === family);
  const hasAcceptedContribution = areaContributions.some((item) => item.status === "ACCEPTED");
  const levers = isMarketing
    ? [["BRAND_ACTIVITY","Publicidad y construcción de marca"],["PRICE_CHANGE","Cambio de precio"],["SEASON","Temporada"],["LAUNCH","Lanzamiento o relanzamiento"],["PROMOTIONAL_PACK","Empaque promocional"]]
    : [["DISTRIBUTION","Distribución y alcance"],["CHAIN_ACTIVITY","Actividad de la cadena"],["EXECUTION","Preparación y ejecución"]];
  synthetic = synthetic || growth?.dataClassification === "SYNTHETIC_NON_COMMERCIAL";
  return <div className="module-page">
    <ModuleHead eyebrow={`Paso ${isMarketing ? 4 : 5} de 8 · ${isMarketing ? "Marketing" : "Trade Marketing"}`} title={isMarketing ? "¿Qué demanda construirá Marketing?" : "¿Qué ejecutará Trade Marketing en el cliente?"} description={isMarketing ? "Campañas, lanzamientos y construcción de demanda con su impacto bruto y sus efectos netos." : "Promociones, exhibiciones y ejecución en punto de venta, separadas de Marketing para evitar doble conteo."} />
    <section className="plan-source">
      <div><small>Fuente de esta sección</small><h2>{source ? source.originalName : synthetic ? "Caso guiado sintético" : `Excel del Plan de ${isMarketing ? "Marketing" : "Trade Marketing"}`}</h2><p>{source ? `${source.summary.rowCount} filas interpretadas y preservadas.` : synthetic ? "Fuente de demostración aislada y no comercial." : "Carga el archivo que ya utiliza el área responsable."}</p></div>
      {!synthetic && canContribute && <label className="paper-button">{busy === requirementId ? "Leyendo…" : source ? "Reemplazar Excel" : "Seleccionar Excel"}<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onUpload(requirementId, event.target.files?.[0])} /></label>}
    </section>
    {!synthetic && canContribute && <section className="contribution-builder">
      <div className="section-title"><small>Construir dentro de REVENUE</small><h2>Registrar una aportación sin preparar otro Excel</h2></div>
      <form onSubmit={(event) => onContribute(event, family)}>
        <label>Palanca<select name="lever" required defaultValue=""><option value="" disabled>Selecciona</option>{levers.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Actividad<input name="title" required placeholder={isMarketing ? "Ej. Campaña Back to School" : "Ej. Promoción aniversario"} /></label>
        <label>Calidad del supuesto<select name="assumptionQuality" defaultValue="PROXY"><option value="COMMITMENT">Compromiso</option><option value="ESTIMATE">Estimación</option><option value="PROXY">Proxy provisional</option><option value="IDEA">Idea sin cifra</option></select></label>
        <label>Productos<input name="productScope" placeholder="SKU, familia o portafolio" /></label>
        <label>Desde<input name="periodStart" type="month" min={`${plan.year}-01`} max={`${plan.year}-12`} required /></label>
        <label>Hasta<input name="periodEnd" type="month" min={`${plan.year}-01`} max={`${plan.year}-12`} required /></label>
        <label>Volumen incremental<input name="grossUnits" type="number" min="0" step="1" placeholder="Unidades" /></label>
        <label>Inversión<input name="investmentAmount" type="number" min="0" step=".01" placeholder={plan.currency} /></label>
        <label className="wide">Evidencia o explicación<textarea name="evidence" placeholder="Origen del supuesto, acuerdo o cálculo utilizado" /></label>
        <button className="clay-primary wide" disabled={Boolean(busy)}>{busy === "Guardando aportación…" ? busy : "Entregar aportación al KAM"}</button>
      </form>
    </section>}
    {!!areaContributions.length && <section className="contribution-register">
      <div className="section-title"><small>Aportaciones del área</small><h2>Trabajo recibido para integrar</h2></div>
      {areaContributions.map((item) => <article key={item.id}>
        <div><small>{item.lever} · {item.period_start} a {item.period_end}</small><b>{item.title}</b><span>Propietario: {item.owner_display_name ?? item.owner_user_id} · Fuente: {item.source_system ?? (item.source_mode === "IMPORTED" ? "Archivo importado" : "REVENUE")} · Calidad: {item.assumption_quality === "PROXY" ? "Proxy provisional" : item.assumption_quality === "ESTIMATE" ? "Estimación" : item.assumption_quality === "COMMITMENT" ? "Compromiso" : "Idea"}</span></div>
        <div><strong>{item.gross_units ? `+${item.gross_units.toLocaleString("es-MX")} unidades` : "Sin cifra"}</strong><span>{item.investment_amount ? formatMoney(item.investment_amount,item.currency) : "Inversión pendiente"}</span></div>
        <div className={`contribution-status ${item.status.toLowerCase()}`}>{item.status === "SUBMITTED" ? "Pendiente del KAM" : item.status === "ACCEPTED" ? "Aceptada" : "Devuelta"}</div>
        {item.status === "SUBMITTED" && canIntegrate && <div className="contribution-actions"><button className="paper-button" onClick={() => onDecide(item.id,"RETURNED")}>Devolver</button><button className="clay-primary" onClick={() => onDecide(item.id,"ACCEPTED")}>Aceptar para integrar</button></div>}
      </article>)}
    </section>}
    {activities.length ? <>
      <section className="paper-metrics"><Metric label="Actividades" value={String(activities.length)} note={isMarketing ? "Marketing" : "Trade Marketing"} /><Metric label="Incremental bruto" value={`+${gross.toLocaleString("es-MX")}`} note="antes de efectos" /><Metric label="Incremental neto" value={`+${net.toLocaleString("es-MX")}`} note="aporte al Plan" tone="good" /></section>
      <section className="activity-sheet">{activities.map((activity) => <article key={activity.id}><div><small>{activity.period} · {activity.skuId}{activity.assumptionQuality ? ` · ${activity.assumptionQuality === "PROXY" ? "Proxy" : activity.assumptionQuality === "ESTIMATE" ? "Estimación" : activity.assumptionQuality === "COMMITMENT" ? "Compromiso" : "Idea"}` : ""}</small><b>{activity.name}</b><span>{activity.evidence}{activity.contributionId ? ` · Trazabilidad ${activity.contributionId}` : ""}</span></div><div><span>Bruto {activity.grossUnits.toLocaleString("es-MX")}</span><strong>Neto +{activity.netUnits.toLocaleString("es-MX")}</strong></div></article>)}</section>
    </> : <EmptyAnswer title={`Todavía no hay actividades reconciliadas de ${isMarketing ? "Marketing" : "Trade Marketing"}`} copy={synthetic && canBuild ? "La prueba guiada ya preparó las dos disciplinas. Reconcílialas para ver el aporte de cada una." : (source || hasAcceptedContribution) ? canBuild ? "Las dos áreas ya entregaron fuentes aceptadas. Puedes reconciliar el crecimiento sin doble conteo." : waitingFor : "Importa el Plan del área o construye una aportación aquí. Ambas rutas conservan dueño y fuente."} action={(synthetic || source || hasAcceptedContribution) && canBuild ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Construyendo…" : "Reconciliar Marketing y Trade"}</button> : undefined} />}
  </div>;
}

export function ResultModule({ result, baselineUnits, growthUnits, growth, ready, busy, onBuild }: { result: PlanResult | null; baselineUnits: number; growthUnits: number; growth: GrowthResult | null; ready: boolean; busy: string; onBuild: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 6 de 8 · Plan anual" title="Una sola respuesta en unidades y valor" description="Volumen base + Marketing + Trade Marketing, reconciliados por cuenta, producto y mes." />
    <span className="billing-filter-hint">Detalle mensual por producto · formato Billing oficial</span>
    {result ? <>
      <section className="double-answer"><div><span>Unidades del Plan</span><strong>{result.annualUnits.toLocaleString("es-MX")}</strong><small>unidades reconciliadas</small></div><div><span>Revenue del Plan</span><strong>{formatMoney(result.annualValue, result.currency)}</strong><small>{result.currency}</small></div></section>
      <section className="equation-strip"><div><span>Volumen base</span><b>{baselineUnits.toLocaleString("es-MX")}</b></div><strong>+</strong><div><span>Crecimiento neto</span><b>{growthUnits.toLocaleString("es-MX")}</b></div><strong>=</strong><div><span>Plan anual</span><b>{result.annualUnits.toLocaleString("es-MX")}</b></div></section>
      <section className="activity-sheet"><header className="section-title"><small>Building blocks reconciliados</small><h2>De qué se compone el Plan</h2></header>{(growth?.activities ?? []).map((activity) => <article key={activity.id}><div><small>{activity.family === "MARKETING" ? "Marketing" : "Trade Marketing"} · {activity.period} · {activity.skuId}</small><b>{activity.name}</b><span>{activity.evidence}</span></div><div><span>Bruto {activity.grossUnits.toLocaleString("es-MX")}</span><strong>Neto +{activity.netUnits.toLocaleString("es-MX")}</strong></div></article>)}</section>
      <OfficialPlanBilling result={result} />
    </> : <EmptyAnswer title="Todavía no existe el Plan consolidado" copy={ready ? "Volumen base, Marketing y Trade Marketing están reconciliados." : "Primero deben quedar reconciliados Volumen base, Marketing y Trade Marketing."} action={ready ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Consolidando…" : "Consolidar Plan anual"}</button> : undefined} />}
  </div>;
}

export function ProfitabilityModule({ profitability, files, onUpload, ready, busy, onBuild, readOnly = false }: { profitability: ProfitabilityResult | null; files: ReceivedFile[]; onUpload: (requirementId: string, file?: File) => void; ready: boolean; busy: string; onBuild: () => void; readOnly?: boolean }) {
  const productCosts = files.find((file) => file.requirementId === "product-costs");
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 7 de 8 · Rentabilidad" title="¿Cuánto dinero dejará el Plan?" description="Ventas, condiciones, costo, margen, inversión y contribución permanecen separados." />
    {readOnly && <section className="plain-note"><b>Consulta financiera autorizada</b><p>Esta vista no permite capturar, modificar, validar, devolver, aprobar ni oficializar.</p></section>}
    {!productCosts || productCosts.status !== "READY" ? <section className="plain-note warning"><b>Falta Product Cost</b><p>Sin el costo vigente por producto REVENUE no puede calcular COGS, margen bruto ni contribución. Sube el archivo de costos para desbloquear Rentabilidad.</p><label className="paper-button">{productCosts ? "Reemplazar Product Cost" : "Subir Product Cost"}<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onUpload("product-costs", event.target.files?.[0])} /></label></section> : null}
    {profitability ? <>
      <section className="paper-metrics"><Metric label="Net sales" value={formatMoney(profitability.planAnnual.netSales, profitability.currency)} note="después de deducciones" /><Metric label="Margen bruto" value={`${((profitability.planAnnual.grossMarginRate ?? 0) * 100).toFixed(1)}%`} note={formatMoney(profitability.planAnnual.grossMargin, profitability.currency)} /><Metric label="Contribución" value={formatMoney(profitability.planAnnual.contribution, profitability.currency)} note={`${((profitability.planAnnual.contributionRate ?? 0) * 100).toFixed(1)}% de net sales`} tone="good" /></section>
      <section className="plain-note"><b>Comparadores declarados</b><p>El P&amp;L muestra año anterior, Real/Actual y Plan actual. Las dos variaciones quedan separadas como Diferencial: Plan contra año anterior y Real/Actual contra Plan. El baseline aprobado permanece como comparador operativo de construcción.</p></section>
      {profitability.priorYearAnnual || profitability.actualAnnual ? <section className="pnl-statement"><div className="pnl-header"><b>Renglón financiero</b><b>{profitability.priorYear ?? "Año anterior"}</b><b>Real / Actual</b><b>Plan actual</b><b>Plan − año anterior</b><b>Real − Plan</b></div>{([["Gross sales","grossSales"],["− Condiciones comerciales","deductions"],["= Net sales","netSales"],["− Costo","cogs"],["= Margen bruto","grossMargin"],["− Inversión","investment"],["= Contribución","contribution"]] as const).map(([label,key]) => <div className="pnl-row" key={key}><b>{label}</b><span>{profitability.priorYearAnnual ? formatMoney(profitability.priorYearAnnual[key], profitability.currency) : "—"}</span><span>{profitability.actualAnnual ? formatMoney(profitability.actualAnnual[key], profitability.currency) : "—"}</span><span>{formatMoney(profitability.planAnnual[key], profitability.currency)}</span><strong className={profitability.priorYearVariance?.[key] < 0 ? "negative" : "positive"}>{profitability.priorYearVariance ? formatMoney(profitability.priorYearVariance[key], profitability.currency) : "—"}</strong><strong className={profitability.actualVariance?.[key] < 0 ? "negative" : "positive"}>{profitability.actualVariance ? formatMoney(profitability.actualVariance[key], profitability.currency) : "—"}</strong></div>)}</section> : <section className="plain-note warning"><b>Comparadores pendientes</b><p>El Plan se puede calcular, pero aún no hay fuentes históricas o Real/Actual comparables con cobertura financiera completa.</p></section>}
    </> : <EmptyAnswer title="Falta calcular la economía del Plan" copy={ready ? "Unidades y valor están listos; se aplicarán condiciones, costos e inversión trazables." : "Primero consolida el Plan anual en unidades y valor."} action={ready ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Calculando…" : "Calcular Rentabilidad"}</button> : undefined} />}
  </div>;
}

export function ReviewModule({ baseline, baselineResult, growth, result, profitability, synthetic, busy, onSubmit }: { baseline: BaselineReview | null; baselineResult: BaselineResult | null; growth: GrowthResult | null; result: PlanResult | null; profitability: ProfitabilityResult | null; synthetic: boolean; busy: string; onSubmit: () => void }) {
  const checks = [["Información y base", baseline?.status === "APPROVED_FROZEN"],["Marketing y Trade", Boolean(growth?.controls.reconciled)],["Unidades y valor", Boolean(result?.controls.unitsReconciled && result.controls.valueReconciled)],["Rentabilidad", Boolean(profitability?.controls.planReconciled)]] as const;
  const ready = checks.every(([,ok]) => ok);
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 8 de 8 · Revisión y aprobación" title="Una versión defendible, no otra hoja de cálculo" description="Las decisiones y controles se presentan en un solo lugar antes de congelar la versión." />
    <section className="approval-sheet">{checks.map(([label,ok], index) => <article className={ok ? "ready" : ""} key={label}><i>{ok ? "✓" : index + 1}</i><div><b>{label}</b><small>{ok ? "Listo" : "Pendiente"}</small></div></article>)}</section>
    <section className="official-document"><header><small>Documento oficial actualizado</small><h2>Vista completa para revisar antes de enviar</h2><p>Esta vista se reconstruye con la última versión de Información, Volumen base, building blocks, Billing mensual y rentabilidad.</p></header><h3>Volumen base · detalle completo</h3>{baselineResult?.lines.length ? <div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>De · observado</span><span>A · base calculada</span></div>{baselineResult.lines.map((line) => <div className="paper-row" key={`${line.accountId}|${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span>{line.observedAverageUnits.toLocaleString("es-MX")}</span><span><b>{line.calculatedUnits.toLocaleString("es-MX")}</b><small> · confianza {Math.round(line.confidence * 100)}%</small></span></div>)}</div> : <p>El detalle del Volumen base aparecerá cuando se calcule la respuesta.</p>}<h3>Building blocks</h3>{growth?.activities.length ? <div className="paper-table"><div className="paper-row head"><span>Familia</span><span>Actividad</span><span>Periodo / SKU</span><span>Neto</span></div>{growth.activities.map((activity) => <div className="paper-row" key={activity.id}><span>{activity.family === "MARKETING" ? "Marketing" : "Trade Marketing"}</span><b>{activity.name}</b><span>{activity.period} · {activity.skuId}</span><span>+{activity.netUnits.toLocaleString("es-MX")}</span></div>)}</div> : <p>No hay building blocks reconciliados.</p>}<h3>Billing mensual del Plan</h3>{result ? <OfficialPlanBilling result={result} /> : <p>El Billing mensual aparecerá cuando el Plan anual esté consolidado.</p>}<h3>Rentabilidad comparativa</h3><p>{profitability ? `Contribución del Plan: ${formatMoney(profitability.planAnnual.contribution, profitability.currency)} · Plan − año anterior: ${profitability.priorYearVariance ? formatMoney(profitability.priorYearVariance.contribution, profitability.currency) : "pendiente"} · Real − Plan: ${profitability.actualVariance ? formatMoney(profitability.actualVariance.contribution, profitability.currency) : "pendiente"}.` : "Falta calcular Rentabilidad."}</p></section>
    {synthetic && <section className="plain-note warning"><b>Prueba no comercial</b><p>Este recorrido demuestra la maquinaria, pero no puede convertirse en compromiso oficial.</p></section>}
    <EmptyAnswer title={ready ? "La versión está completa" : "Todavía hay decisiones pendientes"} copy={ready ? (synthetic ? "Congela los resultados y envía la demo al seguimiento; la oficialización comercial permanece bloqueada." : "Congela los resultados y envía la versión a revisión.") : "Abre cualquier paso pendiente desde el menú lateral."} action={ready ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onSubmit}>{busy ? "Enviando…" : synthetic ? "Congelar y enviar a Monitoreo" : "Congelar y enviar"}</button> : undefined} />
  </div>;
}
