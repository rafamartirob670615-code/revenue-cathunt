"use client";

import type { Plan } from "../../domain/types";
import { REVENUE_MODULES, type RevenueModule } from "./modules";

const groupLabels = {
  general: "",
  build: "Construir el Plan",
  execute: "Ejecutar el Plan",
  system: "Sistema",
} as const;

export default function Shell({
  active,
  plan,
  completed,
  onNavigate,
  children,
}: {
  active: RevenueModule;
  plan: Plan | null;
  completed: Set<RevenueModule>;
  onNavigate: (module: RevenueModule) => void;
  children: React.ReactNode;
}) {
  const version = plan?.versions.at(-1);
  const groups = ["general", "build", "execute", "system"] as const;
  return (
    <div className="revenue-platform">
      <aside className="revenue-sidebar">
        <div className="revenue-brand">
          <span>R</span>
          <div><b>REVENUE</b><small>Planeación anual</small></div>
        </div>
        <nav aria-label="Recorrido de REVENUE">
          {groups.map((group) => {
            const modules = REVENUE_MODULES.filter((module) => module.group === group);
            return <section className="nav-group" key={group}>
              {groupLabels[group] && <p>{groupLabels[group]}</p>}
              {modules.map((module) => {
                const needsPlan = module.group === "build" || module.group === "execute";
                return <button
                  key={module.slug}
                  className={active === module.slug ? "active" : ""}
                  onClick={() => onNavigate(module.slug)}
                >
                  {module.step ? <i className={completed.has(module.slug) ? "done" : ""}>{completed.has(module.slug) ? "✓" : module.step}</i> : <i>·</i>}
                  <span><b>{module.name}</b><small>{needsPlan && !plan ? "Selecciona un Plan para trabajar" : module.question}</small></span>
                </button>;
              })}
            </section>;
          })}
        </nav>
        <footer><i /><span><b>Espacio privado</b><small>Guardado por Plan y versión</small></span></footer>
      </aside>
      <section className="revenue-stage">
        <header className="plan-context">
          <div><span>Compañía</span><b>{plan?.companyName ?? "Sin Plan activo"}</b></div>
          <div><span>Cuenta</span><b>{plan?.accountName ?? "Selecciona uno en Inicio"}</b></div>
          <div><span>Año</span><b>{plan?.year ?? "—"}</b></div>
          <div><span>Versión</span><b>{version ? `V${version.number}` : "—"}</b></div>
          <div><span>Estado</span><b>{version?.status === "SUBMITTED" ? "En revisión" : plan ? "En construcción" : "Sin iniciar"}</b></div>
        </header>
        <main className="revenue-content">{children}</main>
      </section>
    </div>
  );
}
