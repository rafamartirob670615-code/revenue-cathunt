import type { DashboardPlan } from "./model";
import { ModuleHead } from "./ui";

export default function HomeModule({
  plans,
  onCreate,
  onOpen,
  onMonitor,
}: {
  plans: DashboardPlan[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onMonitor: (id: string) => void;
}) {
  const monitorable = plans.filter((plan) => ["SUBMITTED","COMMERCIAL_APPROVED","FINANCE_VALIDATED","OFFICIAL"].includes(plan.status));
  return (
    <div className="module-page home-module">
      <ModuleHead eyebrow="Inicio" title="¿Qué necesita atención hoy?" description="Comienza un Plan, continúa una decisión pendiente o revisa el desempeño de una versión enviada." />
      <section className="answer-strip">
        <div><span>Planes activos</span><b>{plans.length}</b></div>
        <div><span>Listos para seguimiento</span><b>{monitorable.length}</b></div>
        <div><span>Siguiente decisión</span><b>{plans[0]?.nextAction ?? "Crear el primer Plan"}</b></div>
      </section>
      <section className="home-decisions">
        <article>
          <small>Planeación</small><h2>Construir un Plan anual</h2>
          <p>Registra compañía, cuenta y año. Después comienza con un solo Excel de ventas.</p>
          <button className="clay-primary" onClick={onCreate}>Crear un Plan <b>→</b></button>
        </article>
        <article>
          <small>Seguimiento</small><h2>Revisar un Plan enviado</h2>
          <p>Compara Plan, cuota, venta real y año anterior; convierte desviaciones en acciones.</p>
          <button className="paper-button" disabled={!monitorable.length} onClick={() => monitorable[0] && onMonitor(monitorable[0].id)}>
            {monitorable.length ? "Abrir Monitoreo" : "Aún no hay Planes enviados"} <b>→</b>
          </button>
        </article>
      </section>
      <section className="paper-panel">
        <div className="panel-title"><div><small>Trabajo guardado</small><h2>Continuar exactamente donde quedó</h2></div><span>{plans.length} Planes</span></div>
        <div className="plan-ledger">
          {plans.map((plan) => (
            <button key={plan.id} onClick={() => onOpen(plan.id)}>
              <div><b>{plan.account}</b><small>{plan.company} · {plan.year} · V{plan.version}</small></div>
              <span>{plan.nextAction}</span><strong>→</strong>
            </button>
          ))}
          {!plans.length && <p className="ledger-empty">Todavía no hay Planes comerciales.</p>}
        </div>
      </section>
    </div>
  );
}
