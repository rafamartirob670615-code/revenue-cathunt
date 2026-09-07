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
      <section className="home-decisions" aria-label="Rutas principales">
        <article>
          <small>Monitoreo</small>
          <h2>Ver el negocio completo</h2>
          <p>Estado del negocio en este momento.</p>
          <button className="clay-primary" onClick={onMonitor}>Abrir Monitoreo <b>→</b></button>
        </article>
        <article>
          <small>Construcción</small>
          <h2>Crear un Plan anual</h2>
          <button className="paper-button" disabled={!canCreate} onClick={onCreate}>
            {canCreate ? "Crear un Plan" : "Sin asignación para construir"} <b>→</b>
          </button>
        </article>
      </section>
    </div>
  );
}
