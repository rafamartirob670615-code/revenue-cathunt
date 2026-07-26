"use client";

import { useEffect, useState } from "react";
import type { Plan } from "../domain/types";
import {
  createEmptyInputPackage,
  PILOT_INPUT_REQUIREMENTS,
} from "../domain/input-package";
import type { InputRequirement } from "../domain/input-package";

type View = "portfolio" | "create" | "workspace";
type ReceivedFile = {
  requirementId: string;
  originalName: string;
  status: "READY" | "INCOMPLETE";
  missingFields: string[];
  issues: Array<{ code: string; message: string; rows?: number[] }>;
  summary: {
    rowCount: number;
    accountIds: string[];
    skuIds: string[];
    periods: string[];
  };
  receivedAt: string;
  synthetic?: boolean;
};
type BaselineResult = {
  methodId: string;
  methodVersion: string;
  targetYear: number;
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  lines: Array<{
    accountId: string;
    skuId: string;
    period: string;
    calculatedUnits: number;
    confidence: number;
  }>;
  annualUnits: number;
  historyPeriods: number;
  explanation: string;
};
type BaselineReview = {
  status: "ADJUSTMENT_PROPOSED" | "APPROVED_FROZEN";
  decision: "CALCULATED" | "ADJUSTED";
  calculatedAnnualUnits: number;
  adjustedAnnualUnits?: number | null;
  approvedAnnualUnits?: number | null;
  reason: string;
  evidence: string;
  decidedBy: string;
  decidedAt: string;
  frozenAt?: string | null;
  methodId: string;
  methodVersion: string;
  officializationAllowed?: boolean;
};

const currentYear = new Date().getFullYear();

function activeVersion(plan: Plan) {
  return plan.versions.at(-1);
}

function friendlyError(message: string) {
  if (/Autenticación/.test(message)) {
    return "Tu sesión no está disponible. Vuelve a abrir el sitio privado e inténtalo otra vez.";
  }
  if (/Conflicto/.test(message)) {
    return "El Plan cambió en otra sesión. Actualiza la lista antes de continuar.";
  }
  return message || "No pudimos completar la acción. Tu información no se perdió.";
}

function aggregateBaseline(
  lines: BaselineResult["lines"],
  level: "Año" | "Trimestre" | "Mes" | "SKU",
) {
  const groups = new Map<string, { units: number; confidenceTotal: number; count: number }>();
  for (const line of lines) {
    const month = Number(line.period.slice(5, 7));
    const label = level === "SKU"
      ? line.skuId
      : level === "Año"
      ? line.period.slice(0, 4)
      : level === "Trimestre"
        ? `${line.period.slice(0, 4)} · T${Math.ceil(month / 3)}`
        : line.period;
    const current = groups.get(label) ?? { units: 0, confidenceTotal: 0, count: 0 };
    groups.set(label, {
      units: current.units + line.calculatedUnits,
      confidenceTotal: current.confidenceTotal + line.confidence,
      count: current.count + 1,
    });
  }
  return [...groups.entries()].map(([period, value]) => ({
    period,
    units: value.units,
    confidence: value.confidenceTotal / value.count,
  }));
}

