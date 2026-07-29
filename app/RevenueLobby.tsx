"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanStatus } from "../domain/types";

type DashboardStage = "PREPARE_INFORMATION"|"COMPLETE_INFORMATION"|"REVIEW_PACKAGE"|"BUILD_BASELINE"|"BUILD_PLAN"|"REVIEW_APPROVAL"|"OFFICIAL";
interface DashboardPlan { id:string; company:string; account:string; year:number; currency:string; version:number; status:PlanStatus; stage:DashboardStage; nextAction:string; readyFiles:number; packageAccepted:boolean; updatedAt:string; }
interface DashboardData { owner:{ email:string; name?:string }; plans:DashboardPlan[]; }
const syntheticName = "PILOTO SINTÉTICO NO COMERCIAL";

export default function RevenueLobby({ openPlan, openMonitor, createPlan }:{ openPlan:(planId:string)=>void; openMonitor:(planId:string)=>void; createPlan:()=>void; }) {
  const [data,setData]=useState<DashboardData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{ fetch("/api/dashboard",{cache:"no-store"}).then(async response=>{const body=await response.json() as DashboardData&{ok?:boolean;error?:string};if(!response.ok||body.ok===false)throw new Error(body.error);setData(body);}).catch(cause=>setError(cause instanceof Error?cause.message:"No pudimos abrir tus Planes.")).finally(()=>setLoading(false)); },[]);
  const plans=useMemo(()=>data?.plans??[],[data]);
  const realPlans=plans.filter(plan=>plan.account!==syntheticName);
  const monitorablePlans=realPlans.filter(plan=>["SUBMITTED","COMMERCIAL_APPROVED","FINANCE_VALIDATED","OFFICIAL"].includes(plan.status));
  const recentPlans=realPlans.slice(0,3);
  if(loading)return <div className="recovery-loading"><span/><b>Abriendo tu espacio de planeación…</b></div>;
  return <div className="lobby-app-shell">
    <aside className="lobby-sidebar" aria-label="Secciones principales de REVENUE">
      <div className="lobby-sidebar-title"><small>Planeación anual</small><b>Tu espacio de trabajo</b></div>
      <nav>
        <button className="active"><b>Inicio</b><small>¿Qué necesito hacer hoy?</small></button>
        <button onClick={createPlan}><b>Información</b><small>¿Qué información tengo?</small></button>
        <button disabled={!recentPlans.length} onClick={()=>recentPlans[0]&&openPlan(recentPlans[0].id)}><b>Volumen base</b><small>¿Qué vendería sin actividades?</small></button>
        <button disabled={!recentPlans.length} onClick={()=>recentPlans[0]&&openPlan(recentPlans[0].id)}><b>Crecimiento</b><small>¿Qué aportarán Marketing y Trade?</small></button>
        <button disabled={!recentPlans.length} onClick={()=>recentPlans[0]&&openPlan(recentPlans[0].id)}><b>Plan anual</b><small>¿Cuánto venderemos?</small></button>
        <button disabled={!recentPlans.length} onClick={()=>recentPlans[0]&&openPlan(recentPlans[0].id)}><b>Rentabilidad</b><small>¿Cuánto dinero dejará?</small></button>
        <button disabled={!recentPlans.length} onClick={()=>recentPlans[0]&&openPlan(recentPlans[0].id)}><b>Revisión</b><small>¿Qué falta validar o aprobar?</small></button>
        <button disabled={!monitorablePlans.length} onClick={()=>monitorablePlans[0]&&openMonitor(monitorablePlans[0].id)}><b>Monitoreo</b><small>¿Cómo vamos contra el Plan?</small></button>
      </nav>
      <div className="lobby-sidebar-admin"><b>Administración</b><small>Compañías, cuentas, usuarios, permisos y reglas</small></div>
    </aside>
    <div className="revenue-lobby">
    <section className="lobby-intro"><p className="eyebrow">Planeación comercial</p><h1>¿Qué necesitas hacer hoy?</h1><p>Crea un Plan con la información que ya tengas o revisa cómo está funcionando un Plan aprobado.</p></section>
    {error&&<div className="recoverable-error" role="alert">{error}</div>}
    <section className="lobby-actions" aria-label="Opciones para comenzar">
      <article className="lobby-card real-card"><span className="lobby-step">01</span><div><small>Planeación</small><h2>Crear un Plan</h2><p>Registra la cuenta y comienza con un Excel de ventas o con la prueba guiada. La app te llevará paso a paso.</p></div><button className="lobby-primary" onClick={createPlan}>Crear un Plan <strong>→</strong></button></article>
      <article className="lobby-card monitor-card"><span className="lobby-step">02</span><div><small>Seguimiento</small><h2>Revisar desempeño</h2><p>Consulta primero el Plan y agrega cuota o venta real únicamente cuando quieras comparar resultados.</p></div><button className="lobby-primary monitor" disabled={!monitorablePlans.length} onClick={()=>monitorablePlans[0]&&openMonitor(monitorablePlans[0].id)}>{monitorablePlans.length?"Abrir seguimiento":"Aún no hay un Plan aprobado"} <strong>→</strong></button></article>
    </section>
    <section className="recent-work" aria-label="Planes recientes"><div><p className="eyebrow">Trabajo guardado</p><h2>Continuar un Plan</h2></div>{recentPlans.length?<div className="lobby-plan-list">{recentPlans.map(plan=><button key={plan.id} onClick={()=>openPlan(plan.id)}><div><b>{plan.account}</b><small>{plan.company} · {plan.year} · V{plan.version}</small></div><span>{plan.nextAction}</span><strong>→</strong></button>)}</div>:<div className="lobby-empty">Todavía no tienes Planes comerciales guardados.</div>}</section>
    <footer className="lobby-footer"><span><i/> Guardado privado</span><p>Los cambios se guardan en la versión activa de cada Plan.</p></footer>
    </div>
  </div>;
}
