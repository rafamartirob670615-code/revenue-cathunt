import { ModuleHead } from "./ui";

export default function HomeModule({
  canCreate,
  onCreate,
  onMonitor,
}: {
  canCreate: boolean;
  onCreate: () => void;
  onMonitor: () => void;
}) {
  return (
    <div className="module-page home-module">
      <ModuleHead
        eyebrow="REVENUE"
        title="¿Qué quieres hacer?"
        description="Elige una ruta para empezar. Puedes consultar el negocio completo o construir un Plan anual."
      />
      <section className="home-decisions" aria-label="Rutas principales">
        <article>
          <small>Monitoreo</small>
          <h2>Ver el negocio completo</h2>
          <p>Consulta todas las cuentas, filtros, comparadores y desviaciones del Billing.</p>
          <button className="clay-primary" onClick={onMonitor}>Abrir Monitoreo <b>→</b></button>
        </article>
        <article>
          <small>Construcción</small>
          <h2>Crear un Plan anual</h2>
          <p>Registra compañía, cuenta, año y después incorpora la información del Plan.</p>
          <button className="paper-button" disabled={!canCreate} onClick={onCreate}>
            {canCreate ? "Crear un Plan" : "Sin asignación para construir"} <b>→</b>
          </button>
        </article>
      </section>
    </div>
  );
}
