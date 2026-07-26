"use client";

import { useState } from "react";
import PlansWorkspace from "./PlansWorkspace";
import RevenueDashboard from "./RevenueDashboard";

type AppView = "dashboard" | "plans" | "monitoring";

function MonitoringView({ openPlans }: { openPlans: () => void }) {
  return (
    <div className="page monitoring-shell-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Monitoreo del Plan</p>
          <h1>Del Plan oficial a la acción</h1>
          <p>Este espacio se activará cuando existan Plan oficial y resultados reales comparables.</p>
        </div>
        <button className="secondary" onClick={openPlans}>Ver Mis Planes</button>
      </div>
      <section className="monitoring-contract">
        <div className="monitoring-flow">
          <article className="available"><span>01</span><b>Plan oficial</b><small>Versión aprobada e inmutable</small></article>
          <strong>→</strong>
          <article><span>02</span><b>Resultados reales</b><small>Plan, cuota, proyección y corte comparable</small></article>
          <strong>→</strong>
          <article><span>03</span><b>Variación</b><small>Unidades, valor y rentabilidad</small></article>
          <strong>→</strong>
          <article><span>04</span><b>Acción</b><small>Causa, responsable y seguimiento</small></article>
        </div>
        <div className="monitoring-empty-message">
          <span>Sin resultados sustitutos</span>
          <div><h2>Monitoreo todavía no está disponible para operar</h2><p>No se mostrarán cifras hasta conectar resultados reales y reglas aprobadas de cuota y proyección.</p></div>
        </div>
      </section>
    </div>
  );
}

export default function RevenueApp() {
  const [view, setView] = useState<AppView>("dashboard");
  const [requestedPlanId, setRequestedPlanId] = useState<string>();
  const [startCreate, setStartCreate] = useState(false);

  function openPlans(planId?: string) {
    setRequestedPlanId(planId);
    setStartCreate(false);
    setView("plans");
  }

  function createPlan() {
    setRequestedPlanId(undefined);
    setStartCreate(true);
    setView("plans");
  }

  return (
    <div className="app-shell focused-shell">
      <header className="topbar business-topbar">
        <button className="brand brand-button" onClick={() => setView("dashboard")}>
          <span className="brand-mark">R</span>
          <span>Revenue</span>
        </button>
        <div className="top-context">
          <span>Planeación anual</span>
          <small>Construir · Aprobar · Monitorear</small>
        </div>
        <nav className="mobile-business-nav" aria-label="Navegación principal">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>Inicio</button>
          <button className={view === "plans" ? "active" : ""} onClick={() => openPlans()}>Planes</button>
          <button className={view === "monitoring" ? "active" : ""} onClick={() => setView("monitoring")}>Monitoreo</button>
        </nav>
        <div className="top-actions">
          <span className="private-label">Sitio privado</span>
          <button className="avatar" aria-label="Perfil de Roberto Martínez">RM</button>
        </div>
      </header>
      <aside className="sidebar business-sidebar">
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><span className="nav-icon">⌂</span>Inicio</button>
          <button className={view === "plans" ? "active" : ""} onClick={() => openPlans()}><span className="nav-icon">▤</span>Construcción</button>
          <button className={view === "monitoring" ? "active" : ""} onClick={() => setView("monitoring")}><span className="nav-icon">↗</span>Monitoreo</button>
        </nav>
        <div className="business-sidebar-label">Ciclo del Plan</div>
        <ol className="business-journey">
          <li className="active"><span>1</span><b>Información</b></li>
          <li><span>2</span><b>Base</b></li>
          <li><span>3</span><b>Crecimiento</b></li>
          <li><span>4</span><b>Resultado</b></li>
          <li><span>5</span><b>Versión</b></li>
        </ol>
        <div className="sidebar-foot"><span>●</span><div><b>Trabajo protegido</b><small>Acceso privado</small></div></div>
      </aside>
      <main>
        {view === "dashboard" && <RevenueDashboard openPlan={(planId) => openPlans(planId)} createPlan={createPlan} />}
        {view === "plans" && <PlansWorkspace key={`${requestedPlanId ?? "portfolio"}:${startCreate}`} initialPlanId={requestedPlanId} startInCreate={startCreate} />}
        {view === "monitoring" && <MonitoringView openPlans={() => openPlans()} />}
      </main>
    </div>
  );
}
