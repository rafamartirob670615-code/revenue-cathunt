"use client";

import { PILOT_INPUT_REQUIREMENTS } from "../../domain/input-package";
import type { BaselineResult, BaselineReview, GrowthResult, PlanResult, ProfitabilityResult, ReceivedFile } from "./model";
import { EmptyAnswer, Metric, ModuleHead, formatMoney } from "./ui";

export function InformationModule({
  files,
  accepted,
  systemReady,
  busy,
  onUpload,
  onAccept,
  onSynthetic,
}: {
  files: ReceivedFile[];
  accepted: boolean;
  systemReady: boolean;
  busy: string;
  onUpload: (requirementId: string, file?: File) => void;
  onAccept: () => void;
  onSynthetic: () => void;
}) {
  const sales = files.find((file) => file.requirementId === "sales-history");
  return (
    <div className="module-page">
      <ModuleHead eyebrow="Información" title={accepted ? "La información está lista para construir la base" : "Comienza con el Excel que ya produce la empresa"} description="REVENUE conserva el original, detecta la tabla y propone cómo entender cuenta, producto, periodo, unidades y valor." />
      {sales ? (
        <section className="answer-card good">
          <div><small>Respuesta</small><h2>{sales.originalName} fue reconocido</h2><p>{sales.summary.rowCount} filas · {sales.summary.periods.length} periodos · {sales.summary.skuIds.length} productos.</p></div>
          <span>{sales.status === "READY" ? "Listo" : "Revisar"}</span>
        </section>
      ) : (
        <section className="first-upload">
          <div><small>Primer paso</small><h2>Selecciona la historia de ventas</h2><p>No prepares un formato nuevo. Puede ser Excel o CSV y la tabla no necesita comenzar en la primera fila.</p></div>
          <label className="clay-primary">{busy === "sales-history" ? "Leyendo archivo…" : "Seleccionar Excel de ventas"}<input type="file" accept=".xlsx,.xls,.csv" disabled={Boolean(busy)} onChange={(event) => onUpload("sales-history", event.target.files?.[0])} /></label>
          <button className="text-button" onClick={onSynthetic}>Iniciar prueba guiada</button>
        </section>
      )}
      {sales?.summary.workbook && (
        <details className="paper-detail">
          <summary>Ver cómo se interpretó</summary>
          <div className="interpret-grid">
            <div><span>Hoja elegida</span><b>{sales.summary.workbook.selectedSheet}</b></div>
            <div><span>Encabezados</span><b>Fila {sales.summary.workbook.headerRow}</b></div>
            <div><span>Confianza</span><b>{Math.round(sales.summary.workbook.confidence * 100)}%</b></div>
            <div><span>Filas rechazadas</span><b>{sales.summary.workbook.rejectedRowCount}</b></div>
          </div>
        </details>
      )}
      <details className="paper-detail">
        <summary>Ver información que se solicitará después</summary>
        <div className="requirements-grid">
          {PILOT_INPUT_REQUIREMENTS.map((requirement) => {
            const received = files.find((file) => file.requirementId === requirement.id);
            return <article key={requirement.id}><div><b>{requirement.name}</b><small>{requirement.purpose}</small></div><span className={received?.status === "READY" ? "ready" : ""}>{received?.status === "READY" ? "Recibido" : "Pendiente"}</span><label>{busy === requirement.id ? "Leyendo…" : "Cargar"}<input type="file" accept=".xlsx,.xls,.csv" disabled={Boolean(busy)} onChange={(event) => onUpload(requirement.id, event.target.files?.[0])} /></label></article>;
          })}
        </div>
      </details>
      {!accepted && systemReady && <EmptyAnswer title="Los insumos esenciales están listos" copy="Confirma la interpretación para habilitar Volumen base." action={<button className="clay-primary" onClick={onAccept}>Confirmar información</button>} />}
      {accepted && <EmptyAnswer title="Siguiente: revisar el volumen base" copy="La información aceptada ya puede alimentar el primer resultado comercial." />}
    </div>
  );
}

