"use client";

import type { Plan } from "../../domain/types";
import { PILOT_INPUT_REQUIREMENTS } from "../../domain/input-package";
import type { BaselineResult, BaselineReview, GrowthResult, PlanResult, ProfitabilityResult, ReceivedFile } from "./model";
import { EmptyAnswer, Metric, ModuleHead, formatMoney } from "./ui";

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
  files, accepted, systemReady, busy, onUpload, onAccept, onSynthetic,
}: {
  files: ReceivedFile[]; accepted: boolean; systemReady: boolean; busy: string;
  onUpload: (requirementId: string, file?: File) => void; onAccept: () => void; onSynthetic: () => void;
}) {
  const essential = PILOT_INPUT_REQUIREMENTS.filter((requirement) => requirement.essential);
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 2 de 8 · Información" title="Entrega los archivos que la empresa ya usa" description="No hay formatos escondidos ni una captura interminable. REVENUE conserva el original, interpreta la tabla y muestra qué entendió." />
    <section className="source-board">
      {essential.map((requirement, index) => {
        const received = files.find((file) => file.requirementId === requirement.id);
        return <article className={received?.status === "READY" ? "ready" : ""} key={requirement.id}>
          <i>{received?.status === "READY" ? "✓" : index + 1}</i>
          <div><b>{requirement.name}</b><p>{requirement.purpose}</p>{received && <small>{received.originalName} · {received.summary.rowCount} filas</small>}</div>
          <label>{busy === requirement.id ? "Leyendo…" : received ? "Reemplazar" : "Seleccionar archivo"}<input type="file" accept=".xlsx,.xls,.csv" disabled={Boolean(busy)} onChange={(event) => onUpload(requirement.id, event.target.files?.[0])} /></label>
        </article>;
      })}
    </section>
    <details className="paper-detail"><summary>Fuentes complementarias</summary><div className="source-board compact">
      {PILOT_INPUT_REQUIREMENTS.filter((requirement) => !requirement.essential).map((requirement) => {
        const received = files.find((file) => file.requirementId === requirement.id);
        return <article className={received?.status === "READY" ? "ready" : ""} key={requirement.id}><i>{received ? "✓" : "·"}</i><div><b>{requirement.name}</b><p>{requirement.purpose}</p></div><label>{received ? "Reemplazar" : "Cargar"}<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onUpload(requirement.id, event.target.files?.[0])} /></label></article>;
      })}
    </div></details>
    {!accepted && systemReady && <EmptyAnswer title="La información esencial está completa" copy="Confirma la interpretación para construir el Volumen base." action={<button className="clay-primary" onClick={onAccept}>Confirmar información</button>} />}
    {!accepted && !systemReady && <button className="text-button" onClick={onSynthetic}>Usar prueba guiada para conocer el recorrido</button>}
    {accepted && <section className="answer-card good"><div><small>Resultado</small><h2>Información aceptada</h2><p>Los datasets canónicos ya pueden alimentar los cálculos de este Plan.</p></div><span>Listo</span></section>}
  </div>;
}

