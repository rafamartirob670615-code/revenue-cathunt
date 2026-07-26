"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanStatus } from "../domain/types";

type DashboardStage =
  | "PREPARE_INFORMATION"
  | "COMPLETE_INFORMATION"
  | "REVIEW_PACKAGE"
  | "BUILD_BASELINE"
  | "BUILD_PLAN"
  | "REVIEW_APPROVAL"
  | "OFFICIAL";

interface DashboardPlan {
  id: string;
  company: string;
  account: string;
  year: number;
  currency: string;
  version: number;
  status: PlanStatus;
  stage: DashboardStage;
  nextAction: string;
  readyFiles: number;
  packageAccepted: boolean;
  updatedAt: string;
}

interface DashboardData {
  owner: { email: string; name?: string };
  counts: {
    total: number;
    informationPending: number;
    packagesAccepted: number;
    inReview: number;
    official: number;
  };
  plans: DashboardPlan[];
}

const stageLabel: Record<DashboardStage, string> = {
  PREPARE_INFORMATION: "Preparar información",
  COMPLETE_INFORMATION: "Información incompleta",
  REVIEW_PACKAGE: "Revisar paquete",
  BUILD_BASELINE: "Listo para baseline",
  BUILD_PLAN: "En construcción",
  REVIEW_APPROVAL: "En revisión",
  OFFICIAL: "Oficial",
};