export default function PlansWorkspace({
  initialPlanId,
  startInCreate = false,
}: {
  initialPlanId?: string;
  startInCreate?: boolean;
}) {
  const [view, setView] = useState<View>(startInCreate ? "create" : "portfolio");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [year, setYear] = useState(currentYear + 1);
  const [currency, setCurrency] = useState("MXN");
  const [showInformation, setShowInformation] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [uploadingRequirement, setUploadingRequirement] = useState("");
  const [packageIssues, setPackageIssues] = useState<Array<{ code: string; message: string }>>([]);
  const [systemReady, setSystemReady] = useState(false);
  const [packageAccepted, setPackageAccepted] = useState(false);
  const [acceptingPackage, setAcceptingPackage] = useState(false);
  const [loadingSynthetic, setLoadingSynthetic] = useState(false);
  const [showBaselineGate, setShowBaselineGate] = useState(false);
  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [baselineReview, setBaselineReview] = useState<BaselineReview | null>(null);
  const [calculatingBaseline, setCalculatingBaseline] = useState(false);
  const [periodLevel, setPeriodLevel] = useState<"Año" | "Trimestre" | "Mes" | "SKU">("Año");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustedAnnualUnits, setAdjustedAnnualUnits] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentEvidence, setAdjustmentEvidence] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [comparison, setComparison] = useState<"Plan" | "Cuota" | "Proyección">("Plan");

  async function loadPlans() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/plans", { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        plans?: Plan[];
        error?: string;
      };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setPlans(body.plans ?? []);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoading(false);
    }
  }

  // La apertura inicial sólo se vuelve a evaluar cuando cambia el Plan solicitado.
  useEffect(() => {
    let active = true;
    fetch("/api/plans", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          plans?: Plan[];
          error?: string;
        };
        if (!response.ok || !body.ok) throw new Error(body.error);
        if (active) {
          const loadedPlans = body.plans ?? [];
          setPlans(loadedPlans);
          const requestedPlan = initialPlanId
            ? loadedPlans.find((plan) => plan.id === initialPlanId)
            : undefined;
          if (requestedPlan) {
            setSelected(requestedPlan);
            setShowInformation(false);
            setReceivedFiles([]);
            setShowBaselineGate(false);
            void loadInputFiles(requestedPlan.id);
            setView("workspace");
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(friendlyError(cause instanceof Error ? cause.message : ""));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlanId]);

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!companyName.trim() || !accountName.trim()) {
      setError("Completa compañía y cuenta para crear el Plan.");
      return;
    }
    setSaving(true);
    setError("");
    const occurredAt = new Date().toISOString();
    const planId = `plan:${crypto.randomUUID()}`;
    const versionId = `version:${crypto.randomUUID()}`;
    const plan: Plan = {
      id: planId,
      organizationId: "revenue-pilot",
      companyId: companyName.trim().toLowerCase().replace(/\s+/g, "-"),
      companyName: companyName.trim(),
      accountId: accountName.trim().toLowerCase().replace(/\s+/g, "-"),
      accountName: accountName.trim(),
      year,
      currency,
      versions: [{
        id: versionId,
        planId,
        number: 1,
        kind: "PLAN",
        status: "DRAFT",
        createdBy: "authenticated-user",
        createdAt: occurredAt,
        lines: [],
        overrides: [],
        validations: [],
        approvals: [],
      }],
    };
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          plan,
          context: {
            commandId: `create:${crypto.randomUUID()}`,
            actorId: "authenticated-user",
            occurredAt,
          },
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        result?: Plan;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setPlans((current) => [body.result as Plan, ...current]);
      setSelected(body.result);
      setView("workspace");
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSaving(false);
    }
  }

  async function loadInputFiles(planId: string) {
    try {
      const response = await fetch(`/api/inputs?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        files?: ReceivedFile[];
        packageIssues?: Array<{ code: string; message: string }>;
        systemReady?: boolean;
        accepted?: boolean;
      };
      if (response.ok && body.ok) {
        setReceivedFiles(body.files ?? []);
        setPackageIssues(body.packageIssues ?? []);
        setSystemReady(body.systemReady ?? false);
        setPackageAccepted(body.accepted ?? false);
        if (body.accepted) void loadBaseline(planId);
      }
    } catch {
      setReceivedFiles([]);
      setPackageIssues([]);
      setSystemReady(false);
      setPackageAccepted(false);
    }
  }

  async function loadBaseline(planId: string) {
    try {
      const response = await fetch(`/api/baseline?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        result?: BaselineResult | null;
        review?: BaselineReview | null;
      };
      if (response.ok && body.ok) {
        setBaseline(body.result ?? null);
        setBaselineReview(body.review ?? null);
      }
    } catch {
      setBaseline(null);
      setBaselineReview(null);
    }
  }

  async function loadSyntheticPackage() {
    if (!selected) return;
    setLoadingSynthetic(true);
    setError("");
    try {
      const response = await fetch("/api/inputs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setBaseline(null);
      await loadInputFiles(selected.id);
      setShowInformation(true);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoadingSynthetic(false);
    }
  }

  async function calculateBaseline() {
    if (!selected || !packageAccepted) return;
    setCalculatingBaseline(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; result?: BaselineResult; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setBaseline(body.result);
      setBaselineReview(null);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setCalculatingBaseline(false);
    }
  }

  async function proposeBaselineAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSavingReview(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: selected.id,
          proposedAnnualUnits: Number(adjustedAnnualUnits),
          reason: adjustmentReason,
          evidence: adjustmentEvidence,
        }),
      });
      const body = (await response.json()) as { ok: boolean; review?: BaselineReview; error?: string };
      if (!response.ok || !body.ok || !body.review) throw new Error(body.error);
      setBaselineReview(body.review);
      setShowAdjustment(false);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSavingReview(false);
    }
  }

  async function approveBaseline(decision: "CALCULATED" | "ADJUSTED") {
    if (!selected) return;
    setSavingReview(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id, decision }),
      });
      const body = (await response.json()) as { ok: boolean; review?: BaselineReview; error?: string };
      if (!response.ok || !body.ok || !body.review) throw new Error(body.error);
      setBaselineReview(body.review);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSavingReview(false);
    }
  }

  function openPlan(plan: Plan) {
    setSelected(plan);
    setShowInformation(false);
    setReceivedFiles([]);
    setShowBaselineGate(false);
    void loadInputFiles(plan.id);
    setView("workspace");
    setError("");
  }

  async function uploadInput(requirementId: string, file: File | undefined) {
    if (!selected || !file) return;
    setUploadingRequirement(requirementId);
    setError("");
    try {
      const form = new FormData();
      form.set("planId", selected.id);
      form.set("requirementId", requirementId);
      form.set("file", file);
      const response = await fetch("/api/inputs", { method: "POST", body: form });
      const body = (await response.json()) as { ok: boolean; result?: ReceivedFile; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setReceivedFiles((current) => [
        body.result as ReceivedFile,
        ...current.filter((item) => item.requirementId !== requirementId),
      ]);
      await loadInputFiles(selected.id);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setUploadingRequirement("");
    }
  }

  function downloadTemplate(requirement: InputRequirement) {
    const content = `${requirement.requiredFields.join(",")}\n`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REVENUE_${requirement.id}_plantilla.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function acceptInputPackage() {
    if (!selected || !systemReady) return;
    setAcceptingPackage(true);
    setError("");
    try {
      const response = await fetch("/api/inputs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setPackageAccepted(true);
      setShowBaselineGate(true);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setAcceptingPackage(false);
    }
  }

  if (view === "create") {
    return (
      <div className="page empty-plan-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Crear Plan anual</p>
            <h1>Comienza con el contexto, no con cifras</h1>
            <p>Revenue guardará un Plan vacío. La información y los resultados se incorporarán en los siguientes pasos.</p>
          </div>
          <button className="secondary" onClick={() => setView("portfolio")}>← Volver a Mis Planes</button>
        </div>
        <form className="panel create-plan-card" onSubmit={createPlan}>
          <div className="create-plan-intro">
            <span>1</span>
            <div>
              <h2>¿Qué Plan quieres crear?</h2>
              <p>Sólo necesitamos identificarlo. Aquí no se calcula ni se supone ningún resultado.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>Compañía<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Escribe la compañía" required /></label>
            <label>Cuenta<input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Escribe la cuenta" required /></label>
            <label>Año del Plan<input type="number" min={currentYear} max={currentYear + 5} value={year} onChange={(event) => setYear(Number(event.target.value))} required /></label>
            <label>Moneda base<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>MXN</option><option>USD</option></select></label>
          </div>
          <div className="empty-plan-notice">
            <span>✓</span>
            <div><b>El Plan se creará vacío</b><small>No habrá ventas, objetivos, baseline, iniciativas ni rentabilidad precargados.</small></div>
          </div>
          {error && <div className="recoverable-error" role="alert">{error}</div>}
          <div className="create-plan-actions">
            <button type="button" className="secondary" onClick={() => setView("portfolio")}>Cancelar</button>
            <button className="primary" disabled={saving}>{saving ? "Guardando…" : "Crear y guardar Plan"}</button>
          </div>
        </form>
      </div>
    );
  }

  if (view === "workspace" && selected) {
    const version = activeVersion(selected);
    const inputPackage = createEmptyInputPackage(selected.id);
    const essentialReady = PILOT_INPUT_REQUIREMENTS.filter(
      (requirement) =>
        requirement.criticality === "ESSENTIAL" &&
        receivedFiles.some(
          (file) => file.requirementId === requirement.id && file.status === "READY",
        ),
    ).length;
    const salesEvidence = receivedFiles.find(
      (file) => file.requirementId === "sales-history" && file.status === "READY",
    );
    const activityEvidence = receivedFiles.find(
      (file) => file.requirementId === "activity-history" && file.status === "READY",
    );
    const syntheticPackage = receivedFiles.length > 0 && receivedFiles.every((file) => file.synthetic);
    const visibleBaselineLines = baseline ? aggregateBaseline(baseline.lines, periodLevel) : [];
    return (
      <div className="page empty-plan-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">{selected.companyName ?? selected.companyId} · {selected.accountName ?? selected.accountId} · {selected.year}</p>
            <h1>Plan anual {selected.year}</h1>
            <p>Versión {version?.number ?? 1} · Borrador guardado</p>
          </div>
          <span className="status-chip">{packageAccepted ? "✓ Paquete aceptado" : "● Información pendiente"}</span>
        </div>
        <div className="plan-tabs">
          <button className={showBaselineGate ? "" : "active"} onClick={() => setShowBaselineGate(false)}>Contexto e información</button>
          <button className={showBaselineGate ? "active" : ""} disabled={!packageAccepted} onClick={() => setShowBaselineGate(true)}>Baseline</button>
          <button disabled>Crecimiento</button>
          <button disabled>Resultado y rentabilidad</button>
          <button disabled>Versión y presentación</button>
        </div>
        <section className={`panel empty-workspace ${showBaselineGate ? "baseline-mode" : ""}`}>
          {showBaselineGate && packageAccepted && (
            <div className="baseline-workspace">
              <div className="baseline-head">
                <div>
                  <p className="eyebrow">Paso 2 · Base desimpactada</p>
                  <h2>¿Qué venderíamos sin volver a contar las actividades?</h2>
                  <p>La base desimpactada representa el volumen recurrente esperado antes de agregar Marketing y Trade Marketing al Plan.</p>
                </div>
                <span className={`calculation-state ${baseline ? "ready" : ""}`}>
                  {baselineReview?.status === "APPROVED_FROZEN" ? "✓ Aprobado y congelado" : baseline ? "✓ Calculado" : "No calculado"}
                </span>
              </div>
              {syntheticPackage && (
                <div className="synthetic-banner" role="status">
                  <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                  <span>Este resultado sirve para probar el motor y el recorrido. No representa ventas, metas ni resultados reales.</span>
                </div>
              )}

              <div className="baseline-toolbar" aria-label="Periodo del baseline">
                <span>Ver por</span>
                {(["Año", "Trimestre", "Mes", "SKU"] as const).map((level) => (
                  <button key={level} className={periodLevel === level ? "active" : ""} onClick={() => setPeriodLevel(level)}>{level}</button>
                ))}
              </div>

              <section className="baseline-evidence">
                <div className="section-copy">
                  <p className="eyebrow">Evidencia recibida</p>
                  <h3>Lo que REVENUE puede verificar hoy</h3>
                  <p>Estos conteos provienen del archivo histórico aceptado; no son cifras comerciales calculadas.</p>
                </div>
                <div className="evidence-counters">
                  <article><span>Filas históricas</span><b>{salesEvidence?.summary.rowCount ?? "Pendiente"}</b></article>
                  <article><span>Periodos distintos</span><b>{salesEvidence?.summary.periods?.length ?? "Pendiente"}</b></article>
                  <article><span>Cuentas distintas</span><b>{salesEvidence?.summary.accountIds?.length ?? "Pendiente"}</b></article>
                  <article><span>SKU distintos</span><b>{salesEvidence?.summary.skuIds?.length ?? "Pendiente"}</b></article>
                </div>
                <p className="evidence-footnote">
                  Historial de actividades: {activityEvidence ? `${activityEvidence.summary.rowCount} filas aceptadas` : "pendiente"}.
                </p>
              </section>

              <section className="baseline-logic">
                <p className="eyebrow">Lógica comercial</p>
                <div className="baseline-equation">
                  <article><span>1</span><b>Historia observada</b><small>Ventas reales recibidas</small></article>
                  <strong>−</strong>
                  <article><span>2</span><b>Actividades conocidas</b><small>Impactos ya incluidos en la historia</small></article>
                  <strong>−</strong>
                  <article><span>3</span><b>Eventos no recurrentes</b><small>Ajustes sólo con evidencia</small></article>
                  <strong>=</strong>
                  <article className="result"><span>4</span><b>Base desimpactada</b><small>Sin doble conteo</small></article>
                </div>
              </section>

              <div className="baseline-detail-grid">
                <section className="method-card">
                  <p className="eyebrow">Método</p>
                  <h3>{baseline ? "Promedio estacional desimpactado" : "Aún no seleccionado"}</h3>
                  <p>{baseline?.explanation ?? "REVENUE evaluará el comportamiento real de la historia antes de elegir un método. La selección y su justificación quedarán registradas."}</p>
                  <div className="method-options">
                    <span>Run rate</span><span className={baseline ? "selected" : ""}>Estacional</span><span>Serie de tiempo</span>
                  </div>
                </section>
                <section className="governance-card">
                  <p className="eyebrow">Control del resultado</p>
                  <dl>
                    <div><dt>Calculada</dt><dd>Resultado reproducible del método.</dd></div>
                    <div><dt>Ajustada</dt><dd>Cambio autorizado con motivo y evidencia.</dd></div>
                    <div><dt>Aprobada</dt><dd>Base congelada que alimentará el Plan.</dd></div>
                  </dl>
                </section>
              </div>

              <section className="baseline-results">
                <div className="section-copy">
                  <p className="eyebrow">Resultado · vista {periodLevel.toLowerCase()}</p>
                  <h3>Base calculada, ajustada y aprobada</h3>
                </div>
                <div className="baseline-table" role="table" aria-label="Resultados del baseline">
                  <div className="baseline-table-head" role="row">
                    <span>Periodo</span><span>Base calculada</span><span>Base ajustada</span><span>Base aprobada</span><span>Evidencia</span>
                  </div>
                  {baseline ? visibleBaselineLines.map((line) => (
                    <div className="baseline-result-row" role="row" key={line.period}>
                      <span>{line.period}</span>
                      <b>{line.units.toLocaleString("es-MX")} unidades</b>
                      <span>{baselineReview?.adjustedAnnualUnits
                        ? `${baselineReview.adjustedAnnualUnits.toLocaleString("es-MX")} unidades anuales`
                        : "Sin ajuste"}</span>
                      <span>{baselineReview?.status === "APPROVED_FROZEN"
                        ? `${baselineReview.approvedAnnualUnits?.toLocaleString("es-MX")} unidades anuales`
                        : "Pendiente de aprobación"}</span>
                      <small>Confianza {(line.confidence * 100).toFixed(0)}%</small>
                    </div>
                  )) : (
                    <div className="baseline-empty-result" role="row">
                      <span>—</span>
                      <div><b>Todavía no existe un cálculo</b><small>No se mostrarán valores hasta que el motor procese la evidencia aceptada.</small></div>
                    </div>
                  )}
                </div>
                {baseline && (
                  <p className="baseline-total">
                    Total anual calculado: <b>{baseline.annualUnits.toLocaleString("es-MX")} unidades</b> · {baseline.historyPeriods} periodos históricos procesados.
                  </p>
                )}
              </section>

              {baseline && (
                <section className="baseline-decision">
                  <div className="section-copy">
                    <p className="eyebrow">Decisión gobernada</p>
                    <h3>{baselineReview?.status === "APPROVED_FROZEN"
                      ? "La base aprobada quedó congelada"
                      : "Acepta el cálculo o propone un ajuste documentado"}</h3>
                    <p>La decisión conserva autor, fecha, método y evidencia. Un archivo reemplazado invalida esta revisión.</p>
                  </div>
                  {baselineReview?.status === "APPROVED_FROZEN" ? (
                    <div className="frozen-baseline-card">
                      <span>✓</span>
                      <div>
                        <b>{baselineReview.approvedAnnualUnits?.toLocaleString("es-MX")} unidades aprobadas</b>
                        <p>{baselineReview.reason} · {baselineReview.evidence}</p>
                        <small>{baselineReview.decidedBy} · {new Date(baselineReview.decidedAt).toLocaleString("es-MX")} · {baselineReview.methodId} v{baselineReview.methodVersion}</small>
                        {syntheticPackage && <strong>No puede convertirse en Plan oficial.</strong>}
                      </div>
                    </div>
                  ) : (
                    <>
                      {baselineReview?.status === "ADJUSTMENT_PROPOSED" && (
                        <div className="proposed-adjustment">
                          <b>Ajuste propuesto: {baselineReview.adjustedAnnualUnits?.toLocaleString("es-MX")} unidades</b>
                          <span>{baselineReview.reason} · Evidencia: {baselineReview.evidence}</span>
                        </div>
                      )}
                      <div className="baseline-decision-actions">
                        <button className="secondary" onClick={() => setShowAdjustment((current) => !current)}>Proponer ajuste</button>
                        <button className="secondary" disabled={savingReview || baselineReview?.status !== "ADJUSTMENT_PROPOSED"} onClick={() => void approveBaseline("ADJUSTED")}>Aprobar ajuste</button>
                        <button className="primary" disabled={savingReview} onClick={() => void approveBaseline("CALCULATED")}>Aceptar cálculo y congelar</button>
                      </div>
                      {showAdjustment && (
                        <form className="baseline-adjustment-form" onSubmit={proposeBaselineAdjustment}>
                          <label>Base anual propuesta (unidades)<input type="number" min="1" value={adjustedAnnualUnits} onChange={(event) => setAdjustedAnnualUnits(event.target.value)} required /></label>
                          <label>Motivo del ajuste<textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Explica por qué el cálculo debe cambiar" required /></label>
                          <label>Evidencia<textarea value={adjustmentEvidence} onChange={(event) => setAdjustmentEvidence(event.target.value)} placeholder="Identifica el archivo, fuente o comprobante" required /></label>
                          <button className="primary" disabled={savingReview}>{savingReview ? "Guardando…" : "Guardar propuesta"}</button>
                        </form>
                      )}
                    </>
                  )}
                </section>
              )}

              <div className="baseline-next-action">
                <div>
                  <b>{baseline ? "Cálculo técnico completado" : "Siguiente compuerta"}</b>
                  <p>{baseline ? "El resultado quedó persistido. La aprobación comercial permanece pendiente." : "Procesar el paquete aceptado sin alterar sus archivos originales."}</p>
                </div>
                <button className="primary" onClick={() => void calculateBaseline()} disabled={calculatingBaseline}>
                  {calculatingBaseline ? "Calculando…" : baseline ? "Recalcular baseline" : "Calcular baseline"}
                </button>
              </div>
            </div>
          )}
          <div className="empty-workspace-hero">
            <span>✓</span>
            <div>
              <p className="eyebrow">Primer resultado completado</p>
              <h2>Tu Plan está creado y protegido</h2>
              <p>Se guardó sin cifras inventadas. Puedes salir y volver desde Mis Planes.</p>
            </div>
          </div>
          <div className="empty-plan-context">
            <div><span>Compañía</span><b>{selected.companyName ?? selected.companyId}</b></div>
            <div><span>Cuenta</span><b>{selected.accountName ?? selected.accountId}</b></div>
            <div><span>Año</span><b>{selected.year}</b></div>
            <div><span>Moneda</span><b>{selected.currency}</b></div>
          </div>
          <section className="plan-congruence" aria-label="Cómo se construye el Plan">
            <div className="congruence-head">
              <div>
                <p className="eyebrow">La historia completa</p>
                <h2>Así se construirá este Plan</h2>
                <p>Cada resultado conservará su origen y podrá leerse por año, trimestre o mes.</p>
              </div>
              <div className="commercial-controls">
                <div>
                  <span>Periodo</span>
                  {(["Año", "Trimestre", "Mes"] as const).map((level) => (
                    <button key={level} className={periodLevel === level ? "active" : ""} onClick={() => setPeriodLevel(level)}>{level}</button>
                  ))}
                </div>
                <div>
                  <span>Comparar contra</span>
                  {(["Plan", "Cuota", "Proyección"] as const).map((option) => (
                    <button key={option} className={comparison === option ? "active" : ""} onClick={() => setComparison(option)}>{option}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="commercial-bridge">
              <article><span>1</span><b>Base desimpactada</b><small>Lo recurrente, sin volver a sumar actividades.</small></article>
              <strong>+</strong>
              <article><span>2</span><b>Marketing</b><small>Planes, alcance e impacto identificados.</small></article>
              <strong>+</strong>
              <article><span>3</span><b>Trade Marketing</b><small>Promociones y ejecución comercial.</small></article>
              <strong>=</strong>
              <article className="result"><span>4</span><b>Plan</b><small>Unidades, valor y rentabilidad reconciliados.</small></article>
            </div>
            <div className="comparison-contract">
              <span>Vista seleccionada</span>
              <b>{periodLevel} · contra {comparison}</b>
              <p>No se muestran cifras porque todavía no existe un paquete real aceptado ni un resultado calculado.</p>
            </div>
          </section>
          {!showInformation ? (
            <div className="next-gate-card">
              <div><span>2</span><div><b>Siguiente: preparar la información mínima</b><p>Revisa qué necesita REVENUE, para qué sirve y qué elementos bloquean el cálculo.</p></div></div>
              <button className="secondary" onClick={() => setShowInformation(true)}>Abrir checklist</button>
            </div>
          ) : (
            <div className="input-package">
              <div className="input-package-head">
                <div>
                  <p className="eyebrow">Paquete controlado · versión 1</p>
                  <h2>Información necesaria para calcular</h2>
                  <p>{receivedFiles.length
                    ? "REVENUE valida estructura, cobertura y correspondencias antes de permitir el cálculo."
                    : "REVENUE no calculará el baseline hasta que los cuatro esenciales estén completos y validados."}</p>
                </div>
                <span className={essentialReady === 4 && packageIssues.length === 0 ? "pill good" : "pill danger"}>{essentialReady} de 4 esenciales listos</span>
              </div>
              <div className="synthetic-package-card">
                <div>
                  <b>Continuar con un caso de prueba controlado</b>
                  <p>Crea cinco archivos reproducibles para demostrar el recorrido. Quedarán marcados como datos sintéticos no comerciales y reemplazarán los archivos actuales de este Plan.</p>
                </div>
                <button className="secondary" onClick={() => void loadSyntheticPackage()} disabled={loadingSynthetic}>
                  {loadingSynthetic ? "Preparando…" : "Usar paquete sintético"}
                </button>
              </div>
              {syntheticPackage && (
                <div className="synthetic-banner">
                  <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                  <span>Los cinco archivos de este paquete son artificiales y sólo pueden usarse para prueba.</span>
                </div>
              )}
              <div className="input-requirements">
                {PILOT_INPUT_REQUIREMENTS.map((requirement) => {
                  const item = inputPackage.items.find((candidate) => candidate.requirementId === requirement.id);
                  const received = receivedFiles.find((file) => file.requirementId === requirement.id);
                  return (
                    <article className="input-requirement" key={requirement.id}>
                      <span className={received?.status === "READY" ? "input-state ready" : "input-state"}>{received?.status === "READY" ? "✓" : "○"}</span>
                      <div>
                        <div className="requirement-title">
                          <b>{requirement.name}</b>
                          <small>{requirement.criticality === "ESSENTIAL" ? "Esencial" : "Condicional"}</small>
                        </div>
                        <p>{requirement.purpose}</p>
                        <dl>
                          <div><dt>Detalle esperado</dt><dd>{requirement.expectedGrain}</dd></div>
                          <div><dt>Cobertura mínima</dt><dd>{requirement.minimumCoverage}</dd></div>
                        </dl>
                        {received && (
                          <div className={received.status === "READY" ? "file-result ready" : "file-result incomplete"}>
                            <b>{received.originalName}</b>
                            <span>
                              {received.status === "READY"
                                ? `${received.summary.rowCount} filas revisadas sin errores bloqueantes.`
                                : received.issues.map((issue) =>
                                    `${issue.message}${issue.rows?.length ? ` Filas: ${issue.rows.join(", ")}.` : ""}`,
                                  ).join(" ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="input-upload">
                        <strong>{received?.status === "READY" ? "Estructura lista" : received ? "Incompleto" : item?.status === "NOT_RECEIVED" ? "No recibido" : item?.status}</strong>
                        <button
                          type="button"
                          className="template-button"
                          onClick={() => downloadTemplate(requirement)}
                        >
                          ↓ Descargar plantilla
                        </button>
                        <label className="secondary file-button">
                          {uploadingRequirement === requirement.id ? "Validando…" : received ? "Reemplazar CSV" : "Seleccionar CSV"}
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            disabled={uploadingRequirement === requirement.id}
                            onChange={(event) => void uploadInput(requirement.id, event.target.files?.[0])}
                          />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
              {packageIssues.length > 0 && (
                <div className="package-issues">
                  <b>Hay correspondencias pendientes entre archivos</b>
                  {packageIssues.map((issue) => <p key={issue.code}>{issue.message}</p>)}
                </div>
              )}
              {systemReady && !packageAccepted && (
                <div className="accept-package-card">
                  <div><b>Los cuatro insumos esenciales superaron los controles</b><p>Confirma el paquete para cerrar esta compuerta y habilitar Baseline.</p></div>
                  <button className="primary" onClick={() => void acceptInputPackage()} disabled={acceptingPackage}>
                    {acceptingPackage ? "Confirmando…" : "Confirmar paquete listo"}
                  </button>
                </div>
              )}
              {packageAccepted && (
                <div className="accepted-package-card">
                  <span>✓</span><div><b>Paquete aceptado</b><p>Cualquier archivo reemplazado volverá a abrir esta revisión.</p></div>
                </div>
              )}
              {!syntheticPackage && (
                <div className="input-package-warning">
                  <span>!</span>
                  <div><b>El archivo histórico disponible no completa este paquete</b><p>Está agregado por unidad de negocio y corresponde a 2010–2011; no incluye el detalle cuenta × SKU requerido para el piloto.</p></div>
                </div>
              )}
            </div>
          )}
        </section>
        <div className="sticky-actions empty-actions">
          <span>✓ Guardado durable · {baseline ? "baseline técnico persistido" : "ningún resultado ha sido calculado"}</span>
          <button className="secondary" onClick={() => { setView("portfolio"); void loadPlans(); }}>Salir a Mis Planes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page empty-plan-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Planeación anual</p>
          <h1>Mis Planes</h1>
          <p>Crea un Plan nuevo o continúa exactamente donde lo dejaste.</p>
        </div>
        <button className="primary" onClick={() => setView("create")}>+ Crear Plan</button>
      </div>
      {error && <div className="recoverable-error" role="alert">{error}<button onClick={() => void loadPlans()}>Reintentar</button></div>}
      {loading ? (
        <section className="panel plans-loading" aria-live="polite">Buscando tus Planes guardados…</section>
      ) : plans.length === 0 ? (
        <section className="panel plans-empty-state">
          <span>▤</span>
          <h2>Aún no tienes Planes guardados</h2>
          <p>Empieza creando el contexto. No necesitas tener cifras ni archivos listos.</p>
          <button className="primary" onClick={() => setView("create")}>Crear mi primer Plan</button>
        </section>
      ) : (
        <section className="panel real-plan-list">
          <div className="panel-head"><div><p className="eyebrow">Trabajo guardado</p><h2>Continúa un Plan</h2></div><span className="count">{plans.length} {plans.length === 1 ? "Plan" : "Planes"}</span></div>
          {plans.map((plan) => {
            const version = activeVersion(plan);
            return (
              <button className="real-plan-row" key={plan.id} onClick={() => openPlan(plan)}>
                <div><b>{plan.accountName ?? plan.accountId}</b><small>{plan.companyName ?? plan.companyId} · Plan {plan.year}</small></div>
                <div><span>Versión</span><b>V{version?.number ?? 1}</b></div>
                <div><span>Estado</span><b>Borrador vacío</b></div>
                <div><span>Siguiente acción</span><b>Definir información</b></div>
                <strong>Continuar →</strong>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