export function BaselineModule({ baseline, review, busy, onCalculate, onApprove }: { baseline: BaselineResult | null; review: BaselineReview | null; busy: string; onCalculate: () => void; onApprove: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 3 de 8 · Volumen base" title="¿Qué venderíamos sin nuevas actividades?" description="La historia aceptada se limpia de impactos conocidos y produce una base mensual defendible." />
    {baseline ? <>
      <section className="single-answer"><span>Volumen base anual</span><strong>{baseline.annualUnits.toLocaleString("es-MX")}</strong><small>unidades · {baseline.targetYear}</small><p>{baseline.explanation}</p></section>
      <section className="paper-metrics"><Metric label="Historia utilizada" value={`${baseline.historyPeriods} periodos`} note="fuente aceptada" /><Metric label="Decisión" value={review?.status === "APPROVED_FROZEN" ? "Aprobada" : "Pendiente"} note="antes de sumar crecimiento" tone={review?.status === "APPROVED_FROZEN" ? "good" : "warn"} /></section>
      <details className="paper-detail"><summary>Resultado mensual por producto</summary><div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>Unidades</span><span>Confianza</span></div>{baseline.lines.map((line) => <div className="paper-row" key={`${line.accountId}|${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span>{line.calculatedUnits.toLocaleString("es-MX")}</span><span>{Math.round(line.confidence * 100)}%</span></div>)}</div></details>
      {review?.status !== "APPROVED_FROZEN" && <button className="clay-primary action-wide" onClick={onApprove}>Aprobar y congelar Volumen base</button>}
    </> : <EmptyAnswer title="Falta calcular esta respuesta" copy="Primero se necesita Información aceptada. Si ya está lista, ejecuta el cálculo." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onCalculate}>{busy ? "Calculando…" : "Calcular Volumen base"}</button>} />}
  </div>;
}

export function GrowthPlanModule({ family, growth, source, busy, onUpload, onBuild }: {
  family: "MARKETING" | "TRADE_MARKETING"; growth: GrowthResult | null; source?: ReceivedFile;
  busy: string; onUpload: (requirementId: string, file?: File) => void; onBuild: () => void;
}) {
  const isMarketing = family === "MARKETING";
  const activities = growth?.activities.filter((activity) => activity.family === family) ?? [];
  const gross = activities.reduce((sum, activity) => sum + activity.grossUnits, 0);
  const net = activities.reduce((sum, activity) => sum + activity.netUnits, 0);
  const requirementId = isMarketing ? "marketing-plan" : "trade-marketing-plan";
  return <div className="module-page">
    <ModuleHead eyebrow={`Paso ${isMarketing ? 4 : 5} de 8 · ${isMarketing ? "Marketing" : "Trade Marketing"}`} title={isMarketing ? "¿Qué demanda construirá Marketing?" : "¿Qué ejecutará Trade Marketing en el cliente?"} description={isMarketing ? "Campañas, lanzamientos y construcción de demanda con su impacto bruto y sus efectos netos." : "Promociones, exhibiciones y ejecución en punto de venta, separadas de Marketing para evitar doble conteo."} />
    <section className="plan-source">
      <div><small>Fuente de esta sección</small><h2>{source ? source.originalName : `Excel del Plan de ${isMarketing ? "Marketing" : "Trade Marketing"}`}</h2><p>{source ? `${source.summary.rowCount} filas interpretadas y preservadas.` : "Carga el archivo que ya utiliza el área responsable."}</p></div>
      <label className="paper-button">{busy === requirementId ? "Leyendo…" : source ? "Reemplazar Excel" : "Seleccionar Excel"}<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onUpload(requirementId, event.target.files?.[0])} /></label>
    </section>
    {activities.length ? <>
      <section className="paper-metrics"><Metric label="Actividades" value={String(activities.length)} note={isMarketing ? "Marketing" : "Trade Marketing"} /><Metric label="Incremental bruto" value={`+${gross.toLocaleString("es-MX")}`} note="antes de efectos" /><Metric label="Incremental neto" value={`+${net.toLocaleString("es-MX")}`} note="aporte al Plan" tone="good" /></section>
      <section className="activity-sheet">{activities.map((activity) => <article key={activity.id}><div><small>{activity.period} · {activity.skuId}</small><b>{activity.name}</b><span>{activity.evidence}</span></div><div><span>Bruto {activity.grossUnits.toLocaleString("es-MX")}</span><strong>Neto +{activity.netUnits.toLocaleString("es-MX")}</strong></div></article>)}</section>
    </> : <EmptyAnswer title={`Todavía no hay actividades de ${isMarketing ? "Marketing" : "Trade Marketing"}`} copy={source ? "La fuente está recibida. Construye el crecimiento para reconciliar sus actividades." : "Carga el Excel de esta área. Esta pantalla no mezclará sus actividades con la otra disciplina."} action={source ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Construyendo…" : "Interpretar y reconciliar"}</button> : undefined} />}
  </div>;
}

export function ResultModule({ result, baselineUnits, growthUnits, busy, onBuild }: { result: PlanResult | null; baselineUnits: number; growthUnits: number; busy: string; onBuild: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 6 de 8 · Plan anual" title="Una sola respuesta en unidades y valor" description="Volumen base + Marketing + Trade Marketing, reconciliados por cuenta, producto y mes." />
    {result ? <>
      <section className="double-answer"><div><span>Unidades del Plan</span><strong>{result.annualUnits.toLocaleString("es-MX")}</strong><small>unidades reconciliadas</small></div><div><span>Revenue del Plan</span><strong>{formatMoney(result.annualValue, result.currency)}</strong><small>{result.currency}</small></div></section>
      <section className="equation-strip"><div><span>Volumen base</span><b>{baselineUnits.toLocaleString("es-MX")}</b></div><strong>+</strong><div><span>Crecimiento neto</span><b>{growthUnits.toLocaleString("es-MX")}</b></div><strong>=</strong><div><span>Plan anual</span><b>{result.annualUnits.toLocaleString("es-MX")}</b></div></section>
      <details className="paper-detail"><summary>Detalle mensual por producto</summary><div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>Unidades</span><span>Valor</span></div>{result.lines.map((line) => <div className="paper-row" key={`${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span>{line.planUnits.toLocaleString("es-MX")}</span><span>{formatMoney(line.planValue, line.currency)}</span></div>)}</div></details>
    </> : <EmptyAnswer title="Todavía no existe el Plan consolidado" copy="Se habilita cuando Volumen base, Marketing y Trade Marketing están reconciliados." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Consolidando…" : "Consolidar Plan anual"}</button>} />}
  </div>;
}

export function ProfitabilityModule({ profitability, busy, onBuild }: { profitability: ProfitabilityResult | null; busy: string; onBuild: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 7 de 8 · Rentabilidad" title="¿Cuánto dinero dejará el Plan?" description="Ventas, condiciones, costo, margen, inversión y contribución permanecen separados." />
    {profitability ? <>
      <section className="paper-metrics"><Metric label="Net sales" value={formatMoney(profitability.planAnnual.netSales, profitability.currency)} note="después de deducciones" /><Metric label="Margen bruto" value={`${((profitability.planAnnual.grossMarginRate ?? 0) * 100).toFixed(1)}%`} note={formatMoney(profitability.planAnnual.grossMargin, profitability.currency)} /><Metric label="Contribución" value={formatMoney(profitability.planAnnual.contribution, profitability.currency)} note={`${((profitability.planAnnual.contributionRate ?? 0) * 100).toFixed(1)}% de net sales`} tone="good" /></section>
      <section className="pnl-statement">{([["Gross sales","grossSales"],["− Condiciones comerciales","deductions"],["= Net sales","netSales"],["− Costo","cogs"],["= Margen bruto","grossMargin"],["− Inversión","investment"],["= Contribución","contribution"]] as const).map(([label,key]) => <div key={key}><b>{label}</b><span>{formatMoney(profitability.planAnnual[key], profitability.currency)}</span></div>)}</section>
    </> : <EmptyAnswer title="Falta calcular la economía del Plan" copy="Se necesitan unidades y valor consolidados, además de condiciones, costos e inversión trazables." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Calculando…" : "Calcular Rentabilidad"}</button>} />}
  </div>;
}

export function ReviewModule({ baseline, growth, result, profitability, synthetic, busy, onSubmit }: { baseline: BaselineReview | null; growth: GrowthResult | null; result: PlanResult | null; profitability: ProfitabilityResult | null; synthetic: boolean; busy: string; onSubmit: () => void }) {
  const checks = [["Información y base", baseline?.status === "APPROVED_FROZEN"],["Marketing y Trade", Boolean(growth?.controls.reconciled)],["Unidades y valor", Boolean(result?.controls.unitsReconciled && result.controls.valueReconciled)],["Rentabilidad", Boolean(profitability?.controls.planReconciled)]] as const;
  const ready = checks.every(([,ok]) => ok);
  return <div className="module-page">
    <ModuleHead eyebrow="Paso 8 de 8 · Revisión y aprobación" title="Una versión defendible, no otra hoja de cálculo" description="Las decisiones y controles se presentan en un solo lugar antes de congelar la versión." />
    <section className="approval-sheet">{checks.map(([label,ok], index) => <article className={ok ? "ready" : ""} key={label}><i>{ok ? "✓" : index + 1}</i><div><b>{label}</b><small>{ok ? "Listo" : "Pendiente"}</small></div></article>)}</section>
    {synthetic && <section className="plain-note warning"><b>Prueba no comercial</b><p>Este recorrido demuestra la maquinaria, pero no puede convertirse en compromiso oficial.</p></section>}
    <EmptyAnswer title={ready ? "La versión está completa" : "Todavía hay decisiones pendientes"} copy={ready ? "Congela los resultados y envía la versión a revisión." : "Abre cualquier paso pendiente desde el menú lateral."} action={ready && !synthetic ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onSubmit}>{busy ? "Enviando…" : "Congelar y enviar"}</button> : undefined} />
  </div>;
}
