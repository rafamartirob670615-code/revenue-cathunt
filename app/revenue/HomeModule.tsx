import type { DashboardPlan } from "./model";
import { ModuleHead } from "./ui";
import { FUNCTION_LABELS, type RevenueIdentity } from "./access";
import type { RevenueModule } from "./modules";

export default function HomeModule({
  plans,
  identity,
  onCreate,
  onOpen,
  onMonitor,
  onWork,
}: {
  identity: RevenueIdentity;
  plans: DashboardPlan[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onMonitor: (id: string) => void;
  onWork: (module: RevenueModule) => void;
}) {
  const monitorable = plans.filter((plan) => ["SUBMITTED","COMMERCIAL_APPROVED","OFFICIAL"].includes(plan.status));
  const can = (capability: RevenueIdentity["capabilities"][number]) => identity.capabilities.includes(capability);
  const canCreate = can("PLAN_CREATE") || can("PLAN_INTEGRATE");
  return (
    <div className="module-page home-module">
      <ModuleHead eyebrow="Mi trabajo" title={`Hola, ${identity.displayName.split(" ")[0]}`} description="REVENUE organiza lo que te corresponde aportar, integrar, validar o aprobar." />
      <section className="identity-band">
        <div><small>Función principal</small><b>{FUNCTION_LABELS[identity.functions[0]]}</b><span>{identity.authenticated ? identity.email : "Identidad piloto local"}</span></div>
        <div><small>Capacidades habilitadas</small><b>{identity.capabilities.length}</b><span>Aplican únicamente a las cuentas asignadas.</span></div>
        <div><small>Trabajo pendiente</small><b>{plans[0]?.nextAction ?? "Crear el primer Plan"}</b><span>Las tareas de otras áreas permanecen visibles, con dueño.</span></div>
      </section>
      <section className="contribution-lanes" aria-label="Aportaciones por función">
        {can("MARKETING_CONTRIBUTE") && <button onClick={() => onWork("plan-marketing")}><small>Bandeja del aportante · Marketing</small><b>Registrar mi aportación</b><span>Importar un archivo o construir campañas, temporadas y lanzamientos.</span><strong>→</strong></button>}
        {can("TRADE_CONTRIBUTE") && <button onClick={() => onWork("plan-trade")}><small>Bandeja del aportante · Trade</small><b>Entregar promociones y ejecución</b><span>Recibir la app de promociones o construir actividades de la cadena.</span><strong>→</strong></button>}
        {can("PLAN_INTEGRATE") && <button onClick={() => onWork("plan-marketing")}><small>Bandeja de integración · KAM</small><b>Integrar aportaciones</b><span>Revisar propietario, fuente, calidad y efecto antes de incorporar.</span><strong>→</strong></button>}
        {(can("REVIEW") || can("APPROVE")) && <button onClick={() => onWork("revision")}><small>Revisión comercial</small><b>Revisar una versión</b><span>La autoridad comercial revisa y decide sobre la versión congelada.</span><strong>→</strong></button>}
        {can("VIEW_FINANCIALS") && <button onClick={() => onWork("rentabilidad")}><small>Consulta financiera</small><b>Consultar rentabilidad</b><span>Vista autorizada sin captura, modificación ni botones de decisión.</span><strong>→</strong></button>}
      </section>
      <section className="answer-strip">
        <div><span>Planes activos</span><b>{plans.length}</b></div>
        <div><span>Listos para seguimiento</span><b>{monitorable.length}</b></div>
        <div><span>Siguiente decisión</span><b>{plans[0]?.nextAction ?? "Crear el primer Plan"}</b></div>
      </section>
      <section className="home-decisions">
        <article>
          <small>Planeación</small><h2>Construir un Plan anual</h2>
          <p>Registra compañía, cuenta y año. Después comienza con un solo Excel de ventas.</p>
          <button className="clay-primary" disabled={!canCreate} onClick={onCreate}>{canCreate ? "Crear un Plan" : "Requiere asignación"} <b>→</b></button>
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