const stageTone: Record<DashboardStage, string> = {
  PREPARE_INFORMATION: "neutral",
  COMPLETE_INFORMATION: "warning",
  REVIEW_PACKAGE: "warning",
  BUILD_BASELINE: "ready",
  BUILD_PLAN: "active",
  REVIEW_APPROVAL: "active",
  OFFICIAL: "ready",
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function RevenueDashboard({
  openPlan,
  createPlan,
}: {
  openPlan: (planId: string) => void;
  createPlan: () => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState<number | "ALL">("ALL");

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as DashboardData & { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error);
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos preparar tu Inicio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // La carga inicia después del montaje y actualiza el estado al resolver la solicitud.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, []);

  const years = useMemo(
    () => [...new Set((data?.plans ?? []).map((plan) => plan.year))].sort((a, b) => b - a),
    [data],
  );
  const visiblePlans = useMemo(
    () => (data?.plans ?? []).filter((plan) => year === "ALL" || plan.year === year),
    [data, year],
  );
  const priorities = visiblePlans.filter((plan) => plan.stage !== "OFFICIAL").slice(0, 4);
  const ownerFirstName = data?.owner.name?.split(/\s+/)[0];

  if (loading) {
    return (
      <div className="page business-dashboard">
        <div className="dashboard-loading">
          <span />
          <b>Preparando tu situación de planeación…</b>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page business-dashboard">
        <section className="dashboard-error">
          <span>!</span>
          <div><h1>No pudimos cargar tu Inicio</h1><p>{error}</p></div>
          <button className="secondary" onClick={() => void loadDashboard()}>Reintentar</button>
        </section>
      </div>
    );
  }

  const counts = data?.counts ?? {
    total: 0,
    informationPending: 0,
    packagesAccepted: 0,
    inReview: 0,
    official: 0,
  };

  return (
    <div className="page business-dashboard">
      <div className="business-head">
        <div>
          <p className="eyebrow">Inicio · ciclo de planeación</p>
          <h1>{ownerFirstName ? `Hola, ${ownerFirstName}` : "Tu planeación anual"}</h1>
          <p>Esto requiere atención para que tus Planes sigan avanzando.</p>
        </div>
        <div className="business-actions">
          {years.length > 1 && (
            <label>
              Año
              <select value={year} onChange={(event) => setYear(event.target.value === "ALL" ? "ALL" : Number(event.target.value))}>
                <option value="ALL">Todos</option>
                {years.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          )}
          <button className="primary" onClick={createPlan}>+ Crear Plan</button>
        </div>
      </div>

      <section className="planning-kpis" aria-label="Resumen de planeación">
        <article><span>Planes activos</span><strong>{counts.total}</strong><small>Guardados en REVENUE</small></article>
        <article className={counts.informationPending ? "needs-attention" : ""}><span>Información pendiente</span><strong>{counts.informationPending}</strong><small>{counts.informationPending ? "Requieren completar insumos" : "Sin pendientes"}</small></article>
        <article><span>Paquetes aceptados</span><strong>{counts.packagesAccepted}</strong><small>Listos para la siguiente compuerta</small></article>
        <article><span>En revisión</span><strong>{counts.inReview}</strong><small>Versiones enviadas o devueltas</small></article>
      </section>

      {visiblePlans.length === 0 ? (
        <section className="dashboard-empty">
          <div className="empty-visual"><span>01</span><i /><i /><i /></div>
          <div>
            <p className="eyebrow">Comienza aquí</p>
            <h2>Aún no hay Planes en este ciclo</h2>
            <p>Crea el contexto del primer Plan. No necesitas cargar cifras para empezar.</p>
            <button className="primary" onClick={createPlan}>Crear mi primer Plan</button>
          </div>
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="decision-panel">
            <div className="dashboard-section-head">
              <div><p className="eyebrow">Prioridades</p><h2>Lo que necesita tu decisión</h2></div>
              <span>{priorities.length} {priorities.length === 1 ? "pendiente" : "pendientes"}</span>
            </div>
            <div className="decision-list">
              {priorities.length === 0 ? (
                <div className="all-clear"><span>✓</span><div><b>No hay decisiones abiertas</b><small>Tus Planes visibles no tienen trabajo pendiente.</small></div></div>
              ) : priorities.map((plan) => (
                <button key={plan.id} onClick={() => openPlan(plan.id)}>
                  <span className={`decision-signal ${stageTone[plan.stage]}`} />
                  <div>
                    <b>{plan.account}</b>
                    <small>{plan.company} · Plan {plan.year} · V{plan.version}</small>
                  </div>
                  <em>{plan.nextAction}</em>
                  <strong>→</strong>
                </button>
              ))}
            </div>
          </section>

          <aside className="planning-pulse">
            <div className="dashboard-section-head">
              <div><p className="eyebrow">Avance del portafolio</p><h2>Etapa actual</h2></div>
            </div>
            <div className="stage-stack">
              {(["PREPARE_INFORMATION", "COMPLETE_INFORMATION", "REVIEW_PACKAGE", "BUILD_BASELINE", "BUILD_PLAN", "REVIEW_APPROVAL", "OFFICIAL"] as DashboardStage[]).map((stage) => {
                const count = visiblePlans.filter((plan) => plan.stage === stage).length;
                return (
                  <div key={stage} className={count ? "has-plans" : ""}>
                    <span style={{ width: visiblePlans.length ? `${Math.max((count / visiblePlans.length) * 100, count ? 8 : 0)}%` : "0%" }} />
                    <b>{stageLabel[stage]}</b>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {visiblePlans.length > 0 && (
        <section className="plan-portfolio">
          <div className="dashboard-section-head">
            <div><p className="eyebrow">Mis Planes</p><h2>Situación y siguiente acción</h2></div>
            <span>{visiblePlans.length} {visiblePlans.length === 1 ? "Plan" : "Planes"}</span>
          </div>
          <div className="portfolio-head"><span>Cuenta</span><span>Etapa</span><span>Información</span><span>Actualización</span><span /></div>
          {visiblePlans.slice(0, 8).map((plan) => (
            <button className="portfolio-row" key={plan.id} onClick={() => openPlan(plan.id)}>
              <div><b>{plan.account}</b><small>{plan.company} · {plan.year} · {plan.currency}</small></div>
              <span className={`portfolio-stage ${stageTone[plan.stage]}`}>{stageLabel[plan.stage]}</span>
              <span>{plan.packageAccepted ? "Paquete aceptado" : `${plan.readyFiles} de 4 esenciales`}</span>
              <span>{formatUpdatedAt(plan.updatedAt)}</span>
              <strong>{plan.nextAction} →</strong>
            </button>
          ))}
        </section>
      )}

      <section className="monitoring-readiness">
        <div>
          <p className="eyebrow">Monitoreo del Plan</p>
          <h2>{counts.official ? `${counts.official} Planes oficiales listos para conectar` : "Se activará con un Plan oficial y resultados comparables"}</h2>
        </div>
        <div className="monitoring-steps">
          <span className={counts.official ? "done" : ""}>Plan oficial</span><i>→</i><span>Resultados reales</span><i>→</i><span>Variación y acción</span>
        </div>
      </section>
    </div>
  );
}
