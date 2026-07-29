"use client";

import type { Plan } from "../../domain/types";
import { REVENUE_MODULES, type RevenueModule } from "./modules";

export default function Shell({
  active,
  plan,
  available,
  onNavigate,
  children,
}: {
  active: RevenueModule;
  plan: Plan | null;
  available: Set<RevenueModule>;
  onNavigate: (module: RevenueModule) => void;
  children: React.ReactNode;
}) {
  const version = plan?.versions.at(-1);
  return (
    <div className="claude-platform">
      <aside className="claude-sidebar">
        <div className="claude-brand">
          <p>REVENUE</p>
          <strong>Planeación anual</strong>
          <small>Una cuenta · un Plan · una versión</small>
        </div>
        <nav aria-label="Módulos de REVENUE">
          {REVENUE_MODULES.map((module) => (
            <button
              key={module.slug}
              className={active === module.slug ? "active" : ""}
              disabled={!available.has(module.slug)}
              onClick={() => onNavigate(module.slug)}
            >
              <span>{module.name}</span>
              <small>{module.question}</small>
            </button>
          ))}
        </nav>
        <div className="claude-sidebar-foot">
          <i />
          <div><b>Espacio privado</b><small>Los cambios se guardan en el Plan activo.</small></div>
        </div>
      </aside>
      <section className="claude-stage">
        <header className="claude-context">
          <div><span>Compañía</span><b>{plan?.companyName ?? "Selecciona un Plan"}</b></div>
          <div><span>Cuenta</span><b>{plan?.accountName ?? "Sin cuenta activa"}</b></div>
          <div><span>Año</span><b>{plan?.year ?? "—"}</b></div>
          <div><span>Versión</span><b>{version ? `V${version.number}` : "—"}</b></div>
          <div className="context-status"><span>Estado</span><b>{version?.status === "SUBMITTED" ? "En revisión" : plan ? "En construcción" : "Inicio"}</b></div>
        </header>
        <main className="claude-content">{children}</main>
      </section>
    </div>
  );
}
