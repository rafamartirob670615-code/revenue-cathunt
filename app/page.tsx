"use client";

import { useState } from "react";
import PlansWorkspace from "./PlansWorkspace";
import PlanMonitor from "./PlanMonitor";
import RevenueLobby from "./RevenueLobby";

type AppView = "lobby" | "plan" | "monitor";

export default function RevenueApp() {
  const [view, setView] = useState<AppView>("lobby");
  const [requestedPlanId, setRequestedPlanId] = useState<string>();
  const [startCreate, setStartCreate] = useState(false);

  function openPlan(planId: string) {
    setRequestedPlanId(planId);
    setStartCreate(false);
    setView("plan");
  }

  function createPlan() {
    setRequestedPlanId(undefined);
    setStartCreate(true);
    setView("plan");
  }
  function openMonitor(planId:string){setRequestedPlanId(planId);setStartCreate(false);setView("monitor");}

  return (
    <div className="revenue-recovery-shell">
      <header className="recovery-topbar">
        <button className="recovery-brand" onClick={() => setView("lobby")}>
          <span>R</span>
          <div><b>REVENUE</b><small>Planeación anual</small></div>
        </button>
        <nav className="global-nav" aria-label="Navegación principal"><button onClick={()=>setView("lobby")}>Inicio</button><button onClick={()=>createPlan()}>Crear Plan</button></nav>
        <button className="avatar" aria-label="Perfil de usuario">U</button>
      </header>
      <main className="recovery-main">
        {view === "lobby" && (
          <RevenueLobby
            openPlan={openPlan}
            openMonitor={openMonitor}
            createPlan={createPlan}
          />
        )}
        {view==="monitor"&&requestedPlanId&&<PlanMonitor planId={requestedPlanId} onExit={()=>setView("lobby")}/>}
        {view === "plan" && (
          <PlansWorkspace
            key={`${requestedPlanId ?? "new"}:${startCreate}`}
            initialPlanId={requestedPlanId}
            startInCreate={startCreate}
            onExit={() => setView("lobby")}
            onMonitor={(planId) => openMonitor(planId)}
          />
        )}
      </main>
    </div>
  );
}
