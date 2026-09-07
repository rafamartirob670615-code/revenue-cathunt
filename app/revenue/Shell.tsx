"use client";

import Image from "next/image";
import { REVENUE_MODULES, type RevenueModule } from "./modules";
import { FUNCTION_LABELS, type RevenueIdentity } from "./access";

const sidebarModules: RevenueModule[] = ["monitoreo", "contexto", "administracion"];

export default function Shell({
  active,
  identity,
  onNavigate,
  children,
}: {
  active: RevenueModule;
  identity: RevenueIdentity;
  onNavigate: (module: RevenueModule) => void;
  children: React.ReactNode;
}) {
  const modules = sidebarModules.flatMap((slug) => REVENUE_MODULES.filter((module) => module.slug === slug));
  return (
    <div className="revenue-platform">
      <aside className="revenue-sidebar">
        <div className="revenue-brand">
          <Image src="/favicon-256.png" alt="REVENUE" width={192} height={192} priority />
          <div><b>REVENUE</b></div>
        </div>
        <nav aria-label="Recorrido de REVENUE">
          <section className="nav-group">
            {modules.map((module) => <button
              key={module.slug}
              className={active === module.slug ? "active" : ""}
              onClick={() => onNavigate(module.slug)}
            >
              <i>·</i><span><b>{module.name.toUpperCase()}</b></span>
            </button>)}
          </section>
        </nav>
        <footer><i /><span><b>{identity.displayName}</b><small>{FUNCTION_LABELS[identity.functions[0]]} · sesión autorizada</small><small className="copyright">© 2026 REVENUE · CatHunt</small></span></footer>
      </aside>
      <main className="revenue-stage revenue-content">{children}</main>
    </div>
  );
}