export function BaselineModule({ baseline, review, busy, onCalculate, onApprove }: { baseline: BaselineResult | null; review: BaselineReview | null; busy: string; onCalculate: () => void; onApprove: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Volumen base" title="¿Qué vendería la cuenta sin nuevas actividades?" description="Historia observada menos impactos conocidos y eventos no recurrentes. La respuesta se congela antes de construir crecimiento." />
    {baseline ? <>
      <section className="hero-answer"><small>Volumen base anual propuesto</small><strong>{baseline.annualUnits.toLocaleString("es-MX")}</strong><span>unidades para {baseline.targetYear}</span><p>{baseline.explanation}</p></section>
      <section className="paper-metrics"><Metric label="Periodos procesados" value={String(baseline.historyPeriods)} note="historia aceptada" /><Metric label="Estado de decisión" value={review?.status === "APPROVED_FROZEN" ? "Aprobada" : "Por decidir"} note={review?.status === "APPROVED_FROZEN" ? "base congelada" : "acepta o ajusta"} tone={review?.status === "APPROVED_FROZEN" ? "good" : "warn"} /><Metric label="Clasificación" value={baseline.dataClassification === "USER_PROVIDED" ? "Empresarial" : "Prueba"} note="origen visible" /></section>
      <details className="paper-detail"><summary>Ver resultado mensual por producto</summary><div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>Unidades</span><span>Confianza</span></div>{baseline.lines.map((line) => <div className="paper-row" key={`${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span>{line.calculatedUnits.toLocaleString("es-MX")}</span><span>{Math.round(line.confidence * 100)}%</span></div>)}</div></details>
      {review?.status !== "APPROVED_FROZEN" && <EmptyAnswer title="Decisión requerida" copy="Acepta el volumen propuesto para habilitar Crecimiento. Los ajustes documentados continúan disponibles en el motor." action={<button className="clay-primary" onClick={onApprove}>Aceptar volumen base</button>} />}
    </> : <EmptyAnswer title="Todavía no existe una base calculada" copy="REVENUE procesará únicamente la información aceptada; no mostrará cifras inventadas." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onCalculate}>{busy ? "Calculando…" : "Calcular volumen base"}</button>} />}
  </div>;
}

export function GrowthModule({ growth, busy, onBuild }: { growth: GrowthResult | null; busy: string; onBuild: () => void }) {
  const marketing = growth?.activities.filter((a) => a.family === "MARKETING").reduce((sum, a) => sum + a.netUnits, 0) ?? 0;
  const trade = growth?.activities.filter((a) => a.family === "TRADE_MARKETING").reduce((sum, a) => sum + a.netUnits, 0) ?? 0;
  return <div className="module-page">
    <ModuleHead eyebrow="Crecimiento" title="¿Qué aportarán Marketing y Trade Marketing?" description="Cada actividad parte de la base aprobada; canibalización, halo, compra anticipada e interacción se reconcilian antes de sumar." />
    {growth ? <>
      <section className="paper-metrics"><Metric label="Incremental bruto" value={`+${growth.grossUnits.toLocaleString("es-MX")}`} note="antes de efectos" /><Metric label="Incremental neto" value={`+${growth.netUnits.toLocaleString("es-MX")}`} note="aporte al Plan" tone="good" /><Metric label="Marketing" value={`+${marketing.toLocaleString("es-MX")}`} note="unidades netas" /><Metric label="Trade Marketing" value={`+${trade.toLocaleString("es-MX")}`} note="unidades netas" /></section>
      <section className="paper-panel"><div className="panel-title"><div><small>Actividades del Plan</small><h2>Aporte reconciliado</h2></div><span>{growth.activities.length} actividades</span></div><div className="activity-ledger">{growth.activities.map((activity) => <article key={activity.id}><div><small>{activity.family === "MARKETING" ? "Marketing" : "Trade Marketing"} · {activity.period}</small><b>{activity.name}</b><span>{activity.skuId}</span></div><strong>+{activity.netUnits.toLocaleString("es-MX")}</strong></article>)}</div></section>
    </> : <EmptyAnswer title="Construye el crecimiento desde los planes aprobados" copy="REVENUE usará Marketing y Trade Marketing sin volver a contar impactos incluidos en la base." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Construyendo…" : "Construir crecimiento"}</button>} />}
  </div>;
}

export function ResultModule({ result, baselineUnits, growthUnits, busy, onBuild }: { result: PlanResult | null; baselineUnits: number; growthUnits: number; busy: string; onBuild: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Plan anual" title="¿Cuánto venderemos en unidades y valor?" description="La base aprobada y el incremental neto se convierten en un solo compromiso anual, usando precios y conversiones vigentes." />
    {result ? <>
      <section className="hero-answer split"><div><small>Unidades del Plan</small><strong>{result.annualUnits.toLocaleString("es-MX")}</strong><span>unidades reconciliadas</span></div><div><small>Revenue del Plan</small><strong>{formatMoney(result.annualValue, result.currency)}</strong><span>{result.currency} · precios aceptados</span></div></section>
      <section className="equation-strip"><div><span>Base aprobada</span><b>{baselineUnits.toLocaleString("es-MX")}</b></div><strong>+</strong><div><span>Incremental neto</span><b>{growthUnits.toLocaleString("es-MX")}</b></div><strong>=</strong><div><span>Plan anual</span><b>{result.annualUnits.toLocaleString("es-MX")}</b></div></section>
      <details className="paper-detail"><summary>Ver detalle mensual por producto</summary><div className="paper-table"><div className="paper-row head"><span>Periodo</span><span>Producto</span><span>Unidades</span><span>Valor</span></div>{result.lines.map((line) => <div className="paper-row" key={`${line.period}|${line.skuId}`}><b>{line.period}</b><span>{line.skuId}</span><span>{line.planUnits.toLocaleString("es-MX")}</span><span>{formatMoney(line.planValue, line.currency)}</span></div>)}</div></details>
    </> : <EmptyAnswer title="Consolida unidades y valor" copy="El motor cruzará cuenta, producto, periodo, conversión y precio antes de presentar el Plan." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Consolidando…" : "Calcular Plan anual"}</button>} />}
  </div>;
}

export function ProfitabilityModule({ profitability, busy, onBuild }: { profitability: ProfitabilityResult | null; busy: string; onBuild: () => void }) {
  return <div className="module-page">
    <ModuleHead eyebrow="Rentabilidad" title="¿Cuánto dinero dejará el Plan?" description="Gross sales, condiciones comerciales, net sales, costos, margen, inversión y contribución permanecen separados y explicables." />
    {profitability ? <>
      <section className="paper-metrics"><Metric label="Net sales" value={formatMoney(profitability.planAnnual.netSales, profitability.currency)} note="después de deducciones" /><Metric label="Margen bruto" value={`${((profitability.planAnnual.grossMarginRate ?? 0) * 100).toFixed(1)}%`} note={formatMoney(profitability.planAnnual.grossMargin, profitability.currency)} /><Metric label="Contribución" value={formatMoney(profitability.planAnnual.contribution, profitability.currency)} note={`${((profitability.planAnnual.contributionRate ?? 0) * 100).toFixed(1)}% de net sales`} tone="good" /><Metric label="Mejora contra base" value={formatMoney(profitability.variance.contribution, profitability.currency)} note="contribución incremental" /></section>
      <details className="paper-detail"><summary>Ver estado de resultados completo</summary><div className="pnl-paper">{([["Gross sales","grossSales"],["− Deducciones","deductions"],["= Net sales","netSales"],["− COGS","cogs"],["= Gross margin","grossMargin"],["− Inversión","investment"],["= Contribution","contribution"]] as const).map(([label,key]) => <div key={key}><b>{label}</b><span>{formatMoney(profitability.comparatorAnnual[key], profitability.currency)}</span><strong>{formatMoney(profitability.planAnnual[key], profitability.currency)}</strong></div>)}</div></details>
    </> : <EmptyAnswer title="Calcula rentabilidad desde información trazable" copy="Las condiciones, costos e inversiones empresariales se aplicarán sin sustituirlos por supuestos silenciosos." action={<button className="clay-primary" disabled={Boolean(busy)} onClick={onBuild}>{busy ? "Calculando…" : "Calcular rentabilidad"}</button>} />}
  </div>;
}

export function ReviewModule({ baseline, growth, result, profitability, synthetic, busy, onSubmit }: { baseline: BaselineReview | null; growth: GrowthResult | null; result: PlanResult | null; profitability: ProfitabilityResult | null; synthetic: boolean; busy: string; onSubmit: () => void }) {
  const checks = [
    ["Información aceptada", Boolean(baseline)],
    ["Volumen base aprobado", baseline?.status === "APPROVED_FROZEN"],
    ["Crecimiento reconciliado", Boolean(growth?.controls.reconciled)],
    ["Plan anual reconciliado", Boolean(result?.controls.unitsReconciled && result.controls.valueReconciled)],
    ["Rentabilidad calculada", Boolean(profitability?.controls.planReconciled)],
  ] as const;
  const ready = checks.every(([,ok]) => ok);
  return <div className="module-page">
    <ModuleHead eyebrow="Revisión" title="¿Qué falta validar o aprobar?" description="Esta pantalla concentra las decisiones que convierten un cálculo guardado en una versión defendible y controlada." />
    <section className="review-board">{checks.map(([label,ok]) => <article key={label} className={ok ? "ready" : ""}><span>{ok ? "✓" : "○"}</span><b>{label}</b><small>{ok ? "Listo" : "Pendiente"}</small></article>)}</section>
    {synthetic && <section className="paper-warning"><b>Oficialización bloqueada por ser sintético</b><p>La prueba guiada demuestra el recorrido, pero no puede convertirse en compromiso comercial.</p></section>}
    <EmptyAnswer title={ready ? "La versión está lista para revisión" : "Completa las decisiones pendientes"} copy={ready ? "Congela los resultados y envía la versión sin alterar la evidencia original." : "REVENUE conserva el avance y te lleva directamente a la siguiente tarea."} action={ready && !synthetic ? <button className="clay-primary" disabled={Boolean(busy)} onClick={onSubmit}>{busy ? "Enviando…" : "Congelar y enviar a revisión"}</button> : undefined} />
  </div>;
}
